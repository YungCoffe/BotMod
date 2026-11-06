import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');
export const DATA_DIR = path.join(ROOT, 'data');

dotenv.config({ path: path.join(ROOT, '.env') });

export const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
export const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
export const GUILD_ID = (process.env.GUILD_ID || '').trim();
export const PREFIX = (process.env.PREFIX || 'z?').trim();

export const BOT_NAME = 'Staff Bot';

export const COLORS = {
  ok: 0x57f287,
  warn: 0xfee75c,
  error: 0xed4245,
  info: 0x5865f2,
  neutral: 0x2b2d31,
};

export const TIME_HELP =
  'Formatos aceitos: `1s`, `30s`, `10min`, `1h`, `1d`, `1sem`, `1mes`, `1a` (ano). ' +
  'Também pode combinar: `1d12h`, `1h30min`.';

export const TIME_EXAMPLES = '`10min` · `1h30min` · `7d` · `1mes` · `1a`';
