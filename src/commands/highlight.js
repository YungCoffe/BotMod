import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { normalizeText } from '../automod.js';
import { MAX_HIGHLIGHT_WORDS, MIN_HIGHLIGHT_LENGTH } from '../highlight.js';
import { failEmbed, infoEmbed, okEmbed } from '../ui.js';

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

const wordOption = (option) =>
  option
    .setName('palavra')
    .setDescription('Palavra ou frase (pode ter espaços)')
    .setRequired(true)
    .setMaxLength(30);

const commands = [
  // ------------------------------------------------------------- highlight
  {
    // Aberto a todos os membros. Para deixar só a equipe, troque para staffOnly: true.
    staffOnly: false,
    data: new SlashCommandBuilder()
      .setName('highlight')
      .setDescription('Receba uma marcação quando alguém falar uma palavra que você escolheu')
      .addSubcommand((sub) =>
        sub.setName('adicionar').setDescription('Adiciona uma palavra ao seu highlight').addStringOption(wordOption),
      )
      .addSubcommand((sub) =>
        sub.setName('remover').setDescription('Remove uma palavra do seu highlight').addStringOption(wordOption),
      )
      .addSubcommand((sub) => sub.setName('listar').setDescription('Mostra as suas palavras'))
      .addSubcommand((sub) => sub.setName('limpar').setDescription('Remove todas as suas palavras')),

    async run({ interaction, guild, store }) {
      await defer(interaction);

      const sub = interaction.options.getSubcommand(true);
      const userId = interaction.user.id;

      if (sub === 'listar') {
        const words = store.highlightWords(guild.id, userId);

        if (!words.length) {
          return edit(
            interaction,
            infoEmbed('Nenhuma palavra', 'Você ainda não tem palavras. Use `/highlight adicionar`.'),
          );
        }

        return edit(
          interaction,
          infoEmbed(
            `Seus highlights (${words.length}/${MAX_HIGHLIGHT_WORDS})`,
            `${words.map((word) => `• ${word}`).join('\n')}\n\n` +
              'Quando alguém falar uma dessas palavras, eu marco você na mensagem. ' +
              'Vale para palavras inteiras, sem diferenciar maiúsculas ou acentos.',
          ),
        );
      }

      if (sub === 'limpar') {
        const total = store.clearHighlights(guild.id, userId);

        return edit(
          interaction,
          total
            ? okEmbed('Highlights apagados', `${total} palavra(s) removida(s).`)
            : infoEmbed('Nenhuma palavra', 'Você não tinha palavras para remover.'),
        );
      }

      const word = normalizeText(interaction.options.getString('palavra', true));

      if (word.length < MIN_HIGHLIGHT_LENGTH) {
        return edit(
          interaction,
          failEmbed(
            'Palavra inválida',
            `Use pelo menos **${MIN_HIGHLIGHT_LENGTH} letras** (sem contar pontuação).`,
          ),
        );
      }

      if (sub === 'adicionar') {
        const current = store.highlightWords(guild.id, userId);

        if (current.includes(word)) {
          return edit(interaction, failEmbed('Já existe', `**${word}** já está na sua lista.`));
        }

        if (current.length >= MAX_HIGHLIGHT_WORDS) {
          return edit(
            interaction,
            failEmbed('Limite atingido', `Você pode ter no máximo **${MAX_HIGHLIGHT_WORDS}** palavras.`),
          );
        }

        store.addHighlight(guild.id, userId, word);
        return edit(
          interaction,
          okEmbed('Palavra adicionada', `Vou marcar você quando alguém falar **${word}**.`),
        );
      }

      // remover
      const removed = store.removeHighlight(guild.id, userId, word);
      return edit(
        interaction,
        removed
          ? okEmbed('Palavra removida', `**${word}** saiu da sua lista.`)
          : failEmbed('Não encontrada', `**${word}** não está na sua lista.`),
      );
    },
  },
];

export { commands };
