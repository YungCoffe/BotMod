import { Events } from 'discord.js';

/**
 * De quanto em quanto tempo o tempo em call é somado e salvo no disco.
 * Se o bot cair, o máximo que se perde é esse intervalo.
 */
const CHECKPOINT_MS = 60_000;

/**
 * Quem está em call agora, por servidor:
 * guildId -> Map(userId -> { startedAt, savedAt, channelId })
 *
 * startedAt: quando a pessoa entrou em call (é o "há X min" mostrado no ranking)
 * savedAt:   até onde o tempo dela já foi somado ao total salvo
 */
const sessions = new Map();

/** O tempo no canal AFK do servidor também conta. Troque para false para ignorá-lo. */
const COUNT_AFK = true;

/** Conta quem está em qualquer canal de voz, menos bots. */
function counts(state) {
  if (!state?.channelId) return false;
  if (state.member?.user?.bot) return false;
  if (!COUNT_AFK && state.channelId === state.guild.afkChannelId) return false;
  return true;
}

function guildSessions(guildId) {
  let map = sessions.get(guildId);
  if (!map) {
    map = new Map();
    sessions.set(guildId, map);
  }
  return map;
}

function open(state, now) {
  const map = guildSessions(state.guild.id);
  const current = map.get(state.id);

  // Trocar de canal não zera a sessão: continua contando como a mesma call.
  if (current) {
    current.channelId = state.channelId;
    return;
  }

  map.set(state.id, { startedAt: now, savedAt: now, channelId: state.channelId });
}

function close(store, guildId, userId, now) {
  const map = sessions.get(guildId);
  const session = map?.get(userId);
  if (!session) return;

  store.addVoiceTime(guildId, userId, now - session.savedAt);
  map.delete(userId);
}

/** Confere o que o Discord diz agora com o que estamos contando (cura eventos perdidos). */
function sync(client, store) {
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    const present = new Set();

    for (const state of guild.voiceStates.cache.values()) {
      if (!counts(state)) continue;
      present.add(state.id);
      open(state, now);
    }

    const map = sessions.get(guild.id);
    if (!map) continue;

    for (const userId of [...map.keys()]) {
      if (!present.has(userId)) close(store, guild.id, userId, now);
    }
  }
}

/** Soma o tempo corrido de todo mundo que está em call e grava no disco. */
function checkpoint(client, store) {
  const now = Date.now();

  for (const [guildId, map] of sessions) {
    if (!client.guilds.cache.has(guildId)) {
      sessions.delete(guildId); // o bot saiu desse servidor
      continue;
    }

    for (const [userId, session] of map) {
      store.addVoiceTime(guildId, userId, now - session.savedAt);
      session.savedAt = now;
    }
  }

  store.flushVoice();
}

/** Liga a contagem de tempo em call. Devolve { flush } para salvar ao desligar. */
export function startVoiceTracking(client, store) {
  client.on(Events.VoiceStateUpdate, (_oldState, newState) => {
    try {
      const now = Date.now();
      if (counts(newState)) open(newState, now);
      else close(store, newState.guild.id, newState.id, now);
    } catch (error) {
      console.error('[call]', error);
    }
  });

  // Quem sai (ou é expulso/banido) do servidor sai também do ranking.
  client.on(Events.GuildMemberRemove, (member) => {
    sessions.get(member.guild.id)?.delete(member.id);
    store.removeVoiceUser(member.guild.id, member.id);
  });

  client.once(Events.ClientReady, () => {
    const run = () => {
      try {
        sync(client, store);
        checkpoint(client, store);
      } catch (error) {
        console.error('[call] não consegui salvar o tempo:', error);
      }
    };

    run();
    const timer = setInterval(run, CHECKPOINT_MS);
    timer.unref?.();
  });

  return { flush: () => checkpoint(client, store) };
}

/**
 * Monta o ranking de um servidor já somando o tempo de quem está em call agora.
 * position: userId -> colocação (1 = quem tem mais tempo).
 */
export function callRanking(store, guildId, now = Date.now()) {
  const live = sessions.get(guildId) ?? new Map();
  const totals = new Map(Object.entries(store.voiceTotals(guildId)));

  for (const [userId, session] of live) {
    totals.set(userId, (totals.get(userId) || 0) + (now - session.savedAt));
  }

  const ranking = [...totals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const position = new Map(ranking.map(([userId], index) => [userId, index + 1]));

  return { ranking, totals, live, position };
}

/** 2d 3h 15min · 4h 20min · 12min · 45s (o embed não atualiza sozinho, então sem segundos acima de 1 min) */
export function formatCallTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days) return `${days}d ${hours}h ${minutes}min`;
  if (hours) return `${hours}h ${minutes}min`;
  if (minutes) return `${minutes}min`;
  return `${total % 60}s`;
}
