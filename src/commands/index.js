import { commands as moderation } from './moderacao.js';
import { commands as automod } from './automod.js';
import { commands as emojis } from './emojis.js';
import { commands as utilities } from './utilidades.js';
import { commands as configuration } from './config.js';

const all = [...moderation, ...automod, ...emojis, ...utilities, ...configuration];

const seen = new Set();
for (const command of all) {
  if (seen.has(command.data.name)) {
    throw new Error(`Comando duplicado: ${command.data.name}`);
  }
  seen.add(command.data.name);
}

export const commands = all;
