import { Seat } from '@/types/database';
import { SeatSquare } from './SeatSquare';

export function TableCard({ tableNumber, seats, currentUserId, isAvailable = true }: { tableNumber: number; seats: Seat[]; currentUserId?: string | null; isAvailable?: boolean }) {
  const free = seats.filter(s => !s.user_id).length;
  const yours = !!currentUserId && seats.some(s => s.user_id === currentUserId);
  return (
    <article className={`rounded-2xl border p-5 bg-[#111824] ${yours ? 'border-amber-200/40' : 'border-slate-800'} transition-colors hover:border-slate-600`}>
      <div className="flex justify-between items-center mb-5">
        <div className="flex gap-3 items-center"><span className="font-mono text-lg text-slate-500">{String(tableNumber).padStart(2, '0')}</span><h3 className="text-sm font-semibold text-slate-100">Stalas {tableNumber}</h3></div>
        <span className={`text-[10px] rounded-full px-2.5 py-1 border ${yours ? 'text-amber-200 bg-amber-200/5 border-amber-200/20' : 'text-slate-400 border-slate-700/60'}`}>{!isAvailable ? 'Peržiūra' : yours ? 'Jūsų stalas' : free ? `${free} laisvos` : 'Užimtas'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[...seats].sort((a, b) => a.seat_number - b.seat_number).map(seat => <SeatSquare key={seat.id} seat={seat} isCurrentUserSeat={!!currentUserId && seat.user_id === currentUserId} isAvailable={isAvailable} />)}
      </div>
      <div className="mt-5 flex items-center justify-between text-[10px] text-slate-400"><span>4 vietos prie stalo</span><span>{isAvailable ? `${seats.length - free} / ${seats.length} užimta` : 'Užimtumas nežinomas'}</span></div>
      <div className="mt-2 flex gap-1" aria-hidden="true">{seats.map(s => <span key={s.id} className={`h-1 flex-1 rounded-full ${isAvailable && s.user_id ? 'bg-amber-200/60' : 'bg-slate-800'}`} />)}</div>
    </article>
  );
}
