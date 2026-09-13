import Link from 'next/link';

export default function NotFoundPage() {
  return <section className="panel mx-5 max-w-lg py-12 text-center sm:mx-auto">
    <p className="mb-3 text-sm font-semibold text-amber-200">404</p>
    <h1 className="text-2xl font-semibold">Šio puslapio neradome</h1>
    <p className="my-5 text-sm text-slate-400">Patikrinkite nuorodą arba pasirinkite kitą žaidimo vakarą.</p>
    <Link href="/" className="primary-button">Rasti renginį</Link>
  </section>;
}
