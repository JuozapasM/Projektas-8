import { createClient } from '@/lib/supabase/server';
import { HallMap } from '@/components/HallMap';
import { UserControls } from '@/components/UserControls';
import { Seat } from '@/types/database';

export const revalidate = 0;

export default async function HomePage() {
  let seats: Seat[] = [];
  let currentUser: { id: string; username: string } | null = null;
  let userSeat: Seat | null = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const isSupabaseConfigured =
    Boolean(url) &&
    !url?.includes('your-supabase') &&
    !url?.includes('placeholder');

  try {
    const supabase = await createClient();

    // Fetch seats with username profile
    const { data: seatsData } = await supabase
      .from('seats')
      .select('*, profiles(username)')
      .order('table_number', { ascending: true })
      .order('seat_number', { ascending: true });

    if (seatsData && seatsData.length > 0) {
      seats = seatsData as Seat[];
    }

    // Get auth user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

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

  return (
    <div className="container mx-auto px-4">
      {!isSupabaseConfigured && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm text-center">
          <strong>Supabase dar nekonfigūruotas!</strong>
          <br />
          Sukurkite <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">.env.local</code> failą ir įrašykite savo <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">NEXT_PUBLIC_SUPABASE_URL</code> bei <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
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
