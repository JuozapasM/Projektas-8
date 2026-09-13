import React from 'react';
import { Seat } from '@/types/database';

interface SeatSquareProps {
  seat: Seat;
  isCurrentUserSeat?: boolean;
}

export const SeatSquare: React.FC<SeatSquareProps> = ({ seat, isCurrentUserSeat }) => {
  const isOccupied = !!seat.user_id;
  const username = seat.profiles?.username || 'Užimta';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-20 h-20 rounded-lg flex items-center justify-center p-2 text-center transition-all duration-300 shadow-md ${
          isOccupied
            ? isCurrentUserSeat
              ? 'bg-amber-500 text-white font-bold ring-4 ring-amber-300 animate-pulse'
              : 'bg-slate-700 text-white font-medium border-2 border-slate-600'
            : 'bg-emerald-500 border-2 border-emerald-400 hover:bg-emerald-400 cursor-pointer shadow-emerald-500/20'
        }`}
        title={isOccupied ? `Užėmė: ${username}` : `Stalas ${seat.table_number}, Vieta ${seat.seat_number} (Laisva)`}
      >
        {isOccupied ? (
          <span className="text-sm font-semibold truncate max-w-full leading-tight">
            {username}
          </span>
        ) : (
          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
            Laisva
          </span>
        )}
      </div>
      <span className="text-xs text-slate-400 mt-1">
        Vieta {seat.seat_number}
      </span>
    </div>
  );
};
