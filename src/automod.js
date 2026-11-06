import { EmbedBuilder } from 'discord.js';
import { COLORS } from './config.js';
import { isStaff } from './permissions.js';
import { logAction } from './logger.js';
import { tryDm, warnEmbed } from './ui.js';

const LINK_PATTERN =
  /(https?:\/\/[^\s<>]+|www\.[^\s<>]+|\b[\w-]+\.(?:com|net|org|gg|br|pt|io|me|xyz|info|tv|link|shop|site|app|dev|co)\b(?:[/?#]\S*)?)/i;

export function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retorna a palavra censurada encontrada (ou null). */
export function findCensoredWord(content, words) {
  const haystack = ` ${normalizeText(content)} `;
  if (!haystack.trim()) return null;

  for (const word of words) {
    const needle = normalizeText(word);
    if (!needle) continue;
    if (haystack.includes(` ${needle} `)) return word;
  }

  return null;
}

export function containsLink(content) {
  return LINK_PATTERN.test(content);
}

async function removeMessage({ client, message, cfg, action, reason, dmReason }) {
  const deleted = await message.delete().then(() => true).catch(() => false);

  const embed = new EmbedBuilder()
    .setColor(COLORS.warn)
    .setTitle(`🤖 ${action}`)
    .setDescription(
      [
        `**Usuário:** ${message.author.username} (\`${message.author.id}\`)`,
        `**Canal:** ${message.channel}`,
        `**Motivo:** ${reason}`,
        `**Mensagem:** ${deleted ? 'apagada' : 'não consegui apagar (falta de permissão)'}`,
      ].join('\n'),
    )
    .addFields({
      name: 'Trecho',
      value: `\`\`\`${message.content.slice(0, 200).replace(/`/g, "'") || '(sem texto)'}\`\`\``,
    })
    .setTimestamp();

  await logAction(client, message.guildId, cfg, embed);

  await tryDm(
    message.author,
    warnEmbed(
      'Mensagem removida',
      `**Servidor:** ${message.guild.name}\n**Canal:** ${message.channel}\n**Motivo:** ${dmReason}`,
    ),
  );

  return deleted;
}

/** Aplica censura de palavras e bloqueio de links nas mensagens comuns. */
export async function enforceAutomod({ client, message, cfg }) {
  if (!message.content) return false;

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (isStaff(member, cfg)) return false;

  const word = findCensoredWord(message.content, cfg.censoredWords || []);

  if (word) {
    await removeMessage({
      client,
      message,
      cfg,
      action: 'Censura automática',
      reason: `Palavra proibida: **${word}**`,
      dmReason: 'Uma palavra proibida foi detectada na sua mensagem.',
    });
    return true;
  }

  if (cfg.automodLinks && containsLink(message.content)) {
    await removeMessage({
      client,
      message,
      cfg,
      action: 'Automod: link bloqueado',
      reason: 'Mensagens com links não são permitidas.',
      dmReason: 'Links não são permitidos neste servidor.',
    });
    return true;
  }

  return false;
}
