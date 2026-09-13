'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="panel mx-5 max-w-lg py-10 text-center sm:mx-auto">
    <p className="mb-3 text-xs text-amber-200">Bandykime dar kartą</p>
    <h1 className="text-2xl font-semibold">Nepavyko įkelti puslapio</h1>
    <p className="my-5 text-sm leading-relaxed text-slate-400">Paslauga gali būti laikinai nepasiekiama. Jau patvirtintos rezervacijos lieka išsaugotos.</p>
    <div className="flex flex-wrap justify-center gap-3"><button onClick={reset} className="primary-button">Bandyti dar kartą</button><Link href="/" className="secondary-button">Grįžti į renginius</Link></div>
  </section>;
}
