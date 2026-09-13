import Link from 'next/link';
import { Ticket, Users, Clock3 } from 'lucide-react';
import { GameEvent, EventRegistration } from '@/types/database';
import { reserveEventAction, cancelEventAction, createTeamAction } from '@/lib/actions/events';
import { ActionForm, CopyLink, MutationButton } from './ActionForm';

export function EventControls({ event, userId, registration, freeSeats, origin, queuePosition, maxTeamSize = 0, teamFreeSlots = 0, isAvailable = true }: { event: GameEvent; userId?: string; registration: EventRegistration | null; freeSeats: number; origin: string; queuePosition?: number | null; maxTeamSize?: number; teamFreeSlots?: number; isAvailable?: boolean }) {
  const open = event.status === 'open' && new Date(event.starts_at).getTime() > Date.now();
  const active = registration && registration.status !== 'cancelled';
  const team = registration?.event_teams;
  return <section className="panel">
    <p className="mb-4 flex items-center gap-2 text-xs text-amber-200"><Ticket size={16} aria-hidden="true" />Jūsų registracija</p>
    {!isAvailable ? <p role="status" className="text-sm text-amber-200">Registracijos duomenys šiuo metu nepasiekiami. Atnaujinkite puslapį arba bandykite vėliau.</p> : !userId ? <><h2 className="text-xl font-semibold">Susitinkame prie stalo.</h2><p className="my-4 text-sm text-slate-400">Prisijunkite ir rezervuokite vietą sau arba savo komandai.</p><div className="flex flex-wrap gap-3"><Link className="primary-button" href={`/auth/login?next=/events/${event.id}`}>Prisijungti</Link><Link className="secondary-button" href={`/auth/register?next=/events/${event.id}`}>Registruotis</Link></div></> : active ? <>
      <h2 className="text-xl font-semibold">{registration.status === 'waiting' ? 'Esate laukiančiųjų eilėje' : 'Vieta rezervuota!'}</h2>
      {registration.status === 'waiting' ? <p className="my-4 text-sm text-slate-400 flex gap-2"><Clock3 size={18} className="shrink-0" aria-hidden="true" />{open ? `Jūsų vieta eilėje: ${queuePosition || 'tikslinama'}. Atlaisvinta vieta bus priskirta automatiškai. Savo būseną rasite šiame puslapyje.` : 'Renginio registracija uždaryta. Laukiantiems žaidėjams vietos šiuo metu nebeskirstomos.'}</p> : <p className="my-4 text-sm text-slate-400">{event.status === 'open' ? 'Jūsų bilietas ir atvykimo QR kodas pateikti žemiau.' : 'Jūsų rezervacija išsaugota šio renginio istorijoje.'}{team && ` Komanda: ${team.name}.`}</p>}
      {team?.owner_id === userId && open && teamFreeSlots > 0 && <div className="my-5 border-t border-slate-700 pt-4"><p className="text-sm text-slate-300 mb-3">Pakvieskite draugus į likusias {teamFreeSlots} komandos vietas. Pakvietimas veikia tik kol yra komandai laikomų vietų.</p><CopyLink url={`${origin}/invite/${team.invite_token}`} /></div>}
      {event.status !== 'completed' && <MutationButton action={cancelEventAction.bind(null, event.id, undefined)} confirmMessage={team?.owner_id === userId ? 'Atšaukti visos komandos rezervaciją? Visi komandos nariai praras šio renginio vietas, o pakvietimas nebegalios.' : 'Atšaukti šio renginio registraciją?'}>{team?.owner_id === userId ? 'Atšaukti komandos rezervaciją' : 'Atšaukti registraciją'}</MutationButton>}
    </> : !open ? <p className="text-sm text-slate-400">Registracija į šį renginį uždaryta.</p> : <>
      <h2 className="text-xl font-semibold">Viena vieta ar visa komanda?</h2><p className="my-4 text-sm leading-relaxed text-slate-400">{freeSeats ? 'Vietą jums parinksime atsitiktinai. Komandai rezervuosime vietas prie vieno stalo.' : 'Salė pilna. Prisijunkite prie eilės — atlaisvinta vieta atiteks pirmam laukiančiam žaidėjui.'}</p>
      <MutationButton action={reserveEventAction.bind(null, event.id)}>{freeSeats ? 'Rezervuoti vietą sau' : 'Prisijungti prie laukiančiųjų eilės'}</MutationButton>
      {maxTeamSize >= 2 && <div className="mt-5 border-t border-slate-700 pt-5"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Users size={16} aria-hidden="true" />Rezervuoti komandai</h3><ActionForm action={createTeamAction.bind(null, event.id)} label="Sukurti komandą"><label className="field-label">Komandos pavadinimas<input className="field mt-2" name="team_name" required minLength={2} maxLength={60} placeholder="Smalsūs protai" /></label><label className="field-label">Komandos dydis (įskaitant jus)<select className="field mt-2" name="capacity" defaultValue={maxTeamSize}>{[2,3,4].filter(n => n <= maxTeamSize).map(n => <option key={n} value={n}>{n} žaidėjai</option>)}</select></label><p className="text-xs text-slate-400">Komandos vietos laikomos iki renginio pradžios arba rezervacijos atšaukimo.</p></ActionForm></div>}
    </>}
  </section>;
}
