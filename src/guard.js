import { PermissionFlagsBits } from 'discord.js';

/** Erro esperado: a mensagem é mostrada para quem usou o comando. */
export class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

export function assertBotPermission(guild, permission, label) {
  const me = guild.members.me;
  if (!me) throw new UserError('Não consegui verificar as minhas permissões neste servidor.');
  if (!me.permissions.has(permission)) {
    throw new UserError(`Eu preciso da permissão **${label}** neste servidor para fazer isso.`);
  }
}

export function assertNotProtected({ guild, actor, userId }) {
  if (userId === guild.client.user.id) throw new UserError('Eu não posso aplicar isso em mim mesmo.');
  if (userId === guild.ownerId) throw new UserError('Não é possível aplicar isso no dono do servidor.');
  if (userId === actor.id) throw new UserError('Você não pode aplicar isso em você mesmo.');
}

export function assertRoleHierarchy(guild, member) {
  const me = guild.members.me;
  if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
    throw new UserError(
      `O meu cargo mais alto precisa ficar acima do cargo mais alto de **${member.user.username}**.`,
    );
  }
}

export function assertCanTarget({ guild, actor, member }) {
  if (!member) throw new UserError('Esse usuário não está neste servidor.');
  assertNotProtected({ guild, actor, userId: member.id });
  if (member.user.bot) throw new UserError('Não é possível aplicar isso em um bot.');

  if (
    !actor.permissions.has(PermissionFlagsBits.Administrator) &&
    actor.roles.highest.comparePositionTo(member.roles.highest) <= 0
  ) {
    throw new UserError(`**${member.user.username}** tem um cargo igual ou mais alto que o seu.`);
  }

  assertRoleHierarchy(guild, member);
}
