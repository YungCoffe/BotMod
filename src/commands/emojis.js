import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { COLORS } from '../config.js';
import { UserError, assertBotPermission } from '../guard.js';
import { failEmbed } from '../ui.js';

const MANAGE_EXPRESSIONS =
  PermissionFlagsBits.ManageGuildExpressions ?? PermissionFlagsBits.ManageEmojisAndStickers;

const defer = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

const edit = (interaction, embed) =>
  interaction.editReply({ embeds: [embed], components: [] });

function sourceFrom(interaction) {
  const file = interaction.options.getAttachment('arquivo');
  const raw = (interaction.options.getString('imagem') || '').trim();

  if (file?.url) return file.url;

  if (!raw) {
    throw new UserError(
      'Anexe uma imagem em **arquivo** ou informe um link/emoji em **imagem**.',
    );
  }

  const customEmoji = raw.match(/^<(a?):[a-zA-Z0-9_]+:(\d+)>$/);
  if (customEmoji) {
    return `https://cdn.discordapp.com/emojis/${customEmoji[2]}.${customEmoji[1] === 'a' ? 'gif' : 'png'}`;
  }

  if (/^https?:\/\/\S+$/i.test(raw)) return raw;

  throw new UserError(
    'O link precisa começar com `http://` ou `https://`, ou ser um emoji personalizado do servidor.',
  );
}

function friendlyError(error, kind) {
  if (error.code === 30008) return new UserError('O servidor já atingiu o limite de **emojis**.');
  if (error.code === 30039) return new UserError('O servidor já atingiu o limite de **figurinhas**.');
  if (error.code === 50013) {
    return new UserError('Não tenho a permissão **Gerenciar Expressões** neste servidor.');
  }
  if (error.code === 50035) {
    return new UserError(
      kind === 'emoji'
        ? 'Imagem inválida para emoji. Use PNG, JPG ou GIF de até **256 KB** (recomendado 128x128).'
        : 'Figurinha inválida. O Discord exige PNG ou APNG de **320x320** pixels e até **512 KB**.',
    );
  }
  return error;
}

const commands = [
  // ------------------------------------------------------------- emoji
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('criaremoji')
      .setDescription('Cria um emoji no servidor a partir de uma imagem ou de outro emoji')
      .addStringOption((option) =>
        option
          .setName('nome')
          .setDescription('Nome do emoji (2 a 32 caracteres)')
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(32),
      )
      .addAttachmentOption((option) =>
        option.setName('arquivo').setDescription('Imagem do emoji').setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('imagem')
          .setDescription('Link da imagem ou emoji personalizado')
          .setRequired(false)
          .setMaxLength(600),
      ),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const name = interaction.options.getString('nome', true).trim();

      if (!/^[a-zA-Z0-9_]{2,32}$/.test(name)) {
        return interaction.editReply({
          embeds: [
            failEmbed(
              'Nome inválido',
              'O nome do emoji precisa ter de 2 a 32 caracteres e usar apenas letras, números e `_`.',
            ),
          ],
        });
      }

      try {
        assertBotPermission(guild, MANAGE_EXPRESSIONS, 'Gerenciar Expressões');
      } catch (error) {
        if (error instanceof UserError) {
          return interaction.editReply({ embeds: [failEmbed('Não foi possível', error.message)] });
        }
        throw error;
      }

      const source = sourceFrom(interaction);

      let emoji;
      try {
        emoji = await guild.emojis.create({
          attachment: source,
          name,
          reason: `Criado por ${actor.user.username}`,
        });
      } catch (error) {
        throw friendlyError(error, 'emoji');
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.ok)
        .setTitle('✅ Emoji criado')
        .setDescription(`**${emoji.name}** — ${emoji}`)
        .setThumbnail(emoji.imageURL({ size: 128 }))
        .addFields(
          { name: 'ID', value: `\`${emoji.id}\``, inline: true },
          { name: 'Animado', value: emoji.animated ? 'Sim' : 'Não', inline: true },
        )
        .setTimestamp();

      await edit(interaction, embed);
    },
  },

  // ------------------------------------------------------------- figurinha
  {
    staffOnly: true,
    data: new SlashCommandBuilder()
      .setName('criarfigurinha')
      .setDescription('Cria uma figurinha (sticker) no servidor a partir de uma imagem')
      .addStringOption((option) =>
        option
          .setName('nome')
          .setDescription('Nome da figurinha (2 a 30 caracteres)')
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(30),
      )
      .addAttachmentOption((option) =>
        option.setName('arquivo').setDescription('Imagem da figurinha').setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName('imagem')
          .setDescription('Link da imagem')
          .setRequired(false)
          .setMaxLength(600),
      )
      .addStringOption((option) =>
        option
          .setName('tags')
          .setDescription('Palavras para encontrar a figurinha (ex.: gato, meme)')
          .setRequired(false)
          .setMaxLength(200),
      )
      .addStringOption((option) =>
        option
          .setName('descricao')
          .setDescription('Descrição da figurinha')
          .setRequired(false)
          .setMaxLength(100),
      ),

    async run({ interaction, guild, actor }) {
      await defer(interaction);

      const name = interaction.options.getString('nome', true).trim();

      if (name.length < 2 || name.length > 30) {
        return interaction.editReply({
          embeds: [failEmbed('Nome inválido', 'O nome precisa ter entre 2 e 30 caracteres.')],
        });
      }

      try {
        assertBotPermission(guild, MANAGE_EXPRESSIONS, 'Gerenciar Expressões');
      } catch (error) {
        if (error instanceof UserError) {
          return interaction.editReply({ embeds: [failEmbed('Não foi possível', error.message)] });
        }
        throw error;
      }

      const source = sourceFrom(interaction);
      const tags = (interaction.options.getString('tags') || name).trim().slice(0, 200);
      const description =
        (interaction.options.getString('descricao') || '').trim().slice(0, 100) || undefined;

      let sticker;
      try {
        sticker = await guild.stickers.create({
          file: source,
          name,
          tags,
          description,
          reason: `Criada por ${actor.user.username}`,
        });
      } catch (error) {
        throw friendlyError(error, 'sticker');
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.ok)
        .setTitle('✅ Figurinha criada')
        .setDescription(`**${sticker.name}**\nTags: ${sticker.tags || tags}`)
        .setImage(`https://media.discordapp.net/stickers/${sticker.id}.png?size=320`)
        .addFields(
          { name: 'ID', value: `\`${sticker.id}\``, inline: true },
          { name: 'Formato', value: `${sticker.format}`, inline: true },
        )
        .setTimestamp();

      await edit(interaction, embed);
    },
  },
];

export { commands };
