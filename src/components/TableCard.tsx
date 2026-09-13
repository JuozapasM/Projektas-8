import React from 'react';
import { Seat } from '@/types/database';
import { SeatSquare } from './SeatSquare';

interface TableCardProps {
  tableNumber: number;
  seats: Seat[];
  currentUserId?: string | null;
}

export const TableCard: React.FC<TableCardProps> = ({
  tableNumber,
  seats,
  currentUserId,
}) => {
  // Sort seats 1 to 4
  const sortedSeats = [...seats].sort((a, b) => a.seat_number - b.seat_number);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
      <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
        Stalas {tableNumber}
      </h3>

      <div className="grid grid-cols-2 gap-6 w-full max-w-[240px]">
        {sortedSeats.map((seat) => (
          <SeatSquare
            key={seat.id}
            seat={seat}
            isCurrentUserSeat={seat.user_id === currentUserId}
          />
        ))}
      </div>
    </div>
  );
};
