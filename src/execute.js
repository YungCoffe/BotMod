import { MessageFlags } from 'discord.js';
import { UserError } from './guard.js';
import { failEmbed } from './ui.js';

/** Roda um comando (barra ou prefixo) e trata os erros de forma amigável. */
export async function executeCommand(command, context) {
  const { interaction } = context;

  try {
    await command.run(context);
  } catch (error) {
    const expected = error instanceof UserError;
    if (!expected) console.error(`[${command.data.name}]`, error);

    const payload = {
      embeds: [
        failEmbed(
          'Não deu certo',
          expected ? error.message : 'Aconteceu um erro inesperado. Tente de novo em instantes.',
        ),
      ],
      components: [],
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction
        .reply({ ...payload, flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
}
