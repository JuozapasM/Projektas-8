import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { getSiteOrigin } from '@/lib/site';
import { isUuid, formatEventDate, eventStatusLabels } from '@/lib/events';
import { GameEvent, Seat, EventRegistration, EventResult } from '@/types/database';
import { HallMap } from '@/components/HallMap';
import { EventControls } from '@/components/EventControls';
import { ResultsTable } from '@/components/ResultsTable';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  if (!getSupabaseEnv().isConfigured) return <div className="max-w-6xl mx-auto px-5"><p role="status" className="panel">Renginio duomenys šiuo metu nepasiekiami.</p></div>;
  const supabase = await createClient();
  const { data, error } = await supabase.from('game_events').select('*').eq('id', id).maybeSingle();
  if (error) return <div className="max-w-6xl mx-auto px-5"><p role="status" className="panel">Renginio duomenys šiuo metu nepasiekiami.</p></div>;
  if (!data) notFound();
  const event = data as GameEvent;
  const [{ data: seatsData, error: seatsError }, { data: { user } }] = await Promise.all([supabase.from('event_seats').select('*, profiles(username)').eq('event_id', id).order('table_number').order('seat_number'), supabase.auth.getUser()]);
  const seats = (seatsData || []) as Seat[];
  let registration: EventRegistration | null = null;
  if (user) { const { data } = await supabase.from('event_registrations').select('*, event_teams(*)').eq('event_id', id).eq('user_id', user.id).maybeSingle(); registration = data as EventRegistration | null; }
  const { data: queuePosition } = registration?.status === 'waiting' ? await supabase.rpc('get_event_waitlist_position', { p_event_id: id }) : { data: null };
  const origin = await getSiteOrigin();
  const seat = seats.find(s => s.user_id === user?.id);
  const ticket = registration?.status === 'reserved' && event.status !== 'cancelled';
  const qr = ticket && event.status === 'open' ? await QRCode.toDataURL(`${origin}/admin/check-in?token=${registration!.checkin_token}`, { width: 180, margin: 2 }) : null;
  const { data: resultData } = event.results_published ? await supabase.from('event_results').select('*').eq('event_id', id).order('points', { ascending: false }) : { data: [] };
  return <div className="max-w-6xl mx-auto px-5 sm:px-8"><Link href="/" className="text-sm text-slate-400 hover:text-amber-200">← Visi renginiai</Link><div className="grid lg:grid-cols-2 gap-8 items-start mt-6 mb-9"><header><p className="text-xs text-amber-200 mb-3">{eventStatusLabels[event.status]}</p><h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{event.title}</h1><p className="mt-4 text-slate-300">{formatEventDate(event.starts_at)}</p><p className="mt-2 text-sm text-slate-400">{event.location} · Lietuvos laikas</p><p className="mt-5 text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{event.description}</p></header><EventControls event={event} userId={user?.id} registration={registration} freeSeats={seats.filter(s => !s.user_id && !s.team_id).length} origin={origin} queuePosition={queuePosition} /></div>
    {ticket && <section className="panel mb-8 flex flex-wrap items-center justify-between gap-6"><div><p className="text-xs uppercase tracking-widest text-amber-200 mb-3">Jūsų bilietas</p><h2 className="text-xl font-semibold">{seat ? `Stalas ${seat.table_number} · vieta ${seat.seat_number}` : 'Vieta rezervuota'}</h2><p className="text-sm text-slate-400 mt-2">{registration!.checked_in_at ? 'Atvykimas pažymėtas. Gero žaidimo!' : qr ? 'Atvykę parodykite šį QR kodą organizatoriui.' : 'Šio renginio registracija jau baigta.'}</p></div>{qr && <Image src={qr} width={180} height={180} unoptimized alt="Jūsų rezervacijos QR kodas atvykimo registracijai" className="rounded-xl" />}</section>}
    {event.results_published && event.status === 'completed' && <section className="mb-8"><h2 className="text-2xl font-semibold mb-5">Žaidimo rezultatai</h2><ResultsTable results={(resultData || []) as EventResult[]} /></section>}
    {seatsError || seats.length !== 24 ? <p role="status" className="panel">Salės duomenys šiuo metu nepasiekiami.</p> : <HallMap initialSeats={seats} currentUserId={user?.id} eventId={id} />}
  </div>;
}
