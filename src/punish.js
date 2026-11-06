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

/** Verifica de minuto em minuto punições que expiraram (e renova mutes longos). */
export function startScheduler(client, store) {
  const run = () => tick(client, store).catch((error) => console.error('[agendador]', error));

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

    if (punishment.expiresAt > now) {
      if (punishment.type === 'mute') await renewMute(guild, punishment);
      continue;
    }

    await liftExpired(guild, punishment, store);
  }
}

async function renewMute(guild, punishment) {
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

async function liftExpired(guild, punishment, store) {
  try {
    if (punishment.type === 'ban') {
      await guild.bans.remove(punishment.userId, 'Banimento temporário expirado').catch((error) => {
        if (error.code !== 10026) throw error; // 10026 = banimento já não existe
      });
    } else if (punishment.type === 'mute') {
      const member =
        guild.members.cache.get(punishment.userId) ||
        (await guild.members.fetch(punishment.userId).catch(() => null));

      if (member?.isCommunicationDisabled()) {
        await member.timeout(null, 'Silenciamento expirado').catch(() => {});
      }
    }
  } catch (error) {
    console.error('[expiração]', punishment.id, error.message);
  }

  store.removePunishment(punishment.id);

  const title =
    punishment.type === 'ban'
      ? 'Banimento temporário expirado'
      : 'Silenciamento expirado';

  const embed = new EmbedBuilder()
    .setColor(COLORS.ok)
    .setTitle(`✅ ${title}`)
    .setDescription(
      `<@${punishment.userId}> (\`${punishment.userId}\`)\n**Motivo original:** ${punishment.reason || 'Não informado'}`,
    )
    .setTimestamp();

  await logAction(guild.client, guild.id, store.guildConfig(guild.id), embed);
}
