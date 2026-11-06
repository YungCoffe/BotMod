import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { normalizeText } from '../automod.js';
import { failEmbed, infoEmbed, okEmbed } from '../ui.js';

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

const fail = (interaction, title, description) =>
  interaction.editReply({ embeds: [failEmbed(title, description)], components: [] });

const MAX_WORDS = 100;

const commands = [
  // ------------------------------------------------------------- censura
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('censura')
      .setDescription('Gerencia as palavras censuradas do servidor')
      .addSubcommand((sub) =>
        sub
          .setName('adicionar')
          .setDescription('Adiciona uma palavra ou frase à censura')
          .addStringOption((option) =>
            option
              .setName('palavra')
              .setDescription('Palavra ou frase (pode ter espaços)')
              .setRequired(true)
              .setMaxLength(50),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remover')
          .setDescription('Remove uma palavra da censura')
          .addStringOption((option) =>
            option
              .setName('palavra')
              .setDescription('Palavra ou frase')
              .setRequired(true)
              .setMaxLength(50),
          ),
      )
      .addSubcommand((sub) => sub.setName('listar').setDescription('Mostra as palavras censuradas')),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const sub = interaction.options.getSubcommand(true);

      if (sub === 'listar') {
        const words = store.guildConfig(guild.id).censoredWords;

        if (!words.length) {
          return edit(
            interaction,
            infoEmbed('Censura vazia', 'Nenhuma palavra censurada. Use `/censura adicionar`.'),
          );
        }

        const shown = words.slice(0, 60).map((word) => `• ${word}`).join('\n');
        const extra = words.length > 60 ? `\n\n… e mais ${words.length - 60}.` : '';

        return edit(
          interaction,
          infoEmbed(
            `Palavras censuradas (${words.length})`,
            `${shown}${extra}\n\nA censura vale para palavras inteiras, sem diferenciar maiúsculas ou acentos.`,
          ),
        );
      }

      const raw = interaction.options.getString('palavra', true);
      const word = normalizeText(raw);

      if (!word || word.length < 2) {
        return fail(
          interaction,
          'Palavra inválida',
          'Use pelo menos **2 letras** (sem contar pontuação).',
        );
      }

      if (sub === 'adicionar') {
        const current = store.guildConfig(guild.id).censoredWords;

        if (current.length >= MAX_WORDS) {
          return fail(
            interaction,
            'Limite atingido',
            `O limite é de **${MAX_WORDS}** palavras. Remova alguma antes de adicionar outra.`,
          );
        }

        const added = store.addCensoredWord(guild.id, word);

        return edit(
          interaction,
          added
            ? okEmbed('Palavra censurada', `**${word}** agora é apagada automaticamente.`)
            : infoEmbed('Nada mudou', `**${word}** já estava na lista.`),
        );
      }

      const removed = store.removeCensoredWord(guild.id, word);

      return edit(
        interaction,
        removed
          ? okEmbed('Palavra liberada', `**${word}** não é mais censurada.`)
          : infoEmbed('Nada mudou', `**${word}** não estava na lista.`),
      );
    },
  },

  // ------------------------------------------------------------- automod
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('automod')
      .setDescription('Liga, desliga ou mostra o bloqueio automático de links')
      .addStringOption((option) =>
        option
          .setName('status')
          .setDescription('O que fazer')
          .setRequired(true)
          .addChoices(
            { name: 'Ligar', value: 'ligar' },
            { name: 'Desligar', value: 'desligar' },
            { name: 'Ver estado', value: 'ver' },
          ),
      ),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const status = interaction.options.getString('status', true);
      const cfg = store.guildConfig(guild.id);

      if (status === 'ver') {
        return edit(
          interaction,
          infoEmbed(
            'Automod de links',
            cfg.automodLinks
              ? 'O bloqueio de links está **ligado**.\n\nQuem tem cargo liberado ou Administrador pode enviar links normalmente.'
              : 'O bloqueio de links está **desligado**.\n\nUse `/automod status:Ligar` para ativar.',
          ),
        );
      }

      const enabled = status === 'ligar';
      store.updateGuildConfig(guild.id, { automodLinks: enabled });

      return edit(
        interaction,
        okEmbed(
          enabled ? 'Automod ligado' : 'Automod desligado',
          enabled
            ? 'Mensagens com links serão apagadas automaticamente. A equipe continua podendo enviar.'
            : 'Links voltaram a ser permitidos para todos.',
        ),
      );
    },
  },
];

export { commands };
