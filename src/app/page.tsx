import Link from 'next/link';
import { CalendarDays, Users, Ticket, ArrowDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { GameEvent } from '@/types/database';
import { EventCard } from '@/components/EventCard';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  let events: GameEvent[] = []; let available = false;
  if (getSupabaseEnv().isConfigured) {
    try {
      const { data, error } = await (await createClient()).from('game_events').select('*').neq('status', 'draft').order('starts_at');
      if (!error && data) { events = data as GameEvent[]; available = true; }
    } catch { /* Show the unavailable state. */ }
  }
  const upcoming = events.filter(e => e.status === 'open' && new Date(e.starts_at).getTime() > Date.now());
  const previous = events.filter(e => e.status === 'completed').reverse();
  return <div className="max-w-6xl mx-auto px-5 sm:px-8">
    {notice === 'email-confirmed' && <p role="status" className="panel mb-6 text-sm text-emerald-200">El. paštas patvirtintas. Galite rezervuoti vietą renginyje.</p>}
    <section className="grid lg:grid-cols-[1.25fr_1fr] gap-10 items-center mb-10"><div><p className="inline-flex gap-2 rounded-full border border-amber-200/20 px-3 py-2 text-xs text-amber-200 mb-5"><CalendarDays size={15} aria-hidden="true" />Susitikime kitame žaidime</p><h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">Geri klausimai.<br /><span className="text-amber-200">Dar geresnė kompanija.</span></h1><p className="mt-5 text-slate-400 leading-relaxed max-w-lg">Pasirink „Auksinio Proto“ vakarą, rezervuok vietą sau ar savo komandai ir susitikime prie stalo.</p><a className="inline-flex gap-2 items-center mt-6 text-sm text-amber-200" href="#renginiai">Rasti savo žaidimą<ArrowDown size={16} aria-hidden="true" /></a></div><div className="panel space-y-5">{[{icon: CalendarDays,title:'Pasirink vakarą',text:'Aiški data, laikas ir susitikimo vieta.'},{icon: Users,title:'Ateik su komanda',text:'2–4 vietos prie vieno stalo ir pakvietimas draugams.'},{icon: Ticket,title:'Turėk bilietą po ranka',text:'Tavo rezervacija ir QR kodas atvykimo registracijai.'}].map(({icon:Icon,title,text}) => <div key={title} className="flex gap-4"><Icon size={21} className="text-amber-200 shrink-0 mt-1" aria-hidden="true" /><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-400 mt-1">{text}</p></div></div>)}</div></section>
    <section id="renginiai" className="scroll-mt-28"><div className="flex items-end justify-between flex-wrap gap-3 mb-5"><div><p className="text-xs tracking-widest uppercase text-amber-200/70 mb-2">Kalendorius</p><h2 className="text-2xl font-semibold">Artimiausi žaidimai</h2></div><Link href="/results" className="text-sm text-slate-400 hover:text-amber-200">Ankstesnių žaidimų rezultatai →</Link></div>
      {!available ? <div role="status" className="panel text-sm text-slate-400">Renginių kalendorius šiuo metu nepasiekiamas. <Link href="/hall" className="text-amber-200">Atidaryti esamą salę</Link>.</div> : !upcoming.length ? <div className="panel text-center py-10"><CalendarDays size={28} className="mx-auto text-slate-500 mb-3" aria-hidden="true" /><p className="text-slate-300">Artimiausi žaidimai dar nepaskelbti.</p><p className="text-sm text-slate-400 mt-2">Užsukite vėliau — organizatorius čia paskelbs kitą vakarą.</p></div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{upcoming.map(e => <EventCard key={e.id} event={e} />)}</div>}
    </section>
    {!!previous.length && <section className="mt-10"><h2 className="text-2xl font-semibold mb-5">Jau sužaidėme</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{previous.slice(0,6).map(e => <EventCard key={e.id} event={e} />)}</div></section>}
    <div className="mt-8 text-xs text-slate-400"><Link href="/hall" className="hover:text-amber-200">Esama salė ir ankstesnės rezervacijos</Link></div>
  </div>;
}
