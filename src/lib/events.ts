export const eventStatusLabels = { draft: 'Juodraštis', open: 'Registracija atvira', completed: 'Pasibaigęs', cancelled: 'Atšauktas' };
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID_PATTERN.test(value); }
export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('lt-LT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vilnius' }).format(new Date(value));
}
export function safeNextPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
  try { return new URL(value, 'https://local.invalid').origin === 'https://local.invalid' ? value : fallback; } catch { return fallback; }
}
