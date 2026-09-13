'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loginAction } from '@/lib/actions/auth';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.message) setMessage(res.message);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white">Prisijungimas</h1>
          <p className="text-xs text-slate-400 mt-1">
            Naujoms paskyroms naudokite el. paštą, ankstesnėms — vartotojo vardą
          </p>
        </div>

        {searchParams.get('notice') === 'password-updated' && <p role="status" className="mb-4 text-sm text-emerald-200">Slaptažodis pakeistas. Prisijunkite su nauju slaptažodžiu.</p>}
        {searchParams.get('error') === 'link-expired' && <p role="alert" className="mb-4 text-sm text-red-300">Patvirtinimo nuoroda nebegalioja. Paprašykite naujos nuorodos.</p>}
        {message && <p role="status" className="mb-4 text-sm text-emerald-200">{message}</p>}
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="next" value={searchParams.get("next") || "/"} />
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-300 mb-1">
              El. paštas arba ankstesnis vardas
            </label>
            <input
              type="text"
              name="username"
              id="username"
              autoComplete="username"
              maxLength={254}
              required
              placeholder="El. paštas arba vardas"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1">
              Slaptažodis
            </label>
            <input
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-amber-200 hover:bg-amber-100 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm mt-2"
          >
            {isPending ? 'Prisijungiama...' : 'Prisijungti'}
          </button>
        </form>

        <Link href="/auth/forgot-password" className="mt-5 block text-xs text-amber-200">Pamiršote slaptažodį?</Link>
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          Dar neturite paskyros?{' '}
          <Link href={`/auth/register?next=${encodeURIComponent(searchParams.get("next") || "/")}`} className="text-amber-400 hover:underline font-semibold">
            Registruotis čia
          </Link>
        </div>
      </div>
    </div>
  );
}
