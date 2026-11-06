import { PermissionFlagsBits } from 'discord.js';

/** Dono do servidor ou alguém com Administrador. */
export function isAdmin(member) {
  if (!member) return false;
  return member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator);
}

/** Quem pode usar o bot: Administrador/dono OU um dos cargos liberados. */
export function isStaff(member, cfg) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  const allowed = cfg?.staffRoles || [];
  return allowed.some((roleId) => member.roles.cache.has(roleId));
}

/** Devolve a mensagem de acesso negado, ou null se puder usar. */
export function accessError(command, member, cfg) {
  if (command.adminOnly && !isAdmin(member)) {
    return 'Esse comando é só para **Administradores** do servidor.';
  }

  if (command.staffOnly && !isStaff(member, cfg)) {
    return (
      'Você não tem um dos **cargos liberados** para usar o bot.\n' +
      'Peça a um Administrador para configurar com `/config cargo adicionar`.'
    );
  }

  return null;
}
