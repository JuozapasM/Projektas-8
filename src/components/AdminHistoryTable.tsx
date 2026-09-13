import React from 'react';
import { SeatHistory } from '@/types/database';

interface AdminHistoryTableProps {
  history: SeatHistory[];
}

export const AdminHistoryTable: React.FC<AdminHistoryTableProps> = ({ history }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white">Vietų Rezervacijos & Atšaukimų Istorija</h2>
        <p className="text-xs text-slate-400 mt-1">
          Pilnas chronologinis visų atliktų rezervacijų ir vietų atlaisvinimų audito žurnalas.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Laikas</th>
              <th className="px-6 py-4">Dalyvio vardas</th>
              <th className="px-6 py-4">Stalas</th>
              <th className="px-6 py-4">Vieta</th>
              <th className="px-6 py-4">Veiksmas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                  Istorijoje įrašų dar nėra.
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    {new Date(item.created_at).toLocaleString('lt-LT')}
                  </td>
                  <td className="px-6 py-4 font-semibold text-white">{item.username}</td>
                  <td className="px-6 py-4 font-bold text-amber-400">Stalas {item.table_number}</td>
                  <td className="px-6 py-4 font-bold text-slate-200">Vieta {item.seat_number}</td>
                  <td className="px-6 py-4">
                    {item.action === 'RESERVED' && (
                      <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                        UŽREZERVUOTA
                      </span>
                    )}
                    {item.action === 'CANCELLED' && (
                      <span className="inline-block px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold">
                        ATŠAUKTA (ŽAIDĖJO)
                      </span>
                    )}
                    {item.action === 'ADMIN_REMOVED' && (
                      <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold">
                        ATLAISVINTA (ADMIN)
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
