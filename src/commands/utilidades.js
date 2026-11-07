import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { COLORS, TIME_EXAMPLES, TIME_HELP } from '../config.js';
import { failEmbed, infoEmbed, okEmbed } from '../ui.js';

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

const fail = (interaction, title, description) =>
  interaction.editReply({ embeds: [failEmbed(title, description)], components: [] });

const commands = [
  // ------------------------------------------------------------- ajuda
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Mostra todos os comandos do bot'),

    async run({ interaction }) {
      await defer(interaction);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📖 Comandos do bot')
        .setDescription(
          'Bot focado só em **moderação** e **utilidades**.\n' +
            'Funciona com `/` e com o prefixo `z?`.\n' +
            'Só usa quem tem um dos **cargos liberados** (Administradores e o dono do servidor sempre podem).',
        )
        .addFields(
          {
            name: '🛡️ Moderação',
            value:
              '`/ban` `/unban` `/kick`\n' +
              '`/mute` `/unmute`\n' +
              '`/warn` `/warnings` `/clearwarns`\n' +
              '`/clear` `/lock` `/unlock` `/slowmode`\n' +
              '`/setcargo` `/nick`\n' +
              '`/censura` `/automod`',
          },
          {
            name: '⚡ fastpuni',
            value:
              '`/fastpuni` aplica ban, tempban, mute, kick, warn, unban ou limpeza de avisos **sem perguntar Sim/Não**.',
          },
          {
            name: '🧰 Utilidades',
            value:
              '`/help` `/ping` `/userinfo` `/serverinfo` `/avatar`\n' +
              '`/say` `/anuncio`\n' +
              '`/rankcall` — ranking de tempo em call (todos podem usar)\n' +
              '`/config` — cargos, logs, automod e censura (Administrador)',
          },
          {
            name: '🎨 Emojis e figurinhas',
            value: '`/criaremoji` `/criarfigurinha`',
          },
          {
            name: '⌨️ Prefixo z?',
            value:
              'Também funciona sem barra: `z?ban @Fulano 1d Flood`, `z?mute @Fulano 30min`, `z?fastpuni mute @Fulano 1h`.\n' +
              'Para textos com espaço, use aspas: `z?say "Bom dia a todos"`.',
          },
          {
            name: '⏱️ Formato de tempo',
            value: `${TIME_HELP}\n${TIME_EXAMPLES}`,
          },
        )
        .setFooter({ text: 'As punições pedem confirmação antes de aplicar.' });

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------- ping
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Mostra a latência do bot'),

    async run({ interaction, client }) {
      await defer(interaction);
      const start = Date.now();
      await interaction.editReply({ embeds: [infoEmbed('Calculando...', 'Um instante.')] });
      const roundtrip = Date.now() - start;

      await edit(
        interaction,
        okEmbed(
          'Pong!',
          `**WebSocket:** ${Math.round(client.ws.ping)}ms\n**Resposta:** ${roundtrip}ms`,
        ),
      );
    },
  },

  // ------------------------------------------------------------- usuário
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Mostra informações de um usuário')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Usuário consultado').setRequired(false),
      ),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario') || interaction.user;
      const member =
        guild.members.cache.get(user.id) ||
        (await guild.members.fetch(user.id).catch(() => null));

      const warns = store.countWarns(guild.id, user.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`👤 ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'ID', value: `\`${user.id}\``, inline: true },
          {
            name: 'Conta criada',
            value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
            inline: true,
          },
          { name: 'Avisos', value: `${warns}`, inline: true },
        );

      if (member) {
        embed.addFields(
          {
            name: 'Entrou no servidor',
            value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
            inline: true,
          },
          { name: 'Cargo mais alto', value: `${member.roles.highest}`, inline: true },
          {
            name: 'Silenciado',
            value: member.isCommunicationDisabled()
              ? `Sim, até <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
              : 'Não',
            inline: true,
          },
          {
            name: `Cargos (${Math.max(member.roles.cache.size - 1, 0)})`,
            value:
              member.roles.cache.size > 1
                ? member.roles.cache
                    .filter((role) => role.id !== guild.id)
                    .map((role) => `${role}`)
                    .slice(0, 15)
                    .join(' ')
                : 'Nenhum',
          },
        );
      } else {
        embed.addFields({ name: 'Servidor', value: 'Não está neste servidor' });
      }

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------- servidor
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('serverinfo')
      .setDescription('Mostra informações do servidor'),

    async run({ interaction, guild }) {
      await defer(interaction);

      const owner = await guild.fetchOwner().catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`🏠 ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: 'ID', value: `\`${guild.id}\``, inline: true },
          { name: 'Dono', value: owner ? `${owner.user}` : 'Desconhecido', inline: true },
          {
            name: 'Criado em',
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`,
            inline: true,
          },
          { name: 'Membros', value: `${guild.memberCount}`, inline: true },
          { name: 'Canais', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Cargos', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Impulsos', value: `Nível ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0})`, inline: true },
          { name: 'Verificação', value: `${guild.verificationLevel}`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------- avatar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('Mostra o avatar de um usuário')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Usuário').setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName('servidor')
          .setDescription('Mostrar o avatar do servidor em vez do global')
          .setRequired(false),
      ),

    async run({ interaction, guild }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario') || interaction.user;
      const serverAvatar = interaction.options.getBoolean('servidor') || false;

      let url = user.displayAvatarURL({ size: 1024 });
      if (serverAvatar) {
        const member =
          guild.members.cache.get(user.id) ||
          (await guild.members.fetch(user.id).catch(() => null));
        if (member?.avatar) url = member.displayAvatarURL({ size: 1024 });
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`🖼️ Avatar de ${user.username}`)
        .setImage(url)
        .setDescription(`[Abrir imagem em tamanho real](${url})`);

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------- falar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('say')
      .setDescription('Faz o bot enviar uma mensagem')
      .addStringOption((option) =>
        option.setName('texto').setDescription('Mensagem').setRequired(true).setMaxLength(2000),
      )
      .addChannelOption((option) =>
        option.setName('canal').setDescription('Canal de destino').setRequired(false),
      ),

    async run({ interaction, guild }) {
      await defer(interaction);

      const text = interaction.options.getString('texto', true);
      const channel = interaction.options.getChannel('canal') || interaction.channel;

      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Escolha um canal de texto.');
      }

      if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        return fail(interaction, 'Sem permissão', `Eu não consigo enviar mensagens em ${channel}.`);
      }

      const message = await channel.send({
        content: text,
        allowedMentions: { parse: [] },
      });

      await edit(
        interaction,
        okEmbed('Mensagem enviada', `[Ver mensagem](${message.url}) em ${channel}.`),
      );
    },
  },

  // ------------------------------------------------------------- anúncio
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('anuncio')
      .setDescription('Envia um anúncio em embed')
      .addStringOption((option) =>
        option.setName('titulo').setDescription('Título').setRequired(true).setMaxLength(256),
      )
      .addStringOption((option) =>
        option.setName('texto').setDescription('Texto do anúncio').setRequired(true).setMaxLength(4000),
      )
      .addChannelOption((option) =>
        option.setName('canal').setDescription('Canal de destino').setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('cor')
          .setDescription('Cor da barra lateral')
          .setRequired(false)
          .addChoices(
            { name: 'Azul', value: 'azul' },
            { name: 'Verde', value: 'verde' },
            { name: 'Vermelho', value: 'vermelho' },
            { name: 'Amarelo', value: 'amarelo' },
            { name: 'Cinza', value: 'cinza' },
          ),
      ),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const title = interaction.options.getString('titulo', true);
      const text = interaction.options.getString('texto', true);
      const channel = interaction.options.getChannel('canal') || interaction.channel;
      const colorName = interaction.options.getString('cor') || 'azul';

      const palette = {
        azul: COLORS.info,
        verde: COLORS.ok,
        vermelho: COLORS.error,
        amarelo: COLORS.warn,
        cinza: COLORS.neutral,
      };

      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Escolha um canal de texto.');
      }

      if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        return fail(interaction, 'Sem permissão', `Eu não consigo enviar mensagens em ${channel}.`);
      }

      const embed = new EmbedBuilder()
        .setColor(palette[colorName] ?? COLORS.info)
        .setTitle(title)
        .setDescription(text)
        .setFooter({ text: `Enviado por ${actor.user.username}` })
        .setTimestamp();

      const message = await channel.send({ embeds: [embed] });

      await edit(
        interaction,
        okEmbed('Anúncio enviado', `[Ver anúncio](${message.url}) em ${channel}.`),
      );
    },
  },
];

export { commands };
