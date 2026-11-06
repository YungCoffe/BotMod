import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits } from 'discord.js';
import { COLORS } from './config.js';
import { UserError, assertBotPermission, assertCanTarget } from './guard.js';
import { okEmbed, warnEmbed, tryDm } from './ui.js';
import { applyMute, clearMute, MAX_TIMEOUT_MS } from './punish.js';
import { logAction, punishmentEmbed } from './logger.js';

const cleanReason = (reason) => (reason || '').trim() || 'Não informado';

const audit = (actor, reason) =>
  `${actor.user.username} (${actor.id}): ${reason}`.slice(0, 512);

function assertNotProtected({ guild, actor, userId }) {
  if (userId === guild.client.user.id) throw new UserError('Eu não posso aplicar isso em mim mesmo.');
  if (userId === guild.ownerId) throw new UserError('Não é possível aplicar isso no dono do servidor.');
  if (userId === actor.id) throw new UserError('Você não pode aplicar isso em você mesmo.');
}

// ---------------------------------------------------------------- permissões

export function guardBan({ guild, actor, user, member }) {
  assertBotPermission(guild, PermissionFlagsBits.BanMembers, 'Banir Membros');
  assertNotProtected({ guild, actor, userId: user.id });
  if (member) assertCanTarget({ guild, actor, member });
}

export function guardKick({ guild, actor, member }) {
  assertBotPermission(guild, PermissionFlagsBits.KickMembers, 'Expulsar Membros');
  assertCanTarget({ guild, actor, member });
}

export function guardMute({ guild, actor, member }) {
  assertBotPermission(guild, PermissionFlagsBits.ModerateMembers, 'Silenciar Membros');
  assertCanTarget({ guild, actor, member });
}

export function guardWarn({ guild, actor, user, member }) {
  assertNotProtected({ guild, actor, userId: user.id });
  if (member) assertCanTarget({ guild, actor, member });
}

export function guardUnban({ guild, actor, userId }) {
  assertBotPermission(guild, PermissionFlagsBits.BanMembers, 'Banir Membros');
  assertNotProtected({ guild, actor, userId });
}

export function guardRole({ guild, actor, role, member }) {
  assertBotPermission(guild, PermissionFlagsBits.ManageRoles, 'Gerenciar Cargos');
  assertCanTarget({ guild, actor, member });

  if (role.id === guild.id) throw new UserError('O cargo @everyone não pode ser gerenciado.');
  if (role.managed) {
    throw new UserError('Esse cargo é de uma integração e não pode ser atribuído manualmente.');
  }

  const me = guild.members.me;
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    throw new UserError(`O meu cargo mais alto precisa ficar acima de **${role.name}**.`);
  }

  if (
    !actor.permissions.has(PermissionFlagsBits.Administrator) &&
    actor.roles.highest.comparePositionTo(role) <= 0
  ) {
    throw new UserError(`Você não pode gerenciar **${role.name}** (ele está acima do seu cargo).`);
  }
}

export function guardNickname({ guild, actor, member }) {
  assertBotPermission(guild, PermissionFlagsBits.ManageNicknames, 'Gerenciar Apelidos');

  if (member.id === guild.client.user.id) throw new UserError('Eu não posso alterar o meu próprio apelido.');
  if (member.id === guild.ownerId) {
    throw new UserError('O apelido do dono do servidor não pode ser alterado.');
  }

  const me = guild.members.me;
  if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    throw new UserError(
      `O meu cargo mais alto precisa ficar acima do cargo de **${member.user.username}**.`,
    );
  }

  if (
    !actor.permissions.has(PermissionFlagsBits.Administrator) &&
    actor.roles.highest.comparePositionTo(member.roles.highest) <= 0
  ) {
    throw new UserError(`**${member.user.username}** tem um cargo igual ou mais alto que o seu.`);
  }
}

// ---------------------------------------------------------------- punições

export async function ban({ client, guild, actor, cfg, store, user, member, duration, reason }) {
  guardBan({ guild, actor, user, member });
  const motivo = cleanReason(reason);

  await tryDm(
    user,
    warnEmbed(
      'Você foi banido',
      [
        `**Servidor:** ${guild.name}`,
        `**Motivo:** ${motivo}`,
        `**Duração:** ${duration ? duration.text : 'permanente'}`,
      ].join('\n'),
    ),
  );

  try {
    await guild.bans.create(user.id, { reason: audit(actor, motivo) });
  } catch (error) {
    if (error.code === 50035 || error.code === 10013) {
      throw new UserError('Não consegui banir esse usuário. Ele já pode estar banido.');
    }
    throw error;
  }

  if (duration) {
    store.addPunishment({
      type: 'ban',
      guildId: guild.id,
      userId: user.id,
      expiresAt: Date.now() + duration.ms,
      reason: motivo,
      moderatorId: actor.id,
    });
  }

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.error,
      action: 'Banimento',
      targetName: user.username,
      targetId: user.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: motivo,
      duration: duration ? duration.text : 'Permanente',
      footer: duration ? 'Será desbanido automaticamente' : undefined,
    }),
  );

  return okEmbed(
    'Banimento aplicado',
    [
      `**Usuário:** ${user.username} (\`${user.id}\`)`,
      `**Motivo:** ${motivo}`,
      `**Duração:** ${duration ? duration.text : 'permanente'}`,
      duration ? '\n⏳ O banimento será removido automaticamente quando o tempo acabar.' : '',
    ].join('\n'),
  );
}

export async function kick({ client, guild, actor, cfg, member, reason }) {
  guardKick({ guild, actor, member });
  const motivo = cleanReason(reason);

  await tryDm(
    member.user,
    warnEmbed('Você foi expulso', `**Servidor:** ${guild.name}\n**Motivo:** ${motivo}`),
  );

  await member.kick(audit(actor, motivo));

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.warn,
      action: 'Expulsão',
      targetName: member.user.username,
      targetId: member.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: motivo,
    }),
  );

  return okEmbed(
    'Expulsão aplicada',
    `**Usuário:** ${member.user.username} (\`${member.id}\`)\n**Motivo:** ${motivo}`,
  );
}

export async function mute({ client, guild, actor, cfg, store, member, duration, reason }) {
  guardMute({ guild, actor, member });
  if (!duration || duration.ms < 1000) {
    throw new UserError('Informe um tempo válido para o silenciamento.');
  }

  const motivo = cleanReason(reason);

  await applyMute(member, duration.ms, audit(actor, motivo));

  store.addPunishment({
    type: 'mute',
    guildId: guild.id,
    userId: member.id,
    expiresAt: Date.now() + duration.ms,
    reason: motivo,
    moderatorId: actor.id,
  });

  await tryDm(
    member.user,
    warnEmbed(
      'Você foi silenciado',
      `**Servidor:** ${guild.name}\n**Motivo:** ${motivo}\n**Duração:** ${duration.text}`,
    ),
  );

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.warn,
      action: 'Silenciamento',
      targetName: member.user.username,
      targetId: member.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: motivo,
      duration: duration.text,
      footer: duration.ms > MAX_TIMEOUT_MS ? 'Renovado automaticamente a cada 28 dias' : undefined,
    }),
  );

  return okEmbed(
    'Silenciamento aplicado',
    [
      `**Usuário:** ${member.user.username} (\`${member.id}\`)`,
      `**Motivo:** ${motivo}`,
      `**Duração:** ${duration.text}`,
      duration.ms > MAX_TIMEOUT_MS
        ? '\n⏳ O Discord limita o silenciamento a 28 dias por vez, então eu renovo automaticamente até o fim do prazo.'
        : '',
    ].join('\n'),
  );
}

export async function unmute({ client, guild, actor, cfg, store, member }) {
  assertBotPermission(guild, PermissionFlagsBits.ModerateMembers, 'Silenciar Membros');
  if (!member) throw new UserError('Esse usuário não está no servidor.');
  if (member.id === guild.client.user.id) throw new UserError('Eu não posso fazer isso em mim mesmo.');

  await clearMute(member, audit(actor, 'Silenciamento removido'));
  store.clearPunishments(guild.id, member.id, 'mute');

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.ok,
      action: 'Silenciamento removido',
      targetName: member.user.username,
      targetId: member.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: 'Removido manualmente',
    }),
  );

  return okEmbed(
    'Silenciamento removido',
    `**${member.user.username}** já pode falar novamente.`,
  );
}

export async function unban({ client, guild, actor, cfg, store, userId, reason }) {
  guardUnban({ guild, actor, userId });

  const banInfo = await guild.bans.fetch(userId).catch(() => null);
  if (!banInfo) throw new UserError('Esse usuário não está banido.');

  await guild.bans.remove(userId, audit(actor, cleanReason(reason)));
  store.clearPunishments(guild.id, userId, 'ban');

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.ok,
      action: 'Banimento removido',
      targetName: banInfo.user.username,
      targetId: userId,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: cleanReason(reason),
    }),
  );

  return okEmbed('Banimento removido', `**${banInfo.user.username}** foi desbanido.`);
}

export async function warn({ client, guild, actor, cfg, store, user, member, reason }) {
  guardWarn({ guild, actor, user, member });
  const motivo = cleanReason(reason);

  const warning = {
    id: `W-${randomUUID().slice(0, 6)}`,
    reason: motivo,
    moderatorId: actor.id,
    createdAt: Date.now(),
  };

  store.addWarn(guild.id, user.id, warning);

  await tryDm(
    user,
    warnEmbed('Você recebeu um aviso', `**Servidor:** ${guild.name}\n**Motivo:** ${motivo}`),
  );

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.warn,
      action: 'Aviso',
      targetName: user.username,
      targetId: user.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: motivo,
      duration: undefined,
      footer: `Aviso ${warning.id}`,
    }),
  );

  const total = store.countWarns(guild.id, user.id);

  return okEmbed(
    'Aviso registrado',
    `**Usuário:** ${user.username} (\`${user.id}\`)\n**Motivo:** ${motivo}\n**Aviso:** \`${warning.id}\`\n**Total de avisos:** ${total}`,
  );
}

export async function clearWarns({ client, guild, actor, cfg, store, user }) {
  const total = store.clearWarns(guild.id, user.id);
  if (!total) throw new UserError('Esse usuário não tem avisos.');

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.ok,
      action: 'Avisos apagados',
      targetName: user.username,
      targetId: user.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: `${total} aviso(s) removido(s)`,
    }),
  );

  return okEmbed(
    'Avisos apagados',
    `**${user.username}** não tem mais avisos (${total} removido(s)).`,
  );
}

export async function toggleRole({ client, guild, actor, cfg, member, role }) {
  guardRole({ guild, actor, role, member });

  const hadRole = member.roles.cache.has(role.id);

  if (hadRole) {
    await member.roles.remove(role, audit(actor, 'Remoção de cargo'));
  } else {
    await member.roles.add(role, audit(actor, 'Atribuição de cargo'));
  }

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.info,
      action: hadRole ? 'Cargo removido' : 'Cargo adicionado',
      targetName: member.user.username,
      targetId: member.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: `${hadRole ? 'Removido' : 'Adicionado'} o cargo ${role.name}`,
    }),
  );

  return okEmbed(
    hadRole ? 'Cargo removido' : 'Cargo adicionado',
    `**${member.user.username}** ${hadRole ? 'não tem mais' : 'agora tem'} o cargo ${role}.`,
  );
}

export async function setNickname({ client, guild, actor, cfg, member, nickname }) {
  guardNickname({ guild, actor, member });

  const next = (nickname || '').trim();
  await member.setNickname(next || null, audit(actor, 'Alteração de apelido'));

  await logAction(
    client,
    guild.id,
    cfg,
    punishmentEmbed({
      color: COLORS.info,
      action: 'Apelido alterado',
      targetName: member.user.username,
      targetId: member.id,
      actorName: actor.user.username,
      actorId: actor.id,
      reason: next ? `Novo apelido: ${next}` : 'Apelido restaurado',
    }),
  );

  return okEmbed(
    'Apelido alterado',
    `**${member.user.username}** agora aparece como **${next || member.user.username}**.`,
  );
}
