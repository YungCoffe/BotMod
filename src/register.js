import { REST, Routes } from 'discord.js';
import { CLIENT_ID, GUILD_ID, TOKEN } from './config.js';
import { commands } from './commands/index.js';

/**
 * Envia a lista de comandos de barra (/) para o Discord.
 *
 * - com GUILD_ID: registra só nesse servidor (aparece na hora)
 * - sem GUILD_ID (ou com global: true): registra em todos os servidores (até 1 hora)
 * - clearGuild: ao registrar global, apaga os comandos do GUILD_ID para não duplicar
 */
export async function registerCommands({
  token = TOKEN,
  clientId = CLIENT_ID,
  guildId = GUILD_ID,
  global = false,
  clearGuild = false,
} = {}) {
  if (!token || !clientId) {
    throw new Error('Preencha DISCORD_TOKEN e CLIENT_ID.');
  }

  const useGuild = Boolean(guildId) && !global;
  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(token);

  const data = await rest.put(
    useGuild
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId),
    { body },
  );

  if (!useGuild && clearGuild && guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  }

  return { count: data.length, scope: useGuild ? 'guild' : 'global', guildId: useGuild ? guildId : null };
}

/**
 * Registro automático ao ligar o bot (assim a hospedagem não precisa rodar `npm run deploy`).
 * Se o GUILD_ID estiver errado ou o bot não estiver nesse servidor, registra globalmente.
 */
export async function autoRegister({ token, clientId, onFallback }) {
  try {
    return await registerCommands({ token, clientId });
  } catch (error) {
    if (GUILD_ID && error.code === 50001) {
      onFallback?.(error);
      return registerCommands({ token, clientId, global: true });
    }
    throw error;
  }
}

/** Traduz os erros mais comuns do registro em uma dica clara. */
export function registerHint(error) {
  if (error.status === 401) return 'Token inválido: confira o DISCORD_TOKEN.';
  if (error.code === 50001) {
    return 'Sem acesso: o GUILD_ID está errado, o bot não está nesse servidor ou foi convidado sem o escopo "applications.commands".';
  }
  if (error.code === 10002 || error.code === 20012) {
    return 'O CLIENT_ID não bate com o token do bot (Developer Portal > General Information > Application ID).';
  }
  return null;
}
