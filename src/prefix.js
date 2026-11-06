import { ApplicationCommandOptionType } from 'discord.js';
import { PREFIX } from './config.js';
import { UserError } from './guard.js';
import { parseDuration } from './time.js';
import { accessError } from './permissions.js';
import { executeCommand } from './execute.js';

const TYPE = {
  STRING: ApplicationCommandOptionType.String,
  INTEGER: ApplicationCommandOptionType.Integer,
  BOOLEAN: ApplicationCommandOptionType.Boolean,
  USER: ApplicationCommandOptionType.User,
  ROLE: ApplicationCommandOptionType.Role,
  CHANNEL: ApplicationCommandOptionType.Channel,
  ATTACHMENT: ApplicationCommandOptionType.Attachment,
  SUB_COMMAND: ApplicationCommandOptionType.Subcommand,
  SUB_COMMAND_GROUP: ApplicationCommandOptionType.SubcommandGroup,
};

const SUB_ALIASES = {
  add: 'adicionar',
  remove: 'remover',
  list: 'listar',
};

const normalize = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Separa os argumentos respeitando aspas duplas: z?say "bom dia a todos" */
export function splitArgs(input) {
  const tokens = [];
  let current = '';
  let insideQuote = false;

  for (const char of String(input || '')) {
    if (char === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (!insideQuote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseBoolean(token) {
  const value = normalize(token);

  if (['sim', 's', 'true', 'on', 'ligado', 'ligar', 'yes', 'y', '1'].includes(value)) return true;
  if (['nao', 'n', 'false', 'off', 'desligado', 'desligar', 'no', '0'].includes(value)) return false;

  return null;
}

function matchChoice(option, token) {
  const value = normalize(token);

  const byValue = option.choices.find((choice) => normalize(choice.value) === value);
  if (byValue) return byValue.value;

  const byName = option.choices.find((choice) => normalize(choice.name) === value);
  if (byName) return byName.value;

  const partial = option.choices.find((choice) => normalize(choice.name).startsWith(value));
  return partial ? partial.value : null;
}

async function matchOption(option, token, ctx) {
  switch (option.type) {
    case TYPE.STRING: {
      if (option.choices) {
        const value = matchChoice(option, token);
        return value === null ? { matched: false } : { matched: true, value };
      }

      if (option.name === 'id') {
        return /^\d{15,25}$/.test(token)
          ? { matched: true, value: token }
          : { matched: false };
      }

      if (option.name === 'tempo') {
        return parseDuration(token)
          ? { matched: true, value: token }
          : { matched: false };
      }

      return { matched: true, value: token };
    }

    case TYPE.INTEGER: {
      return /^-?\d+$/.test(token)
        ? { matched: true, value: Number(token) }
        : { matched: false };
    }

    case TYPE.BOOLEAN: {
      const value = parseBoolean(token);
      return value === null ? { matched: false } : { matched: true, value };
    }

    case TYPE.USER: {
      const id = token.match(/^<@!?(\d{15,25})>$/)?.[1] ||
        (/^\d{15,25}$/.test(token) ? token : null);
      if (!id) return { matched: false };

      const user = await ctx.client.users.fetch(id).catch(() => null);
      return user ? { matched: true, value: user } : { matched: false };
    }

    case TYPE.ROLE: {
      const id = token.match(/^<@&(\d{15,25})>$/)?.[1] ||
        (/^\d{15,25}$/.test(token) ? token : null);

      if (id) {
        const role = ctx.guild.roles.cache.get(id);
        return role ? { matched: true, value: role } : { matched: false };
      }

      const role = ctx.guild.roles.cache.find(
        (item) => item.name.toLowerCase() === token.toLowerCase(),
      );
      return role ? { matched: true, value: role } : { matched: false };
    }

    case TYPE.CHANNEL: {
      const id = token.match(/^<#(\d{15,25})>$/)?.[1] ||
        (/^\d{15,25}$/.test(token) ? token : null);

      if (id) {
        const channel = ctx.guild.channels.cache.get(id);
        return channel ? { matched: true, value: channel } : { matched: false };
      }

      const channel = ctx.guild.channels.cache.find(
        (item) => item.name.toLowerCase() === token.toLowerCase(),
      );
      return channel ? { matched: true, value: channel } : { matched: false };
    }

    default:
      return { matched: false };
  }
}

async function parseOptions(commandJson, tokens, ctx) {
  const options = commandJson.options || [];
  const values = {};
  let index = 0;

  for (let position = 0; position < options.length; position += 1) {
    const option = options[position];

    if (option.type === TYPE.ATTACHMENT) {
      const attachment = ctx.message?.attachments?.first?.() || null;
      values[option.name] = attachment;
      if (!attachment && option.required) {
        throw new UserError(`Anexe um arquivo em **${option.name}**.`);
      }
      continue;
    }

    const token = tokens[index];

    if (token === undefined) {
      if (option.required) throw new UserError(`Faltou informar **${option.name}**.`);
      values[option.name] = null;
      continue;
    }

    const isLast = position === options.length - 1;

    if (isLast && option.type === TYPE.STRING && !option.choices) {
      values[option.name] = tokens.slice(index).join(' ');
      index = tokens.length;
      continue;
    }

    const match = await matchOption(option, token, ctx);

    if (!match.matched) {
      if (option.required) {
        const hint = option.type === TYPE.USER ? ' Use @menção ou o ID.' : '';
        throw new UserError(`Valor inválido para **${option.name}**: \`${token}\`.${hint}`);
      }

      values[option.name] = null;
      continue;
    }

    values[option.name] = match.value;
    index += 1;
  }

  // Sobras viram continuação do último texto livre (ex.: z?say Olá pessoal)
  if (index < tokens.length) {
    const freeText = [...options]
      .reverse()
      .find((option) => option.type === TYPE.STRING && !option.choices);

    if (freeText && values[freeText.name]) {
      values[freeText.name] += ` ${tokens.slice(index).join(' ')}`;
    }
  }

  return values;
}

/** Lê o comando digitado, inclusive subcomandos simples (ex.: z?censura add x). */
export async function parsePrefix(commandJson, tokens, ctx) {
  const options = commandJson.options || [];

  if (options.some((option) => option.type === TYPE.SUB_COMMAND_GROUP)) {
    throw new UserError(`\`/${commandJson.name}\` só funciona com barra (/).`);
  }

  const subcommands = options.filter((option) => option.type === TYPE.SUB_COMMAND);

  if (subcommands.length) {
    const rawName = (tokens[0] || '').toLowerCase();
    const name = SUB_ALIASES[rawName] || rawName;
    const subcommand = subcommands.find((item) => item.name === name);

    if (!subcommand) {
      throw new UserError(
        `Informe o subcomando: ${subcommands.map((item) => `\`${item.name}\``).join(', ')}.`,
      );
    }

    const values = await parseOptions(
      { options: subcommand.options || [] },
      tokens.slice(1),
      ctx,
    );

    return { subcommand: subcommand.name, values };
  }

  const values = await parseOptions(commandJson, tokens, ctx);
  return { subcommand: null, values };
}

class PrefixOptions {
  constructor(values, subcommand) {
    this.values = values;
    this.subcommand = subcommand;
  }

  get(name, required) {
    const value = this.values[name];

    if (value === undefined || value === null || value === '') {
      if (required) throw new UserError(`Faltou informar **${name}**.`);
      return null;
    }

    return value;
  }

  getUser(name, required) { return this.get(name, required); }
  getString(name, required) { return this.get(name, required); }
  getInteger(name, required) { return this.get(name, required); }
  getBoolean(name, required) { return this.get(name, required); }
  getRole(name, required) { return this.get(name, required); }
  getChannel(name, required) { return this.get(name, required); }
  getAttachment(name, required) { return this.get(name, required); }

  getSubcommand(required) {
    if (!this.subcommand && required) throw new UserError('Informe o subcomando.');
    return this.subcommand;
  }

  getSubcommandGroup() {
    return null;
  }
}

function normalizePayload(payload) {
  if (typeof payload === 'string') return { content: payload };
  if (!payload) return {};

  const { flags, ephemeral, fetchReply, ...rest } = payload;
  return rest;
}

/** Faz os comandos existentes funcionarem como se fossem interações de barra. */
export class PrefixInteraction {
  constructor({ message, client, commandJson, values, subcommand }) {
    this.id = `prefix-${message.id}`;
    this.applicationId = client.user?.id;
    this.type = 2;
    this.commandName = commandJson.name;
    this.guild = message.guild;
    this.guildId = message.guild.id;
    this.channel = message.channel;
    this.channelId = message.channelId;
    this.member = message.member;
    this.user = message.author;
    this.client = client;
    this.createdTimestamp = message.createdTimestamp;
    this.deferred = false;
    this.replied = false;
    this.options = new PrefixOptions(values, subcommand);
    this._reply = null;
  }

  inGuild() {
    return true;
  }

  isChatInputCommand() {
    return true;
  }

  async deferReply() {
    this.deferred = true;
  }

  async editReply(payload) {
    const data = normalizePayload(payload);

    if (!this._reply) {
      this._reply = await this.channel.send({ ...data, allowedMentions: { parse: [] } });
      this.replied = true;
      return this._reply;
    }

    try {
      return await this._reply.edit(data);
    } catch {
      this._reply = await this.channel.send({ ...data, allowedMentions: { parse: [] } });
      return this._reply;
    }
  }

  async reply(payload) {
    return this.editReply(payload);
  }

  async followUp(payload) {
    return this.channel.send({ ...normalizePayload(payload), allowedMentions: { parse: [] } });
  }
}

async function temporaryReply(message, content) {
  const sent = await message
    .reply({ content, allowedMentions: { parse: [], repliedUser: false } })
    .catch(() => null);

  if (!sent) return;

  const timer = setTimeout(() => {
    sent.delete().catch(() => {});
  }, 7_000);

  timer.unref?.();
}

/** Trata uma mensagem que começa com o prefixo (padrão z?). */
export async function handlePrefixCommand({ message, client, store, cfg }) {
  const content = message.content.slice(PREFIX.length).trim();
  if (!content) return true;

  const match = content.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const name = (match?.[1] || '').toLowerCase();
  const command = client.commands.get(name);

  if (!command) {
    await temporaryReply(message, `Comando \`${name}\` não existe. Use \`${PREFIX}help\`.`);
    return true;
  }

  const commandJson = command.data.toJSON();
  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  const denied = accessError(command, member, cfg);
  if (denied) {
    await temporaryReply(message, denied);
    return true;
  }

  let interaction;

  try {
    const { subcommand, values } = await parsePrefix(
      commandJson,
      splitArgs(match?.[2] || ''),
      { guild: message.guild, message, client },
    );

    interaction = new PrefixInteraction({
      message,
      client,
      commandJson,
      values,
      subcommand,
    });
  } catch (error) {
    if (error instanceof UserError) {
      await temporaryReply(message, error.message);
      return true;
    }
    throw error;
  }

  await executeCommand(command, {
    interaction,
    client,
    store,
    guild: message.guild,
    actor: member,
    cfg,
  });

  return true;
}
