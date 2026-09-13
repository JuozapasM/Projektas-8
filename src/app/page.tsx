import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { HallMap } from '@/components/HallMap';
import { UserControls } from '@/components/UserControls';
import { Sparkles, ArrowDown, Armchair, Users, LayoutGrid } from 'lucide-react';
import { Seat } from '@/types/database';

export const revalidate = 0;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  let seats: Seat[] = [];
  let currentUser: { id: string; username: string } | null = null;
  let userSeat: Seat | null = null;
  let hasDbConnection = false;
  let dbError = false;

  const { isConfigured: isEnvConfigured } = getSupabaseEnv();

  try {
    if (!isEnvConfigured) throw new Error("Supabase is not configured");
    const supabase = await createClient();

    // Fetch seats with username profile
    const { data: seatsData, error: seatsError } = await supabase
      .from('seats')
      .select('*, profiles(username)')
      .order('table_number', { ascending: true })
      .order('seat_number', { ascending: true });

    if (seatsData && !seatsError) {
      seats = seatsData as Seat[];
      hasDbConnection = seats.length === 24;
    } else if (seatsError) {
      console.error('Failed to fetch seats:', seatsError);
      dbError = true;
    }

    // Get auth user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to fetch profile for user', user.id, profileError);
      }

      if (profile) {
        currentUser = {
          id: user.id,
          username: profile.username,
        };

        userSeat = seats.find((s) => s.user_id === user.id) || null;
      }
    }
  } catch (err) {
    if (isEnvConfigured) console.error('Home page data fetch error:', err);
    dbError = true;
  }

  // Fallback: Generate 24 empty seats (6 tables x 4 seats) if DB returns 0 seats
  if (seats.length === 0) {
    for (let t = 1; t <= 6; t++) {
      for (let s = 1; s <= 4; s++) {
        seats.push({
          id: `default-${t}-${s}`,
          table_number: t,
          seat_number: s,
          user_id: null,
          updated_at: new Date().toISOString(),
          profiles: null,
        });
      }
    }
  }

  const showConfigWarning = !hasDbConnection && !isEnvConfigured;
  const showConnectionError = !hasDbConnection && isEnvConfigured && dbError;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8">
      {(showConfigWarning || showConnectionError || !hasDbConnection) && (
        <div role="status" className="mb-8 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100/80">
          <strong className="text-amber-200">Salės peržiūros režimas.</strong>{' '}
          Vietų užimtumo duomenys šiuo metu nepasiekiami. Rezervacijos bus galimos atkūrus ryšį.
        </div>
      )}

      {notice === 'seat-unavailable' && <p role="status" className="mb-6 rounded-xl border border-amber-200/20 p-4 text-sm text-amber-200">Paskyra sukurta, tačiau vietos rezervuoti nepavyko. Pabandykite gauti vietą naudodami rezervacijos mygtuką.</p>}
      <section className="grid lg:grid-cols-[1.2fr_1fr] items-center gap-8 lg:gap-16 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/5 px-3 py-1.5 text-[11px] font-semibold tracking-[.16em] uppercase text-amber-200 mb-5">
            <Sparkles size={13} aria-hidden="true" /> Geros kompanijos. Geri klausimai.
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.12] text-white">
            Tavo vieta<br /><span className="text-amber-200">geram žaidimui.</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-slate-400 leading-relaxed max-w-md">
            Susitikime prie „Auksinio Proto“ stalo. Prisijunk, gauk savo vietą ir pasiruošk vakarui, kuriame laimi smalsumas.
          </p>
          <a href="#sale" className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-amber-200 transition-colors">
            Peržiūrėti žaidimo salę <ArrowDown size={15} aria-hidden="true" />
          </a>
        </div>
        <UserControls user={currentUser} userSeat={userSeat} isAvailable={hasDbConnection} />
      </section>

      <div className="grid grid-cols-3 border-y border-slate-800/80 py-5 mb-9">
        {[
          { icon: LayoutGrid, value: '6', label: 'žaidimo stalai' },
          { icon: Users, value: '4', label: 'žaidėjai prie stalo' },
          { icon: Armchair, value: '24', label: 'vietos smalsiems' },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center justify-center gap-3 sm:gap-4 border-r last:border-0 border-slate-800">
            <Icon className="hidden sm:block text-slate-500" size={22} strokeWidth={1.5} aria-hidden="true" />
            <div><span className="text-2xl font-semibold text-slate-100">{value}</span><p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{label}</p></div>
          </div>
        ))}
      </div>
      <HallMap initialSeats={seats} currentUserId={currentUser?.id} isAvailable={hasDbConnection} />
      <section className="mt-10 rounded-2xl border border-slate-800/70 p-5 sm:p-6 flex flex-col sm:flex-row gap-5 justify-between text-sm">
        <div><h2 className="font-semibold text-slate-200">Kaip tai veikia?</h2><p className="mt-1 text-slate-400">Trys žingsniai iki tavo vietos.</p></div>
        <ol className="flex flex-wrap gap-x-7 gap-y-3 text-slate-400">
          {['Sukurk paskyrą', 'Gauk atsitiktinę vietą', 'Prisijunk prie žaidimo'].map((step, i) => <li key={step} className="flex items-center gap-2"><span className="text-amber-200/70 font-mono text-xs">0{i + 1}</span>{step}</li>)}
        </ol>
      </section>
    </div>
  );
}
