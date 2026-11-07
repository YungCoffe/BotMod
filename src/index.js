import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { AUTO_DEPLOY, BOT_NAME, CLIENT_ID, GUILD_ID, PREFIX, TOKEN } from './config.js';
import { autoRegister, registerHint } from './register.js';
import { loadBotOwners } from './owners.js';
import { Store } from './store.js';
import { commands } from './commands/index.js';
import { startScheduler } from './punish.js';
import { accessError } from './permissions.js';
import { failEmbed } from './ui.js';
import { executeCommand } from './execute.js';
import { handlePrefixCommand } from './prefix.js';
import { enforceAutomod } from './automod.js';
import { startVoiceTracking } from './voice.js';
import { startHttpServer } from './server.js';
import { notifyHighlights } from './highlight.js';

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN não encontrado.');
  console.error('   Copie o arquivo .env.example para .env e preencha o token do bot.');
  process.exit(1);
}

const MANAGE_EXPRESSIONS =
  PermissionFlagsBits.ManageGuildExpressions ?? PermissionFlagsBits.ManageEmojisAndStickers;

const store = new Store();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection(commands.map((command) => [command.data.name, command]));

const voice = startVoiceTracking(client, store);

// Porta HTTP para o Render (Web Service) e para serviços que "cutucam" o bot.
startHttpServer(client);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ ${readyClient.user.username} está online!`);
  console.log(`   Servidores: ${readyClient.guilds.cache.size}`);
  for (const guild of [...readyClient.guilds.cache.values()].slice(0, 5)) {
    console.log(`     - ${guild.name} (${guild.id})`);
  }
  console.log(`   Comandos: ${client.commands.size}`);
  console.log(`   Prefixo: ${PREFIX}`);

  const ownerIds = await loadBotOwners(readyClient);
  console.log(
    `   Dono(s) do bot: ${ownerIds.length ? ownerIds.join(', ') : 'nenhum identificado (defina OWNER_IDS no .env)'}`,
  );

  try {
    const invite = client.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        ...(MANAGE_EXPRESSIONS ? [MANAGE_EXPRESSIONS] : []),
      ],
    });
    console.log(`   Convite: ${invite}`);
  } catch {
    // sem problema: o convite também está no README
  }

  startScheduler(client, store);

  // Registra os comandos de barra (/) sozinho: em hospedagens como o Render ninguém roda o deploy.
  if (AUTO_DEPLOY) {
    if (CLIENT_ID && CLIENT_ID !== readyClient.user.id) {
      console.warn(
        `   ⚠️ O CLIENT_ID do .env (${CLIENT_ID}) não é o ID deste bot (${readyClient.user.id}). Usando o do bot.`,
      );
    }

    try {
      const result = await autoRegister({
        token: TOKEN,
        clientId: readyClient.user.id,
        onFallback: () =>
          console.warn(
            `   ⚠️ Não consegui registrar no GUILD_ID ${GUILD_ID} (servidor errado ou sem acesso). Registrando globalmente.`,
          ),
      });

      console.log(
        `   ✅ ${result.count} comandos de barra registrados ${
          result.scope === 'guild'
            ? `no servidor ${result.guildId} (aparecem na hora)`
            : 'globalmente (podem levar até 1 hora para aparecer)'
        }.`,
      );
    } catch (error) {
      console.error('   ❌ Não consegui registrar os comandos de barra:', error.message ?? error);
      const hint = registerHint(error);
      if (hint) console.error(`      Dica: ${hint}`);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const cfg = store.guildConfig(interaction.guildId);
  const denied = accessError(command, interaction.member, cfg);

  if (denied) {
    return interaction
      .reply({ embeds: [failEmbed('Sem permissão', denied)], flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }

  await executeCommand(command, {
    interaction,
    client,
    store,
    guild: interaction.guild,
    actor: interaction.member,
    cfg,
  });
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  try {
    const cfg = store.guildConfig(message.guildId);

    if (PREFIX && message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) {
      await handlePrefixCommand({ message, client, store, cfg });
      return;
    }

    // Mensagem apagada pelo automod não marca ninguém.
    const removed = await enforceAutomod({ client, message, cfg });
    if (!removed) await notifyHighlights({ message, store });
  } catch (error) {
    console.error('[mensagem]', error);
  }
});

// Quem sai do servidor leva as próprias palavras de highlight junto.
client.on(Events.GuildMemberRemove, (member) => store.clearHighlights(member.guild.id, member.id));

// Mensagens editadas também passam pela censura e pelo automod
// (senão bastaria enviar algo limpo e editar depois).
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    if (!newMessage.inGuild() || newMessage.author?.bot) return;
    if (!newMessage.content || oldMessage.content === newMessage.content) return;

    await enforceAutomod({ client, message: newMessage, cfg: store.guildConfig(newMessage.guildId) });
  } catch (error) {
    console.error('[mensagem editada]', error);
  }
});

// Sem esses dois, um erro de conexão derruba o bot inteiro.
client.on(Events.Error, (error) => console.error('[discord]', error));
client.on(Events.ShardError, (error) => console.error('[conexão]', error));

process.on('unhandledRejection', (error) => {
  console.error('[promise não tratada]', error);
});

// Ao desligar (Ctrl+C ou parada da hospedagem), salva o tempo de call em andamento.
function shutdown(signal) {
  console.log(`\n[${signal}] Salvando dados e saindo...`);
  try {
    voice.flush();
  } catch (error) {
    console.error('[encerrando]', error);
  }
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

console.log(`🚀 Iniciando ${BOT_NAME}...`);

client.login(TOKEN).catch((error) => {
  console.error('❌ Não consegui entrar no Discord. Confira o token no arquivo .env.');
  console.error(`   ${error.message}`);

  if (/disallowed intents/i.test(error.message || '')) {
    console.error('   Ative SERVER MEMBERS INTENT e MESSAGE CONTENT INTENT no portal do Discord.');
  }

  process.exit(1);
});
