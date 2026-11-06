import { EmbedBuilder } from 'discord.js';
import { COLORS } from './config.js';

/** Envia o embed para o canal de logs de punições, se estiver configurado. */
export async function logAction(client, guildId, cfg, embed) {
  const channelId = cfg?.punishChannelId;
  if (!channelId) return;

  try {
    const channel =
      client.channels.cache.get(channelId) || (await client.channels.fetch(channelId));
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[logs] não consegui enviar o log:', error.message);
  }
}

export function punishmentEmbed({
  color = COLORS.neutral,
  action,
  targetName,
  targetId,
  actorName,
  actorId,
  reason,
  duration,
  footer,
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 ${action}`)
    .addFields(
      { name: 'Usuário', value: `${targetName} (\`${targetId}\`)`, inline: true },
      { name: 'Moderador', value: `${actorName} (\`${actorId}\`)`, inline: true },
      { name: 'Motivo', value: reason || 'Não informado' },
    )
    .setTimestamp();

  if (duration) embed.addFields({ name: 'Duração', value: duration, inline: true });
  if (footer) embed.setFooter({ text: footer });

  return embed;
}
