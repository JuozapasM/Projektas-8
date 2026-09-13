'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Ticket, ShieldCheck } from 'lucide-react';
import { reserveSeatAction, cancelSeatAction } from '@/lib/actions/seats';
import { Seat } from '@/types/database';

export function UserControls({ user, userSeat, isAvailable = true }: { user: { id: string; username: string } | null; userSeat: Seat | null; isAvailable?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  function runAction(cancel: boolean) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await (cancel ? cancelSeatAction() : reserveSeatAction());
        setMessage({ text: result?.message || (result?.success ? 'Vieta sėkmingai rezervuota!' : 'Nepavyko atlikti veiksmo.'), error: !result?.success });
        setConfirmCancel(false);
      } catch { setMessage({ text: 'Nepavyko atlikti veiksmo. Bandykite dar kartą.', error: true }); }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-[#141c29] p-6 sm:p-7 shadow-xl shadow-black/10">
      <div className="flex justify-between items-center mb-5"><span className="flex items-center gap-2 text-xs text-amber-200"><Ticket size={18} strokeWidth={1.5} aria-hidden="true" />Jūsų rezervacija</span><span className="text-[10px] text-slate-400">AUKSINIS PROTAS</span></div>
      <h2 className="text-xl font-semibold text-white">{user ? `Sveiki, ${user.username}!` : 'Geras vakaras prasideda čia.'}</h2>
      <p className="mt-3 mb-5 text-sm leading-relaxed text-slate-400">{!isAvailable ? 'Šiuo metu rezervacijos nepasiekiamos. Galite peržiūrėti salės planą.' : !user ? 'Prisijunkite arba sukurkite paskyrą, tada rezervuokite vietą šioje salėje.' : userSeat ? `Jūsų vieta: stalas ${userSeat.table_number}, vieta ${userSeat.seat_number}. Iki susitikimo prie stalo!` : 'Dar neturite vietos? Sistema atsitiktinai parinks vieną iš laisvų vietų.'}</p>
      {!user ? <div className="flex gap-3"><Link href="/auth/register?next=/hall" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-200 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-100">Registruotis <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/auth/login?next=/hall" className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800">Prisijungti</Link></div> : confirmCancel ? <div className="rounded-xl border border-red-300/20 p-4"><p className="text-sm text-slate-300 mb-3">Atšaukti rezervaciją? Vieta taps prieinama kitam žaidėjui.</p><div className="flex gap-3"><button disabled={pending} onClick={() => runAction(true)} className="text-sm text-red-300 disabled:opacity-50">{pending ? 'Atšaukiama…' : 'Taip, atšaukti'}</button><button disabled={pending} onClick={() => setConfirmCancel(false)} className="text-sm text-slate-300">Palikti vietą</button></div></div> : <button disabled={pending || !isAvailable} onClick={() => userSeat ? setConfirmCancel(true) : runAction(false)} className={`w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${userSeat ? 'border border-slate-600 text-slate-300 hover:bg-slate-800' : 'bg-amber-200 text-slate-950 hover:bg-amber-100'}`}>{pending ? 'Rezervuojama…' : userSeat ? 'Atšaukti rezervaciją' : 'Gauti vietą prie stalo'}</button>}
      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-4 text-sm ${message.error ? 'text-red-300' : 'text-emerald-200'}`}>{message.text}</p>}
      <p className="mt-5 pt-4 border-t border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-400"><ShieldCheck size={14} aria-hidden="true" />Viena paskyra · viena vieta · lengvas atšaukimas</p>
    </section>
  );
}
