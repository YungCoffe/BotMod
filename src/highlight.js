import { PermissionFlagsBits } from 'discord.js';
import { normalizeText } from './automod.js';

export const MAX_HIGHLIGHT_WORDS = 10;
export const MIN_HIGHLIGHT_LENGTH = 3;

const MAX_MENTIONS = 5; // pessoas marcadas por mensagem
const COOLDOWN_MS = 60_000; // por pessoa e por canal: evita o bot repetir marcações
const MAX_CANDIDATES = 25; // limite de consultas ao Discord por mensagem

/** `${servidor}:${canal}:${pessoa}` -> quando foi marcada pela última vez */
const cooldowns = new Map();

/** guildId -> { rev, single: Map<palavra, Set<userId>>, phrases: Map<frase, Set<userId>> } */
const indexes = new Map();

/** Índice palavra -> pessoas, para a busca não crescer com o número de membros. */
function indexFor(store, guildId) {
  const cached = indexes.get(guildId);
  if (cached?.rev === store.highlightRev) return cached;

  const single = new Map();
  const phrases = new Map();

  for (const [userId, words] of Object.entries(store.highlightUsers(guildId))) {
    for (const word of words) {
      const target = word.includes(' ') ? phrases : single;
      if (!target.has(word)) target.set(word, new Set());
      target.get(word).add(userId);
    }
  }

  const next = { rev: store.highlightRev, single, phrases };
  indexes.set(guildId, next);
  return next;
}

/** userId -> palavras encontradas. Palavra inteira, sem diferenciar maiúsculas/acentos. */
export function findHighlights(store, guildId, content) {
  const found = new Map();
  const { single, phrases } = indexFor(store, guildId);
  if (!single.size && !phrases.size) return found;

  const text = normalizeText(content);
  if (!text) return found;

  const add = (word, userIds) => {
    for (const userId of userIds) {
      if (!found.has(userId)) found.set(userId, new Set());
      found.get(userId).add(word);
    }
  };

  for (const token of new Set(text.split(' '))) {
    const users = single.get(token);
    if (users) add(token, users);
  }

  if (phrases.size) {
    const haystack = ` ${text} `;
    for (const [phrase, users] of phrases) {
      if (haystack.includes(` ${phrase} `)) add(phrase, users);
    }
  }

  return found;
}

function pruneCooldowns(now) {
  if (cooldowns.size < 5000) return;
  for (const [key, time] of cooldowns) {
    if (now - time >= COOLDOWN_MS) cooldowns.delete(key);
  }
}

/** Responde à mensagem marcando quem cadastrou alguma das palavras ditas. */
export async function notifyHighlights({ message, store }) {
  if (!message.content || message.author.bot) return;

  const { guild, channel } = message;
  const matches = findHighlights(store, guild.id, message.content);
  matches.delete(message.author.id); // ninguém é marcado pela própria fala
  if (!matches.size) return;

  const now = Date.now();
  pruneCooldowns(now);

  const ids = [];
  const words = new Set();
  let checked = 0;

  for (const [userId, found] of matches) {
    if (ids.length >= MAX_MENTIONS || checked >= MAX_CANDIDATES) break;

    const key = `${guild.id}:${channel.id}:${userId}`;
    if (now - (cooldowns.get(key) || 0) < COOLDOWN_MS) continue;

    checked += 1;
    const member =
      guild.members.cache.get(userId) ||
      (await guild.members.fetch(userId).catch(() => null));

    if (!member) continue; // saiu do servidor

    // Só marca quem enxerga o canal: a mensagem não pode vazar para quem não deveria vê-la.
    if (!channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)) continue;

    cooldowns.set(key, now);
    ids.push(userId);
    for (const word of found) words.add(word);
  }

  if (!ids.length) return;

  await message
    .reply({
      content: `🔔 ${ids.map((id) => `<@${id}>`).join(' ')} — palavra destacada: ${[...words]
        .map((word) => `**${word}**`)
        .join(', ')}`,
      allowedMentions: { users: ids, repliedUser: false },
    })
    .catch(() => {});
}
