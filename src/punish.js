import { EmbedBuilder } from 'discord.js';
import { COLORS } from './config.js';
import { logAction } from './logger.js';

/** O Discord aceita, no máximo, 28 dias de timeout por vez. */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export async function applyMute(member, durationMs, reason) {
  const chunk = Math.min(durationMs, MAX_TIMEOUT_MS);
  await member.timeout(chunk, reason);
}

export async function clearMute(member, reason) {
  if (member.isCommunicationDisabled()) await member.timeout(null, reason);
}

let running = false;

/** Verifica de minuto em minuto punições que expiraram (e renova mutes longos). */
export function startScheduler(client, store) {
  const run = async () => {
    if (running) return; // não deixa duas verificações rodarem ao mesmo tempo
    running = true;
    try {
      await tick(client, store);
    } catch (error) {
      console.error('[agendador]', error);
    } finally {
      running = false;
    }
  };

  const firstRun = setTimeout(run, 5_000);
  firstRun.unref?.();

  const timer = setInterval(run, 60_000);
  timer.unref?.();

  return timer;
}

async function tick(client, store) {
  const now = Date.now();

  for (const punishment of [...store.allPunishments()]) {
    const guild = client.guilds.cache.get(punishment.guildId);
    if (!guild) {
      store.removePunishment(punishment.id);
      continue;
    }

    if (guild.available === false) continue; // queda do Discord: tenta de novo depois

    if (punishment.expiresAt > now) {
      if (punishment.type === 'mute') await renewMute(guild, punishment);
      continue;
    }

    await liftExpired(guild, punishment, store);
  }
}

async function renewMute(guild, punishment) {
  // Só mutes maiores que 28 dias precisam de renovação. Os demais acabam sozinhos,
  // e quem foi liberado manualmente pelo Discord não pode ser silenciado de novo.
  if (punishment.expiresAt - punishment.createdAt <= MAX_TIMEOUT_MS) return;

  const remaining = punishment.expiresAt - Date.now();
  if (remaining <= 0) return;

  const member =
    guild.members.cache.get(punishment.userId) ||
    (await guild.members.fetch(punishment.userId).catch(() => null));

  if (!member) return;
  if (member.isCommunicationDisabled()) return;

  const chunk = Math.min(remaining, MAX_TIMEOUT_MS);

  try {
    await member.timeout(
      chunk,
      'Renovando silenciamento (o Discord limita a 28 dias por vez)',
    );
  } catch (error) {
    console.error('[mute] não consegui renovar:', error.message);
  }
}

/** Erros do Discord que significam "já está resolvido": ban, usuário ou cargo que já não existem. */
const ALREADY_DONE = new Set([10026, 10013, 10011]);

const LABELS = {
  ban: { done: 'Banimento temporário expirado', kind: 'banimento' },
  mute: { done: 'Silenciamento expirado', kind: 'silenciamento' },
  role: { done: 'Cargo temporário expirado', kind: 'cargo temporário' },
};
const MAX_FAILURES = 5;
const failures = new Map();

async function liftExpired(guild, punishment, store) {
  let failed = null;

  try {
    if (punishment.type === 'ban') {
      await guild.bans.remove(punishment.userId, 'Banimento temporário expirado');
    } else if (punishment.type === 'mute') {
      const member =
        guild.members.cache.get(punishment.userId) ||
        (await guild.members.fetch(punishment.userId).catch(() => null));

      if (member?.isCommunicationDisabled()) {
        await member.timeout(null, 'Silenciamento expirado').catch(() => {});
      }
    } else if (punishment.type === 'role') {
      // Quem saiu do servidor já perdeu o cargo; quem perdeu na mão também não precisa de nada.
      const member =
        guild.members.cache.get(punishment.userId) ||
        (await guild.members.fetch(punishment.userId).catch(() => null));

      if (member?.roles.cache.has(punishment.roleId)) {
        await member.roles.remove(punishment.roleId, 'Cargo temporário expirado');
      }
    }
  } catch (error) {
    if (!ALREADY_DONE.has(error.code)) failed = error;
  }

  if (failed) {
    // Antes a punição era apagada mesmo com erro: a pessoa ficava banida para sempre
    // e o log dizia que tinha expirado. Agora tenta de novo a cada minuto.
    const count = (failures.get(punishment.id) || 0) + 1;
    failures.set(punishment.id, count);
    console.error(`[expiração] ${punishment.id} (tentativa ${count}/${MAX_FAILURES}):`, failed.message);

    if (count < MAX_FAILURES) return;

    failures.delete(punishment.id);
    store.removePunishment(punishment.id);

    const alert = new EmbedBuilder()
      .setColor(COLORS.error)
      .setTitle('⚠️ Não consegui remover uma punição expirada')
      .setDescription(
        `<@${punishment.userId}> (\`${punishment.userId}\`)\n` +
          `**Tipo:** ${(LABELS[punishment.type] || LABELS.mute).kind}\n` +
          `**Erro:** ${failed.message}\n\nRemova manualmente e confira as minhas permissões.`,
      )
      .setTimestamp();

    await logAction(guild.client, guild.id, store.guildConfig(guild.id), alert);
    return;
  }

  failures.delete(punishment.id);
  store.removePunishment(punishment.id);

  const title = (LABELS[punishment.type] || LABELS.mute).done;
  const roleLine = punishment.type === 'role' ? `\n**Cargo:** <@&${punishment.roleId}>` : '';

  const embed = new EmbedBuilder()
    .setColor(COLORS.ok)
    .setTitle(`✅ ${title}`)
    .setDescription(
      `<@${punishment.userId}> (\`${punishment.userId}\`)${roleLine}\n**Motivo original:** ${punishment.reason || 'Não informado'}`,
    )
    .setTimestamp();

  await logAction(guild.client, guild.id, store.guildConfig(guild.id), embed);
}
