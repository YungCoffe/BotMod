import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { COLORS } from '../config.js';
import { failEmbed, infoEmbed, okEmbed } from '../ui.js';

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

const fail = (interaction, title, description) =>
  interaction.editReply({ embeds: [failEmbed(title, description)], components: [] });

const commands = [
  {
    staffOnly: false,
    adminOnly: true,
    data: new SlashCommandBuilder()
      .setName('config')
      .setDescription('Configura os cargos e canais do bot (Administrador)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommandGroup((group) =>
        group
          .setName('cargo')
          .setDescription('Cargos que podem usar o bot')
          .addSubcommand((sub) =>
            sub
              .setName('adicionar')
              .setDescription('Libera um cargo para usar o bot')
              .addRoleOption((option) =>
                option.setName('cargo').setDescription('Cargo').setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remover')
              .setDescription('Remove um cargo da lista de liberados')
              .addRoleOption((option) =>
                option.setName('cargo').setDescription('Cargo').setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub.setName('listar').setDescription('Mostra os cargos liberados'),
          ),
      )
      .addSubcommandGroup((group) =>
        group
          .setName('logs')
          .setDescription('Canal de logs das punições')
          .addSubcommand((sub) =>
            sub
              .setName('definir')
              .setDescription('Define o canal que recebe os logs')
              .addChannelOption((option) =>
                option
                  .setName('canal')
                  .setDescription('Canal de texto')
                  .setRequired(true)
                  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
              ),
          )
          .addSubcommand((sub) =>
            sub.setName('desativar').setDescription('Desliga os logs de punições'),
          ),
      )
      .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra a configuração atual')),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand(true);

      // ------------------------------------------------- cargos
      if (group === 'cargo') {
        const role = sub === 'listar' ? null : interaction.options.getRole('cargo', true);

        if (sub === 'adicionar') {
          if (role.id === guild.id) {
            return fail(
              interaction,
              'Cargo inválido',
              'O cargo **@everyone** não pode ser liberado.',
            );
          }
          if (role.managed) {
            return fail(
              interaction,
              'Cargo inválido',
              'Esse cargo é gerenciado por uma integração e não pode ser usado aqui.',
            );
          }

          const added = store.addStaffRole(guild.id, role.id);
          return edit(
            interaction,
            added
              ? okEmbed('Cargo liberado', `${role} agora pode usar os comandos do bot.`)
              : infoEmbed('Nada mudou', `${role} já estava na lista de cargos liberados.`),
          );
        }

        if (sub === 'remover') {
          const removed = store.removeStaffRole(guild.id, role.id);
          return edit(
            interaction,
            removed
              ? okEmbed('Cargo removido', `${role} não pode mais usar os comandos do bot.`)
              : infoEmbed('Nada mudou', `${role} não estava na lista.`),
          );
        }

        const cfg = store.guildConfig(guild.id);
        const list = cfg.staffRoles.length
          ? cfg.staffRoles
              .map((id) => {
                const found = guild.roles.cache.get(id);
                return found ? `${found}` : `\`${id}\` (cargo apagado)`;
              })
              .join('\n')
          : 'Nenhum cargo liberado ainda.';

        return edit(
          interaction,
          infoEmbed('Cargos liberados', `${list}\n\nAdministradores e o dono do servidor sempre podem usar o bot.`),
        );
      }

      // ------------------------------------------------- logs
      if (group === 'logs') {
        if (sub === 'definir') {
          const channel = interaction.options.getChannel('canal', true);

          if (!channel?.isTextBased()) {
            return fail(interaction, 'Canal inválido', 'Escolha um canal de texto.');
          }

          if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
            return fail(
              interaction,
              'Sem permissão',
              `Eu preciso poder enviar mensagens em ${channel} para usar como log.`,
            );
          }

          store.updateGuildConfig(guild.id, { punishChannelId: channel.id });
          return edit(
            interaction,
            okEmbed('Logs configurados', `As punições serão registradas em ${channel}.`),
          );
        }

        store.updateGuildConfig(guild.id, { punishChannelId: null });
        return edit(interaction, okEmbed('Logs desligados', 'As punições não serão mais registradas em canal.'));
      }

      // ------------------------------------------------- ver
      const cfg = store.guildConfig(guild.id);
      const active = store
        .allPunishments()
        .filter((punishment) => punishment.guildId === guild.id).length;

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('⚙️ Configuração do bot')
        .addFields(
          {
            name: 'Cargos liberados',
            value: cfg.staffRoles.length
              ? cfg.staffRoles.map((id) => `<@&${id}>`).join('\n')
              : 'Nenhum cargo liberado.',
          },
          {
            name: 'Canal de logs',
            value: cfg.punishChannelId ? `<#${cfg.punishChannelId}>` : 'Desativado',
            inline: true,
          },
          { name: 'Punições temporárias ativas', value: `${active}`, inline: true },
          {
            name: 'Automod de links',
            value: cfg.automodLinks ? 'Ligado' : 'Desligado',
            inline: true,
          },
          {
            name: 'Palavras censuradas',
            value: `${cfg.censoredWords.length}`,
            inline: true,
          },
        )
        .setFooter({ text: 'Administradores e o dono do servidor sempre podem usar o bot.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },
];

export { commands };
