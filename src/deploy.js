import { CLIENT_ID, GUILD_ID, TOKEN } from './config.js';
import { registerCommands, registerHint } from './register.js';

// npm run deploy          -> segue o .env (com GUILD_ID = só nesse servidor; sem = global)
// npm run deploy:teste    -> só no servidor do GUILD_ID (aparece na hora)
// npm run deploy:global   -> em todos os servidores (e limpa os do GUILD_ID, evitando duplicados)
const forceGuild = process.argv.includes('--guild');
const forceGlobal = process.argv.includes('--global');

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Preencha DISCORD_TOKEN e CLIENT_ID no arquivo .env antes de rodar o deploy.');
  process.exit(1);
}

if (forceGuild && !GUILD_ID) {
  console.error('❌ Você pediu deploy no servidor (--guild), mas o GUILD_ID está vazio no .env.');
  process.exit(1);
}

try {
  const result = await registerCommands({ global: forceGlobal, clearGuild: forceGlobal });

  console.log(
    `✅ ${result.count} comandos registrados ${
      result.scope === 'guild'
        ? `no servidor ${result.guildId} (aparecem na hora)`
        : 'globalmente (pode levar até 1 hora)'
    }.`,
  );
} catch (error) {
  console.error('❌ Falha ao registrar os comandos:', error.message ?? error);
  const hint = registerHint(error);
  if (hint) console.error(`   Dica: ${hint}`);
  process.exit(1);
}
