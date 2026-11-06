import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { TIME_EXAMPLES, TIME_HELP } from '../config.js';
import { parseDuration } from '../time.js';
import { ask, failEmbed, infoEmbed, okEmbed } from '../ui.js';
import { UserError, assertBotPermission } from '../guard.js';
import * as actions from '../actions.js';

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

const fail = (interaction, title, description) =>
  interaction.editReply({ embeds: [failEmbed(title, description)], components: [] });

async function findMember(guild, user) {
  return (
    guild.members.cache.get(user.id) ||
    (await guild.members.fetch(user.id).catch(() => null))
  );
}

function invalidTime(interaction) {
  return fail(
    interaction,
    'Tempo inválido',
    `${TIME_HELP}\n\nExemplos: ${TIME_EXAMPLES}`,
  );
}

const audit = (actor, text) => `${actor.user.username} (${actor.id}): ${text}`.slice(0, 512);

const commands = [
  // ------------------------------------------------------------- banir
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bane um membro (com tempo vira banimento temporário)')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Quem será banido').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('tempo')
          .setDescription('Tempo: 1s, 10min, 1h, 1d, 1sem, 1mes, 1a')
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo do banimento')
          .setRequired(false)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const rawTime = interaction.options.getString('tempo');
      const reason = interaction.options.getString('motivo') || 'Não informado';

      let duration = null;
      if (rawTime) {
        duration = parseDuration(rawTime);
        if (!duration) return invalidTime(interaction);
      }

      const member = await findMember(guild, user);

      try {
        actions.guardBan({ guild, actor, user, member });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar banimento?',
        lines: [
          `**Usuário:** ${user.username} (\`${user.id}\`)`,
          `**Tipo:** ${duration ? `temporário — ${duration.text}` : 'permanente'}`,
          `**Motivo:** ${reason}`,
        ],
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.ban({ client, guild, actor, cfg, store, user, member, duration, reason }),
      );
    },
  },

  // ------------------------------------------------------------- desbanir
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Remove o banimento de um usuário pelo ID')
      .addStringOption((option) =>
        option.setName('id').setDescription('ID do usuário banido').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo')
          .setRequired(false)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const userId = (interaction.options.getString('id', true) || '').trim();
      const reason = interaction.options.getString('motivo') || 'Não informado';

      if (!/^\d{15,25}$/.test(userId)) {
        return fail(
          interaction,
          'ID inválido',
          'Copie o ID numérico do usuário (clique com o botão direito > **Copiar ID**).',
        );
      }

      try {
        actions.guardUnban({ guild, actor, userId });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const banInfo = await guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) return fail(interaction, 'Não está banido', 'Esse usuário não está banido.');

      const confirmed = await ask(interaction, {
        title: 'Confirmar remoção do banimento?',
        lines: [
          `**Usuário:** ${banInfo.user.username} (\`${userId}\`)`,
          `**Motivo:** ${reason}`,
        ],
        confirmLabel: 'Sim, desbanir',
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.unban({ client, guild, actor, cfg, store, userId, reason }),
      );
    },
  },

  // ------------------------------------------------------------- expulsar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Expulsa um membro do servidor')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Quem será expulso').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo da expulsão')
          .setRequired(false)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const reason = interaction.options.getString('motivo') || 'Não informado';

      const member = await findMember(guild, user);
      if (!member) {
        return fail(interaction, 'Não está no servidor', 'Esse usuário não está neste servidor.');
      }

      try {
        actions.guardKick({ guild, actor, member });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar expulsão?',
        lines: [
          `**Usuário:** ${member.user.username} (\`${member.id}\`)`,
          `**Motivo:** ${reason}`,
        ],
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.kick({ client, guild, actor, cfg, member, reason }),
      );
    },
  },

  // ------------------------------------------------------------- silenciar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Silencia um membro por um tempo determinado')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Quem será silenciado').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('tempo')
          .setDescription('Tempo: 30s, 10min, 1h, 1d, 1sem, 1mes, 1a')
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo do silenciamento')
          .setRequired(false)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const rawTime = interaction.options.getString('tempo', true);
      const reason = interaction.options.getString('motivo') || 'Não informado';

      const duration = parseDuration(rawTime);
      if (!duration) return invalidTime(interaction);
      if (duration.ms < 1000) {
        return fail(interaction, 'Tempo inválido', 'O tempo mínimo é **1 segundo**.');
      }

      const member = await findMember(guild, user);
      if (!member) {
        return fail(interaction, 'Não está no servidor', 'Esse usuário não está neste servidor.');
      }

      try {
        actions.guardMute({ guild, actor, member });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar silenciamento?',
        lines: [
          `**Usuário:** ${member.user.username} (\`${member.id}\`)`,
          `**Duração:** ${duration.text}`,
          `**Motivo:** ${reason}`,
        ],
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.mute({ client, guild, actor, cfg, store, member, duration, reason }),
      );
    },
  },

  // ------------------------------------------------------------- remover mute
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Remove o silenciamento de um membro')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Quem será liberado').setRequired(true),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const member = await findMember(guild, user);

      if (!member) {
        return fail(interaction, 'Não está no servidor', 'Esse usuário não está neste servidor.');
      }

      await edit(
        interaction,
        await actions.unmute({ client, guild, actor, cfg, store, member }),
      );
    },
  },

  // ------------------------------------------------------------- aviso
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Registra um aviso para um membro')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Quem recebe o aviso').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo do aviso')
          .setRequired(true)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const reason = interaction.options.getString('motivo', true);
      const member = await findMember(guild, user);

      try {
        actions.guardWarn({ guild, actor, user, member });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar aviso?',
        lines: [
          `**Usuário:** ${user.username} (\`${user.id}\`)`,
          `**Motivo:** ${reason}`,
        ],
        confirmLabel: 'Sim, avisar',
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.warn({ client, guild, actor, cfg, store, user, member, reason }),
      );
    },
  },

  // ------------------------------------------------------------- ver avisos
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('Mostra os avisos de um membro')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Usuário consultado').setRequired(true),
      ),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const list = store.listWarns(guild.id, user.id);

      if (!list.length) {
        return edit(
          interaction,
          infoEmbed('Sem avisos', `**${user.username}** não tem nenhum aviso registrado.`),
        );
      }

      const lines = [...list]
        .reverse()
        .slice(0, 10)
        .map(
          (warning) =>
            `**${warning.id}** — <t:${Math.floor(warning.createdAt / 1000)}:d> — ${warning.reason} — por <@${warning.moderatorId}>`,
        );

      await edit(
        interaction,
        infoEmbed(
          `Avisos de ${user.username}`,
          `${lines.join('\n')}\n\n**Total:** ${list.length}`,
        ),
      );
    },
  },

  // ------------------------------------------------------------- limpar avisos
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('clearwarns')
      .setDescription('Apaga todos os avisos de um membro')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Usuário').setRequired(true),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);

      if (!store.countWarns(guild.id, user.id)) {
        return fail(interaction, 'Sem avisos', `**${user.username}** não tem avisos para apagar.`);
      }

      const confirmed = await ask(interaction, {
        title: 'Apagar todos os avisos?',
        lines: [
          `**Usuário:** ${user.username} (\`${user.id}\`)`,
          `**Avisos atuais:** ${store.countWarns(guild.id, user.id)}`,
        ],
        confirmLabel: 'Sim, apagar',
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.clearWarns({ client, guild, actor, cfg, store, user }),
      );
    },
  },

  // ------------------------------------------------------------- limpar mensagens
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Apaga mensagens do canal atual')
      .addIntegerOption((option) =>
        option
          .setName('quantidade')
          .setDescription('Quantas mensagens apagar (1 a 1000)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000),
      )
      .addUserOption((option) =>
        option
          .setName('usuario')
          .setDescription('Apagar somente as mensagens deste usuário')
          .setRequired(false),
      ),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const amount = interaction.options.getInteger('quantidade', true);
      const target = interaction.options.getUser('usuario');
      const channel = interaction.channel;

      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Use este comando em um canal de texto.');
      }

      try {
        assertBotPermission(guild, PermissionFlagsBits.ManageMessages, 'Gerenciar Mensagens');
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar limpeza?',
        lines: [
          `**Canal:** ${channel}`,
          `**Quantidade:** até ${amount} mensagem(ns)`,
          `**Filtro:** ${target ? `somente mensagens de ${target.username}` : 'todas as mensagens'}`,
          '',
          'Mensagens com mais de 14 dias não podem ser apagadas em massa.',
        ],
        confirmLabel: 'Sim, apagar',
      });
      if (!confirmed) return;

      let remaining = amount;
      let deleted = 0;
      let rounds = 0;

      while (remaining > 0 && rounds < 12) {
        rounds += 1;

        const batch = await channel.messages
          .fetch({ limit: Math.min(remaining, 100) })
          .catch(() => null);
        if (!batch?.size) break;

        let messages = [...batch.values()];
        if (target) messages = messages.filter((message) => message.author.id === target.id);
        if (!messages.length) break;

        const result = await channel.bulkDelete(messages, true).catch(() => null);
        if (!result?.size) break;

        deleted += result.size;
        remaining -= result.size;
      }

      await edit(
        interaction,
        okEmbed(
          'Limpeza concluída',
          `**${deleted}** mensagem(ns) apagada(s) em ${channel}.`,
        ),
      );
    },
  },

  // ------------------------------------------------------------- trancar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Tranca o canal atual (ninguém envia mensagens)'),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Use este comando em um canal de texto.');
      }

      try {
        assertBotPermission(guild, PermissionFlagsBits.ManageChannels, 'Gerenciar Canais');
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar trancamento do canal?',
        lines: [`**Canal:** ${channel}`],
        confirmLabel: 'Sim, trancar',
      });
      if (!confirmed) return;

      await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        { SendMessages: false, SendMessagesInThreads: false },
        { reason: audit(actor, 'Canal trancado') },
      );

      await edit(interaction, okEmbed('Canal trancado', `${channel} está fechado para mensagens.`));
    },
  },

  // ------------------------------------------------------------- destrancar
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Destranca o canal atual'),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Use este comando em um canal de texto.');
      }

      try {
        assertBotPermission(guild, PermissionFlagsBits.ManageChannels, 'Gerenciar Canais');
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const confirmed = await ask(interaction, {
        title: 'Confirmar destrancamento do canal?',
        lines: [`**Canal:** ${channel}`],
        confirmLabel: 'Sim, destrancar',
      });
      if (!confirmed) return;

      await channel.permissionOverwrites.edit(
        guild.roles.everyone,
        { SendMessages: null, SendMessagesInThreads: null },
        { reason: audit(actor, 'Canal destrancado') },
      );

      await edit(interaction, okEmbed('Canal destrancado', `${channel} voltou a aceitar mensagens.`));
    },
  },

  // ------------------------------------------------------------- modo lento
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('Define o modo lento do canal atual')
      .addStringOption((option) =>
        option
          .setName('tempo')
          .setDescription('Tempo: 5s, 30s, 1min, 10min — ou "off" para desligar')
          .setRequired(true),
      ),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const channel = interaction.channel;
      if (!channel?.isTextBased()) {
        return fail(interaction, 'Canal inválido', 'Use este comando em um canal de texto.');
      }

      try {
        assertBotPermission(guild, PermissionFlagsBits.ManageChannels, 'Gerenciar Canais');
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const parsed = parseDuration(interaction.options.getString('tempo', true));
      if (!parsed) return invalidTime(interaction);

      if (parsed.seconds > 21600) {
        return fail(
          interaction,
          'Tempo grande demais',
          'O modo lento do Discord aceita no máximo **6 horas**.',
        );
      }

      await channel.setRateLimitPerUser(
        parsed.seconds,
        audit(actor, 'Modo lento alterado'),
      );

      await edit(
        interaction,
        okEmbed(
          'Modo lento atualizado',
          parsed.seconds
            ? `${channel} agora aceita uma mensagem a cada **${parsed.text}**.`
            : `O modo lento de ${channel} foi **desligado**.`,
        ),
      );
    },
  },

  // ------------------------------------------------------------- cargo
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('setcargo')
      .setDescription('Adiciona ou remove um cargo de um membro')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Membro').setRequired(true),
      )
      .addRoleOption((option) =>
        option.setName('cargo').setDescription('Cargo a adicionar/remover').setRequired(true),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const role = interaction.options.getRole('cargo', true);
      const member = await findMember(guild, user);

      if (!member) {
        return fail(interaction, 'Não está no servidor', 'Esse usuário não está neste servidor.');
      }

      try {
        actions.guardRole({ guild, actor, role, member });
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }

      const willAdd = !member.roles.cache.has(role.id);

      const confirmed = await ask(interaction, {
        title: willAdd ? 'Confirmar adição de cargo?' : 'Confirmar remoção de cargo?',
        lines: [
          `**Usuário:** ${member.user.username} (\`${member.id}\`)`,
          `**Cargo:** ${role}`,
          `**Ação:** ${willAdd ? 'adicionar' : 'remover'}`,
        ],
        confirmLabel: willAdd ? 'Sim, adicionar' : 'Sim, remover',
      });
      if (!confirmed) return;

      await edit(
        interaction,
        await actions.toggleRole({ client, guild, actor, cfg, member, role }),
      );
    },
  },

  // ------------------------------------------------------------- apelido
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('nick')
      .setDescription('Altera o apelido de um membro (vazio = restaurar)')
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Membro').setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('apelido')
          .setDescription('Novo apelido (deixe vazio para restaurar)')
          .setRequired(false)
          .setMaxLength(32),
      ),

    async run({ interaction, guild, client, actor, cfg }) {
      await defer(interaction);

      const user = interaction.options.getUser('usuario', true);
      const nickname = interaction.options.getString('apelido') || '';
      const member = await findMember(guild, user);

      if (!member) {
        return fail(interaction, 'Não está no servidor', 'Esse usuário não está neste servidor.');
      }

      await edit(
        interaction,
        await actions.setNickname({ client, guild, actor, cfg, member, nickname }),
      );
    },
  },

  // ------------------------------------------------------------- fastpuni
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('fastpuni')
      .setDescription('Aplica uma punição na hora, sem pedir confirmação')
      .addStringOption((option) =>
        option
          .setName('acao')
          .setDescription('Qual punição aplicar')
          .setRequired(true)
          .addChoices(
            { name: 'Banir (permanente)', value: 'ban' },
            { name: 'Banir temporariamente', value: 'tempban' },
            { name: 'Silenciar (mute)', value: 'mute' },
            { name: 'Expulsar (kick)', value: 'kick' },
            { name: 'Avisar (warn)', value: 'warn' },
            { name: 'Remover banimento', value: 'unban' },
            { name: 'Limpar avisos', value: 'clearwarns' },
          ),
      )
      .addUserOption((option) =>
        option.setName('usuario').setDescription('Membro ou usuário').setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('id')
          .setDescription('ID do usuário (para quem não está no servidor)')
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('tempo')
          .setDescription('Tempo: 1s, 10min, 1h, 1d, 1sem, 1mes, 1a')
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('motivo')
          .setDescription('Motivo')
          .setRequired(false)
          .setMaxLength(300),
      ),

    async run({ interaction, guild, client, store, actor, cfg }) {
      await defer(interaction);

      const action = interaction.options.getString('acao', true);
      const picked = interaction.options.getUser('usuario');
      const rawId = (interaction.options.getString('id') || '').trim();
      const rawTime = interaction.options.getString('tempo');
      const reason =
        (interaction.options.getString('motivo') || '').trim() || 'Não informado (fastpuni)';

      const userId = picked?.id || rawId;
      if (!userId) {
        return fail(interaction, 'Faltou o usuário', 'Informe **usuario** ou **id**.');
      }
      if (!/^\d{15,25}$/.test(userId)) {
        return fail(
          interaction,
          'ID inválido',
          'Copie o ID numérico do usuário (clique com o botão direito > **Copiar ID**).',
        );
      }

      let user;
      try {
        user = picked || (await client.users.fetch(userId));
      } catch {
        return fail(interaction, 'Usuário não encontrado', 'Não achei nenhum usuário com esse ID.');
      }

      const member = await findMember(guild, user);

      let duration = null;
      if (rawTime) {
        duration = parseDuration(rawTime);
        if (!duration) return invalidTime(interaction);
      }

      try {
        switch (action) {
          case 'ban':
            if (duration) {
              throw new UserError(
                'Para banimento com tempo, use a ação **Banir temporariamente**.',
              );
            }
            return edit(
              interaction,
              await actions.ban({
                client, guild, actor, cfg, store, user, member, duration: null, reason,
              }),
            );

          case 'tempban':
            if (!duration) throw new UserError('Informe o **tempo** (ex.: `1d`).');
            if (duration.ms < 1000) throw new UserError('O tempo mínimo é **1 segundo**.');
            return edit(
              interaction,
              await actions.ban({
                client, guild, actor, cfg, store, user, member, duration, reason,
              }),
            );

          case 'mute':
            if (!duration) throw new UserError('Informe o **tempo** (ex.: `10min`).');
            if (duration.ms < 1000) throw new UserError('O tempo mínimo é **1 segundo**.');
            return edit(
              interaction,
              await actions.mute({
                client, guild, actor, cfg, store, member, duration, reason,
              }),
            );

          case 'kick':
            if (!member) throw new UserError('Esse usuário não está no servidor.');
            return edit(
              interaction,
              await actions.kick({ client, guild, actor, cfg, member, reason }),
            );

          case 'warn':
            return edit(
              interaction,
              await actions.warn({
                client, guild, actor, cfg, store, user, member, reason,
              }),
            );

          case 'unban':
            return edit(
              interaction,
              await actions.unban({ client, guild, actor, cfg, store, userId, reason }),
            );

          case 'clearwarns':
            return edit(
              interaction,
              await actions.clearWarns({ client, guild, actor, cfg, store, user }),
            );

          default:
            throw new UserError('Ação desconhecida.');
        }
      } catch (error) {
        if (error instanceof UserError) return fail(interaction, 'Não foi possível', error.message);
        throw error;
      }
    },
  },
];

export { commands };
