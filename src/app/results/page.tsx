import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { GameEvent, EventResult } from '@/types/database';
import { formatEventDate } from '@/lib/events';
import { ResultsTable } from '@/components/ResultsTable';

export default async function ResultsPage() {
  let events: GameEvent[] = []; let results: EventResult[] = []; let available = false;
  if (getSupabaseEnv().isConfigured) {
    const supabase = await createClient();
    const { data, error } = await supabase.from('game_events').select('*').eq('status','completed').eq('results_published',true).order('starts_at',{ascending:false});
    if (!error) { available = true; events = (data || []) as GameEvent[]; if (events.length) { const { data } = await supabase.from('event_results').select('*').in('event_id',events.map(e => e.id)); results = (data || []) as EventResult[]; } }
  }
  return <div className="max-w-6xl mx-auto px-5 sm:px-8"><p className="text-amber-200 text-xs inline-flex items-center gap-2 mb-3"><Trophy size={16} aria-hidden="true" />Žaidimų istorija</p><h1 className="text-3xl font-bold mb-3">Rezultatų lentelė</h1><p className="text-sm text-slate-400 mb-8">Ankstesni vakarai, komandos ir surinkti taškai. Vienodai taškų surinkusios komandos dalijasi vieta.</p>{!events.length && <p className="panel text-slate-400">{available ? 'Paskelbtų rezultatų dar nėra.' : 'Rezultatai šiuo metu nepasiekiami.'}</p>}<div className="space-y-8">{events.map(e => <section key={e.id} className="panel"><div className="flex flex-wrap justify-between gap-3 mb-5"><div><h2 className="text-xl font-semibold">{e.title}</h2><p className="text-xs text-slate-400 mt-2">{formatEventDate(e.starts_at)} · {e.location}</p></div><Link className="text-sm text-amber-200" href={`/events/${e.id}`}>Renginio puslapis →</Link></div><ResultsTable results={results.filter(r => r.event_id === e.id)} /></section>)}</div></div>;
}
