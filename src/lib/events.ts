export const eventStatusLabels = { draft: 'Juodraštis', open: 'Registracija atvira', completed: 'Pasibaigęs', cancelled: 'Atšauktas' };
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID_PATTERN.test(value); }

export function maxTeamCapacity(seats: { table_number: number; user_id: string | null; team_id?: string | null }[]) {
  const freeByTable = new Map<number, number>();
  for (const seat of seats) {
    if (!seat.user_id && !seat.team_id) freeByTable.set(seat.table_number, (freeByTable.get(seat.table_number) || 0) + 1);
  }
  return Math.min(4, Math.max(0, ...freeByTable.values()));
}

export function readTicketToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (isUuid(input)) return input;
  try {
    const url = new URL(input);
    const token = url.searchParams.get('token');
    return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/admin/check-in' && isUuid(token) ? token : null;
  } catch { return null; }
}
export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('lt-LT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vilnius' }).format(new Date(value));
}
export function safeNextPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
  try { return new URL(value, 'https://local.invalid').origin === 'https://local.invalid' ? value : fallback; } catch { return fallback; }
}
