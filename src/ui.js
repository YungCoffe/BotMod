import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { COLORS } from './config.js';

export function okEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.ok)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function failEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`🚫 ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function warnEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.warn)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Mostra um pedido de confirmação com botões Sim/Não e espera a resposta
 * de quem executou o comando. Devolve true só se a pessoa confirmar.
 */
export async function ask(interaction, {
  title,
  lines,
  confirmLabel = 'Sim, aplicar',
  cancelLabel = 'Não, cancelar',
  timeout = 45_000,
}) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.warn)
    .setTitle(`⚠️ ${title}`)
    .setDescription(lines.filter(Boolean).join('\n'))
    .setFooter({ text: 'Só quem usou o comando pode responder • expira em 45 segundos' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirmar')
      .setLabel(confirmLabel)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('cancelar')
      .setLabel(cancelLabel)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌'),
  );

  const prompt = await interaction.editReply({ embeds: [embed], components: [row] });

  try {
    const click = await prompt.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: timeout,
      filter: (button) => button.user.id === interaction.user.id,
    });

    await click.deferUpdate().catch(() => {});

    if (click.customId === 'confirmar') return true;

    await interaction
      .editReply({ embeds: [infoEmbed('Cancelado', 'Nada foi feito.')], components: [] })
      .catch(() => {});
    return false;
  } catch {
    await interaction
      .editReply({ embeds: [infoEmbed('Confirmação expirada', 'Nada foi feito.')], components: [] })
      .catch(() => {});
    return false;
  }
}

/** Tenta avisar o usuário por DM; se a DM estiver fechada, só ignora. */
export async function tryDm(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}
