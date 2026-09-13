import Link from 'next/link';
import { CalendarDays, MapPin, ArrowUpRight } from 'lucide-react';
import { GameEvent } from '@/types/database';
import { eventStatusLabels, formatEventDate } from '@/lib/events';

export function EventCard({ event, admin = false }: { event: GameEvent; admin?: boolean }) {
  const closed = event.status === 'open' && new Date(event.starts_at).getTime() <= Date.now();
  return <article className="panel flex flex-col gap-4 hover:border-slate-600 transition-colors"><div className="flex justify-between gap-3"><span className={`text-xs ${event.status === 'open' && !closed ? 'text-emerald-200' : 'text-slate-400'}`}>{closed ? 'Registracija uždaryta' : eventStatusLabels[event.status]}</span>{event.results_published && <span className="text-xs text-amber-200">Rezultatai paskelbti</span>}</div><h3 className="text-xl font-semibold tracking-tight">{event.title}</h3><p className="text-sm text-slate-400 inline-flex gap-2"><CalendarDays size={17} className="shrink-0" aria-hidden="true" />{formatEventDate(event.starts_at)}</p><p className="text-sm text-slate-400 inline-flex gap-2"><MapPin size={17} className="shrink-0" aria-hidden="true" />{event.location}</p>{event.description && <p className="text-sm text-slate-400 line-clamp-2">{event.description}</p>}<Link className="mt-auto pt-3 inline-flex gap-2 items-center text-sm text-amber-200" href={`${admin ? '/admin' : ''}/events/${event.id}`}>{admin ? 'Valdyti renginį' : 'Peržiūrėti renginį'}<ArrowUpRight size={16} aria-hidden="true" /></Link></article>;
}
