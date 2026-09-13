import { EventResult } from '@/types/database';

export function ResultsTable({ results }: { results: EventResult[] }) {
  const sorted = [...results].sort((a,b) => b.points - a.points || a.table_number - b.table_number);
  return <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-left text-sm"><caption className="sr-only">Renginio rezultatų lentelė</caption><thead className="bg-slate-900 text-slate-400"><tr><th scope="col" className="p-4">Vieta</th><th scope="col" className="p-4">Komanda</th><th scope="col" className="p-4">Stalas</th><th scope="col" className="p-4 text-right">Taškai</th></tr></thead><tbody>{sorted.map((r) => <tr key={r.id} className="border-t border-slate-800"><td className="p-4 text-amber-200">{sorted.findIndex(s => s.points === r.points) + 1}</td><th scope="row" className="p-4 font-medium">{r.team_name}</th><td className="p-4 text-slate-400">{r.table_number}</td><td className="p-4 text-right font-semibold">{r.points}</td></tr>)}{!sorted.length && <tr><td colSpan={4} className="p-5 text-slate-400 text-center">Rezultatai dar neįvesti.</td></tr>}</tbody></table></div>;
}
