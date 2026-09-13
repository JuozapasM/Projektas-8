'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction, resetPasswordAction, resendConfirmationAction } from '@/lib/actions/auth';

export function PasswordForm({ reset = false, confirm = false }: { reset?: boolean; confirm?: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const action = reset ? resetPasswordAction : confirm ? resendConfirmationAction : requestPasswordResetAction;
  const title = reset ? 'Naujas slaptažodis' : confirm ? 'El. pašto patvirtinimas' : 'Slaptažodžio atkūrimas';
  return <section className="panel mx-5 max-w-md sm:mx-auto">
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="mb-6 mt-3 text-sm text-slate-400">{reset ? 'Įveskite naują slaptažodį du kartus.' : confirm ? 'Negavote patvirtinimo laiško arba nuoroda nebegalioja? Įveskite registracijos el. paštą.' : 'Įveskite paskyros tikrą el. paštą. Atsiųsime atkūrimo nuorodą.'}</p>
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget); setResult(null);
      start(async () => { try { setResult(await action(data)); } catch { setResult({ error: 'Veiksmas nepavyko. Bandykite dar kartą.' }); } });
    }}>
      <fieldset className="space-y-4" disabled={pending}>
        {reset ? [{ name: 'password', label: 'Naujas slaptažodis' }, { name: 'password_confirmation', label: 'Pakartokite slaptažodį' }].map(f => <label key={f.name} className="field-label">{f.label}<input className="field mt-2" name={f.name} type="password" autoComplete="new-password" minLength={6} required /></label>) : <label className="field-label">El. paštas<input className="field mt-2" name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
        <button className="primary-button w-full" disabled={pending}>{pending ? 'Palaukite…' : reset ? 'Pakeisti slaptažodį' : confirm ? 'Gauti patvirtinimo nuorodą' : 'Gauti atkūrimo nuorodą'}</button>
      </fieldset>
      {result && <p role={result.error ? 'alert' : 'status'} className={`text-sm ${result.error ? 'text-red-300' : 'text-emerald-200'}`}>{result.error || result.message}</p>}
    </form>
    {!reset && <p className="mt-5 text-xs text-slate-400">Ankstesnėms paskyroms be tikro el. pašto laiškai nepristatomi. Kreipkitės į organizatorių.</p>}
    <Link href="/auth/login" className="mt-5 block text-sm text-amber-200">← Prisijungimas</Link>
  </section>;
}
