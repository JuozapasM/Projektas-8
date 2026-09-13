'use client';

import React, { useTransition } from 'react';
import { adminRemoveSeatAction } from '@/lib/actions/seats';

interface UserWithSeat {
  id: string;
  username: string;
  role: string;
  created_at: string;
  seat: {
    table_number: number;
    seat_number: number;
  } | null;
}

interface AdminTableProps {
  users: UserWithSeat[];
}

export const AdminTable: React.FC<AdminTableProps> = ({ users }) => {
  const [isPending, startTransition] = useTransition();

  const handleRemoveSeat = (userId: string) => {
    if (!confirm('Ar tikrai norite atlaisvinti šio dalyvio vietą?')) return;

    startTransition(async () => {
      await adminRemoveSeatAction(userId);
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Prisiregistravę Vartotojai</h2>
          <p className="text-xs text-slate-400 mt-1">
            Visi užregistruoti žaidėjai ir jų priskirtos vietos salėje.
          </p>
        </div>
        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold">
          Viso žaidėjų: {users.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Vartotojo vardas</th>
              <th className="px-6 py-4">Rolė</th>
              <th className="px-6 py-4">Priskirta vieta</th>
              <th className="px-6 py-4">Registracijos data</th>
              <th className="px-6 py-4 text-right">Veiksmai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-white">{u.username}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-2.5 py-1 text-xs rounded-md font-semibold ${
                      u.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.seat ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                      Stalas {u.seat.table_number}, Vieta {u.seat.seat_number}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Be vietos</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                  {new Date(u.created_at).toLocaleString('lt-LT')}
                </td>
                <td className="px-6 py-4 text-right">
                  {u.seat && (
                    <button
                      onClick={() => handleRemoveSeat(u.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      Atlaisvinti vietą
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
