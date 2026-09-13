import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/events';
import { EventRegistration } from '@/types/database';

export default async function ReservationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/reservations');
  const { data, error } = await supabase.from('event_registrations')
    .select('*, game_events(*), event_seats(table_number,seat_number)')
    .eq('user_id', user.id).in('status', ['reserved', 'waiting']);
  const registrations = ((data || []) as EventRegistration[])
    .filter(r => r.game_events && r.game_events.status !== 'cancelled')
    .sort((a, b) => {
      const aOpen = a.game_events!.status === 'open';
      const bOpen = b.game_events!.status === 'open';
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      const diff = Date.parse(a.game_events!.starts_at) - Date.parse(b.game_events!.starts_at);
      return aOpen ? diff : -diff;
    });
  return <div className="mx-auto max-w-6xl px-5 sm:px-8">
    <p className="mb-3 flex items-center gap-2 text-xs text-amber-200"><Ticket size={16} aria-hidden="true" />Jūsų žaidimai</p>
    <h1 className="mb-3 text-3xl font-bold">Mano bilietai</h1>
    <p className="mb-8 text-sm text-slate-400">Čia rasite savo vietą, laukiančiųjų registraciją ir bilietą net prasidėjus žaidimui.</p>
    {error ? <p role="status" className="panel text-sm text-amber-200">Bilietų duomenys šiuo metu nepasiekiami. Bandykite dar kartą vėliau.</p> : !registrations.length ? <section className="panel py-10 text-center">
      <Ticket size={30} className="mx-auto mb-4 text-slate-500" aria-hidden="true" />
      <h2 className="text-lg font-semibold">Jūsų kitas vakaras dar laukia</h2>
      <p className="mb-5 mt-2 text-sm text-slate-400">Pasirinkite renginį ir rezervuokite vietą sau arba komandai.</p>
      <Link href="/" className="primary-button">Rasti renginį</Link>
    </section> : <div className="grid gap-5 md:grid-cols-2">
      {registrations.map(r => <article key={r.id} className="panel">
        <p className="mb-3 text-xs text-amber-200">{r.game_events!.status === 'completed' ? 'Jau sužaidėme' : r.status === 'waiting' ? 'Laukiančiųjų eilėje' : r.checked_in_at ? 'Atvykimas patvirtintas' : 'Vieta rezervuota'}</p>
        <h2 className="text-xl font-semibold">{r.game_events!.title}</h2>
        <p className="mt-3 text-sm text-slate-300">{formatEventDate(r.game_events!.starts_at)}</p>
        <p className="mt-2 text-sm text-slate-400">{r.game_events!.location}</p>
        {r.event_seats && <p className="mt-4 text-sm text-emerald-200">Stalas {r.event_seats.table_number} · vieta {r.event_seats.seat_number}</p>}
        <Link href={`/events/${r.event_id}`} className="secondary-button mt-5">{r.status === 'waiting' ? 'Peržiūrėti registraciją' : 'Atidaryti bilietą ir renginį'}</Link>
      </article>)}
    </div>}
    <Link href="/hall" className="mt-8 inline-block text-xs text-slate-400 hover:text-amber-200">Ankstesnė salė ir jos rezervacija →</Link>
  </div>;
}
