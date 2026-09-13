'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { reserveSeatAction, cancelSeatAction } from '@/lib/actions/seats';
import { Seat } from '@/types/database';

interface UserControlsProps {
  user: {
    id: string;
    username: string;
  } | null;
  userSeat: Seat | null;
}

export const UserControls: React.FC<UserControlsProps> = ({ user, userSeat }) => {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleReserve = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await reserveSeatAction();
      if (res?.message) {
        setMessage({ text: res.message, error: !res.success });
      }
    });
  };

  const handleCancel = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await cancelSeatAction();
      if (res?.message) {
        setMessage({ text: res.message, error: !res.success });
      }
    });
  };

  if (!user) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl max-w-xl mx-auto mb-8 text-center backdrop-blur shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-2">Norite dalyvauti "Auksinis Protas" žaidime?</h2>
        <p className="text-slate-400 text-sm mb-6">
          Prisijunkite arba užsiregistruokite ir sistema automatiškai atsitiktiniu būdu priskirs jums laisvą vietą prie vieno iš 6 stalų.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/auth/login"
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20"
          >
            Prisijungti
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all"
          >
            Registruotis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl max-w-xl mx-auto mb-8 backdrop-blur shadow-xl text-center">
      <p className="text-slate-300 text-sm mb-2">
        Sveiki, <span className="font-bold text-amber-400">{user.username}</span>!
      </p>

      {userSeat ? (
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300">
            <p className="font-semibold text-lg">
              Jums priskirta vieta: Stalas {userSeat.table_number}, Vieta {userSeat.seat_number}
            </p>
            <p className="text-xs text-amber-400/80 mt-1">
              Bet kada galite atšaukti rezervaciją, kad jūsų vieta liktų laisva kitam žaidėjui.
            </p>
          </div>

          <button
            onClick={handleCancel}
            disabled={isPending}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {isPending ? 'Atšaukiama...' : 'Atšaukti vietos rezervaciją'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Šiuo metu neturite priskirtos vietos žaidime.
          </p>

          <button
            onClick={handleReserve}
            disabled={isPending}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isPending ? 'Priskiriama vieta...' : 'Gauti atsitiktinę vietą prie stalo'}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-4 text-sm font-medium ${
            message.error ? 'text-red-400' : 'text-emerald-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};
