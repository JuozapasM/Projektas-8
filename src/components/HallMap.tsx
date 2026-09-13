'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, Radio, X } from 'lucide-react';
import { Seat } from '@/types/database';
import { TableCard } from './TableCard';
import { createClient } from '@/lib/supabase/client';

export function HallMap({ initialSeats, currentUserId, isAvailable = true }: { initialSeats: Seat[]; currentUserId?: string | null; isAvailable?: boolean }) {
  const router = useRouter();
  const [seats, setSeats] = useState(initialSeats);
  const [search, setSearch] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSeats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await createClient().from('seats').select('*, profiles(username)').order('table_number').order('seat_number');
      if (error || !data?.length) throw new Error('Vietų duomenys nepasiekiami. Bandykite dar kartą.');
      setSeats(data as Seat[]);
      setError(null);
      // Refresh the user's reservation controls as well as the map.
      router.refresh();
    } catch {
      setError('Nepavyko atnaujinti vietų. Rodomi paskutiniai gauti duomenys.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { setSeats(initialSeats); }, [initialSeats]);
  useEffect(() => {
    if (!isAvailable) return;
    const supabase = createClient();
    const channel = supabase.channel('realtime_seats').on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, () => { void fetchSeats(); })
      .subscribe(status => {
        setLive(status === 'SUBSCRIBED');
        // Catch changes between the server render and the subscription.
        if (status === 'SUBSCRIBED') void fetchSeats();
      });
    return () => { void supabase.removeChannel(channel); };
  }, [isAvailable, fetchSeats]);

  const occupied = seats.filter(s => !!s.user_id).length;
  const query = search.toLocaleLowerCase('lt-LT').trim();
  const tables = [1, 2, 3, 4, 5, 6].map(n => ({ number: n, seats: seats.filter(s => s.table_number === n) }))
    .filter(t => (!onlyFree || t.seats.some(s => !s.user_id)) && (!query || `stalas ${t.number}`.includes(query) || t.seats.some(s => s.profiles?.username.toLocaleLowerCase('lt-LT').includes(query))));

  return (
    <section id="sale" className="scroll-mt-28">
      <div className="flex flex-wrap justify-between gap-4 items-end mb-5">
        <div><p className="text-[10px] tracking-[.2em] uppercase text-amber-200/70 mb-2">Susitinkame čia</p><h2 className="text-2xl font-semibold tracking-tight">Žaidimo salė</h2><p className="text-sm text-slate-400 mt-2">{isAvailable ? <><span className="text-emerald-200">{seats.length - occupied} laisvos vietos</span> · {occupied} iš {seats.length} užimta</> : 'Vietų užimtumas šiuo metu nežinomas'}</p></div>
        <div className="flex items-center gap-3"><span role="status" className={`inline-flex items-center gap-1.5 text-[11px] ${live ? 'text-emerald-200/80' : 'text-slate-400'}`}><Radio size={13} aria-hidden="true" />{!isAvailable ? 'Peržiūros režimas' : live ? 'Atnaujinama gyvai' : 'Gyvas ryšys neprijungtas'}</span><button onClick={() => isAvailable ? void fetchSeats() : router.refresh()} disabled={loading} aria-label="Atnaujinti salės duomenis" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-amber-200 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-5">
        <div className="relative sm:w-72"><Search size={15} className="absolute left-3 top-3.5 text-slate-500" aria-hidden="true" /><input aria-label="Ieškoti žaidėjo arba stalo" placeholder="Žaidėjo vardas arba stalas…" value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-[#111824] py-3 pl-9 pr-9 text-xs placeholder:text-slate-500" />{search && <button aria-label="Išvalyti paiešką" onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-400"><X size={16} /></button>}</div>
        <label className={`flex items-center gap-2 text-xs text-slate-400 ${!isAvailable ? 'opacity-50' : ''}`}><input type="checkbox" checked={onlyFree} disabled={!isAvailable} onChange={e => setOnlyFree(e.target.checked)} className="accent-amber-200 h-4 w-4" />Tik stalai su laisvomis vietomis</label>
      </div>
      {error && <p role="alert" className="text-sm text-amber-200 mb-4">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{tables.map(t => <TableCard key={t.number} tableNumber={t.number} seats={t.seats} currentUserId={currentUserId} isAvailable={isAvailable} />)}</div>
      {!tables.length && <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center"><p className="text-sm text-slate-400">Pagal pasirinktus kriterijus stalų nerasta.</p><button onClick={() => { setSearch(''); setOnlyFree(false); }} className="text-sm text-amber-200 mt-3">Išvalyti filtrus</button></div>}
      <div className="flex flex-wrap gap-5 text-[11px] text-slate-400 mt-5">{[['bg-emerald-200/70', 'Laisva vieta'], ['bg-slate-500', 'Užimta vieta'], ['bg-amber-200', 'Jūsų vieta']].map(([color, label]) => <span key={label} className="inline-flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}</div>
    </section>
  );
}
