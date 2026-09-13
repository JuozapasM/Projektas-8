import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { HallMap } from '@/components/HallMap';
import { UserControls } from '@/components/UserControls';
import { Seat } from '@/types/database';

export const revalidate = 0;

export default async function HomePage() {
  let seats: Seat[] = [];
  let currentUser: { id: string; username: string } | null = null;
  let userSeat: Seat | null = null;
  let hasDbConnection = false;
  let dbError = false;

  const { isConfigured: isEnvConfigured } = getSupabaseEnv();

  try {
    const supabase = await createClient();

    // Fetch seats with username profile
    const { data: seatsData, error: seatsError } = await supabase
      .from('seats')
      .select('*, profiles(username)')
      .order('table_number', { ascending: true })
      .order('seat_number', { ascending: true });

    if (seatsData && !seatsError) {
      seats = seatsData as Seat[];
      hasDbConnection = true;
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
    console.error('Home page data fetch error:', err);
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
    <div className="container mx-auto px-4">
      {showConfigWarning && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm text-center">
          <strong>Supabase dar nekonfigūruotas!</strong>
          <br />
          Įsitikinkite, kad <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">NEXT_PUBLIC_SUPABASE_URL</code> bei <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> įrašyti Vercel skiltyje <em>Settings -&gt; Environment Variables</em> arba <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">.env.local</code> faile.
        </div>
      )}

      {showConnectionError && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm text-center">
          <strong>Nepavyko prisijungti prie Supabase.</strong>
          <br />
          Aplinkos kintamieji atrodo sukonfigūruoti, bet užklausa nepavyko — patikrinkite raktų teisingumą ir RLS taisykles. Daugiau informacijos serverio žurnale.
        </div>
      )}

      <div className="text-center max-w-2xl mx-auto mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
          Žaidimo Salė & Stalų Rezervacija
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Šeši numeruoti stalai po 4 vietas. Užimtos vietos matomos su žaidėjo vardu, laisvos vietos – tušti žali kvadratai.
        </p>
      </div>

      <UserControls user={currentUser} userSeat={userSeat} />

      <HallMap initialSeats={seats} currentUserId={currentUser?.id} />
    </div>
  );
}
