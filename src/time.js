const ALIASES = {
  s: 1,
  seg: 1,
  segs: 1,
  segundo: 1,
  segundos: 1,
  m: 60,
  min: 60,
  mins: 60,
  minuto: 60,
  minutos: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hora: 3600,
  horas: 3600,
  d: 86400,
  dia: 86400,
  dias: 86400,
  sem: 604800,
  semana: 604800,
  semanas: 604800,
  mes: 2592000,
  meses: 2592000,
  a: 31536000,
  ano: 31536000,
  anos: 31536000,
};

const UNITS = [
  { seconds: 31536000, one: 'ano', many: 'anos' },
  { seconds: 2592000, one: 'mês', many: 'meses' },
  { seconds: 604800, one: 'semana', many: 'semanas' },
  { seconds: 86400, one: 'dia', many: 'dias' },
  { seconds: 3600, one: 'hora', many: 'horas' },
  { seconds: 60, one: 'minuto', many: 'minutos' },
  { seconds: 1, one: 'segundo', many: 'segundos' },
];

export function normalize(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function formatDuration(ms, maxParts = 3) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 segundos';

  let rest = Math.round(ms / 1000);
  const parts = [];

  for (const unit of UNITS) {
    if (rest < unit.seconds) continue;
    const amount = Math.floor(rest / unit.seconds);
    rest -= amount * unit.seconds;
    parts.push(`${amount} ${amount === 1 ? unit.one : unit.many}`);
    if (parts.length >= maxParts) break;
  }

  if (!parts.length) return 'menos de 1 segundo';
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  return `${parts.join(', ')} e ${last}`;
}

/**
 * Converte textos como "1d12h", "30 min", "1a", "1 mes" em milissegundos.
 * Retorna null quando o texto não é um tempo válido.
 * Retorna { ms: 0 } para "0"/"off" (usado no modo lento).
 */
export function parseDuration(input) {
  if (input === null || input === undefined) return null;

  const raw = normalize(input)
    .replace(/\s+e\s+/g, ' ');

  if (!raw) return null;
  if (['0', 'off', 'desligado', 'desativado', 'nenhum'].includes(raw)) {
    return { ms: 0, seconds: 0, text: '0 segundos' };
  }

  const pattern = /(\d+(?:[.,]\d+)?)\s*([a-z]+)/g;
  let totalSeconds = 0;
  let matched = false;
  let cursor = 0;

  for (const match of raw.matchAll(pattern)) {
    const gap = raw.slice(cursor, match.index);
    if (gap.replace(/[\s,+]/g, '') !== '') return null;

    const amount = Number(match[1].replace(',', '.'));
    const unit = ALIASES[match[2]];
    if (!unit || !Number.isFinite(amount)) return null;

    totalSeconds += amount * unit;
    matched = true;
    cursor = match.index + match[0].length;
  }

  if (!matched) return null;
  if (raw.slice(cursor).replace(/[\s,+]/g, '') !== '') return null;

  const ms = Math.round(totalSeconds * 1000);
  if (!Number.isFinite(ms) || ms <= 0) return null;

  return { ms, seconds: Math.round(totalSeconds), text: formatDuration(ms) };
}
