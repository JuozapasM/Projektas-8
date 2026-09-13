import { Armchair, UserRound } from 'lucide-react';
import { Seat } from '@/types/database';

export function SeatSquare({ seat, isCurrentUserSeat, isAvailable = true }: { seat: Seat; isCurrentUserSeat?: boolean; isAvailable?: boolean }) {
  const occupied = !!seat.user_id || !!seat.team_id;
  const name = seat.profiles?.username || (seat.team_id ? 'Komandai' : 'Užimta');
  const label = !isAvailable ? 'Nežinoma' : occupied ? name : 'Laisva';
  const Icon = occupied ? UserRound : Armchair;
  return (
    <div title={`Stalas ${seat.table_number}, vieta ${seat.seat_number}: ${label}${isCurrentUserSeat ? ' (jūsų vieta)' : ''}`}
      className={`min-w-0 rounded-xl border p-3 flex items-center gap-3 ${!isAvailable ? 'border-slate-700/60 bg-slate-800/20 text-slate-400' : isCurrentUserSeat ? 'border-amber-200/50 bg-amber-200/10 text-amber-200' : occupied ? 'border-slate-700/60 bg-slate-800/60 text-slate-300' : 'border-emerald-300/15 bg-emerald-300/[.04] text-emerald-200/80'}`}>
      <Icon size={18} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
      <div className="min-w-0"><p className="text-xs font-medium truncate">{label}</p><p className="mt-1 text-[10px] opacity-70">{isCurrentUserSeat ? 'Jūsų · ' : ''}Vieta {seat.seat_number}</p></div>
    </div>
  );
}
