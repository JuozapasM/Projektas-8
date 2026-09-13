import { createClient } from '@/lib/supabase/server';
import { AdminHistoryTable } from '@/components/AdminHistoryTable';
import { SeatHistory } from '@/types/database';

export const revalidate = 0;

export default async function AdminHistoryPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seat_history')
    .select('*')
    .order('created_at', { ascending: false });

  const history = (data || []) as SeatHistory[];

  return (
    <div className="container mx-auto px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white">Vietų Rezervacijų Istorija</h1>
        <p className="text-sm text-slate-400">
          Užimtų ir atlaisvintų vietų žurnalas.
        </p>
      </div>

      {error ? <p role="status" className="panel text-sm text-amber-200">Rezervacijų istorija šiuo metu nepasiekiama. Bandykite vėliau.</p> : <AdminHistoryTable history={history} />}
    </div>
  );
}
