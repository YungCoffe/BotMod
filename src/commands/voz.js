import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../config.js';
import { callRanking, formatCallTime } from '../voice.js';

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const LIMIT = MEDALS.length;

const commands = [
  // ------------------------------------------------------------- ranking de call
  {
    // Aberto a todos os membros. Para deixar só a equipe, troque para staffOnly: true.
    staffOnly: false,
    data: new SlashCommandBuilder()
      .setName('rankcall')
      .setDescription('Mostra quem ficou mais tempo em call e quem está em call agora'),

    async run({ interaction, guild, store }) {
      await interaction.deferReply(); // resposta pública, para todo mundo ver

      const now = Date.now();
      const { ranking, totals, live, position } = callRanking(store, guild.id, now);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🏆 Ranking de call')
        .setTimestamp();

      if (!ranking.length) {
        embed.setDescription(
          'Ninguém acumulou tempo em call ainda. Entre em um canal de voz para aparecer aqui!',
        );
        return interaction.editReply({ embeds: [embed] });
      }

      embed.setDescription('🟢 = está em call agora');

      const top = ranking
        .slice(0, LIMIT)
        .map(
          ([userId, ms], index) =>
            `${MEDALS[index]} <@${userId}> — **${formatCallTime(ms)}**${live.has(userId) ? ' 🟢' : ''}`,
        );

      embed.addFields({ name: 'Top 5 — mais tempo em call', value: top.join('\n') });

      const online = [...live.entries()]
        .map(([userId, session]) => ({ userId, session, place: position.get(userId) }))
        .sort((a, b) => a.place - b.place);

      const lines = online
        .slice(0, LIMIT)
        .map(
          ({ userId, session, place }) =>
            `🟢 **#${place}** <@${userId}> — ${formatCallTime(totals.get(userId))} no total · ` +
            `há ${formatCallTime(now - session.startedAt)} em <#${session.channelId}>`,
        );

      if (online.length > LIMIT) lines.push(`… e mais ${online.length - LIMIT} em call.`);

      embed.addFields({
        name: online.length ? `Em call agora (${online.length})` : 'Em call agora',
        value: lines.length ? lines.join('\n') : 'Ninguém no momento.',
      });

      const mine = position.get(interaction.user.id);
      embed.setFooter({
        text: mine
          ? `Você: #${mine} • ${formatCallTime(totals.get(interaction.user.id))}`
          : 'Você ainda não tem tempo em call',
      });

      await interaction.editReply({ embeds: [embed] });
    },
  },
];

export { commands };
