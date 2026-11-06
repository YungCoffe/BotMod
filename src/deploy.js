import { REST, Routes } from 'discord.js';
import { CLIENT_ID, GUILD_ID, TOKEN } from './config.js';
import { commands } from './commands/index.js';

const useGuild = process.argv.includes('--guild') || Boolean(GUILD_ID);

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Preencha DISCORD_TOKEN e CLIENT_ID no arquivo .env antes de rodar o deploy.');
  process.exit(1);
}

if (useGuild && !GUILD_ID) {
  console.error('❌ Você pediu deploy no servidor (--guild), mas o GUILD_ID está vazio no .env.');
  process.exit(1);
}

const body = commands.map((command) => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(TOKEN);

try {
  const route = useGuild
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  const data = await rest.put(route, { body });

  console.log(
    `✅ ${data.length} comandos registrados ${
      useGuild ? `no servidor ${GUILD_ID} (aparecem na hora)` : 'globalmente (pode levar até 1 hora)'
    }.`,
  );
} catch (error) {
  console.error('❌ Falha ao registrar os comandos:');
  console.error(error);
  process.exit(1);
}
