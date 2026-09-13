import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminTable } from '@/components/AdminTable';

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();

  // Fetch profiles with seats
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .order('created_at', { ascending: false });

  const { data: seats } = await supabase
    .from('seats')
    .select('table_number, seat_number, user_id');

  const usersWithSeats = (profiles || []).map((p) => {
    const s = (seats || []).find((st) => st.user_id === p.id);
    return {
      ...p,
      seat: s ? { table_number: s.table_number, seat_number: s.seat_number } : null,
    };
  });

  return (
    <div className="container mx-auto px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white">Administratoriaus Skydelis</h1>
        <p className="text-sm text-slate-400">
          Peržiūrėkite visus prisiregistravusius vartotojus ir jų vietas prie stalų.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6"><Link className="primary-button" href="/admin/events">Renginių valdymas</Link><Link className="secondary-button" href="/admin/check-in">Atvykimo registracija</Link></div>
      <AdminTable users={usersWithSeats} />
    </div>
  );
}
