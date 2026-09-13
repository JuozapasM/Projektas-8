'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Seat } from '@/types/database';
import { TableCard } from './TableCard';
import { createClient } from '@/lib/supabase/client';

interface HallMapProps {
  initialSeats: Seat[];
  currentUserId?: string | null;
}

export const HallMap: React.FC<HallMapProps> = ({ initialSeats, currentUserId }) => {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const supabase = useMemo(() => createClient(), []);

  const fetchSeats = async () => {
    const { data } = await supabase
      .from('seats')
      .select('*, profiles(username)')
      .order('table_number', { ascending: true })
      .order('seat_number', { ascending: true });

    if (data) {
      setSeats(data as Seat[]);
    }
  };

  useEffect(() => {
    setSeats(initialSeats);

    // Subscribe to realtime changes on seats table
    const channel = supabase
      .channel('realtime_seats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seats' },
        () => {
          fetchSeats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialSeats, supabase]);

  // Group seats by table_number (1..6)
  const tables = [1, 2, 3, 4, 5, 6].map((tableNum) => ({
    tableNumber: tableNum,
    seats: seats.filter((s) => s.table_number === tableNum),
  }));

  const totalSeats = seats.length;
  const occupiedSeats = seats.filter((s) => s.user_id !== null).length;
  const freeSeats = totalSeats - occupiedSeats;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Legend and stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-slate-900/80 p-4 rounded-xl border border-slate-800 backdrop-blur">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded border border-emerald-400"></div>
            <span className="text-sm text-slate-300">Laisva vieta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-700 rounded border border-slate-600"></div>
            <span className="text-sm text-slate-300">Užimta vieta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded border border-amber-300"></div>
            <span className="text-sm text-slate-300">Jūsų vieta</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          <span className="text-emerald-400">Laisvų: {freeSeats}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Užimtų: {occupiedSeats} / {totalSeats}</span>
        </div>
      </div>

      {/* 6 Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tables.map((table) => (
          <TableCard
            key={table.tableNumber}
            tableNumber={table.tableNumber}
            seats={table.seats}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
};
