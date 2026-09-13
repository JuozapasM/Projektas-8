import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { isUuid, formatEventDate } from '@/lib/events';
import { joinTeamAction } from '@/lib/actions/events';
import { MutationButton } from '@/components/ActionForm';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; if (!isUuid(token)) notFound();
  if (!getSupabaseEnv().isConfigured) return <p className="panel max-w-lg mx-auto">Pakvietimas šiuo metu nepasiekiamas.</p>;
  const supabase = await createClient(); const { data: invite, error } = await supabase.rpc('get_team_invite',{p_token:token});
  if (error) return <section role="status" className="panel max-w-lg mx-5 sm:mx-auto"><h1 className="text-2xl font-semibold">Pakvietimo duomenys nepasiekiami</h1><p className="my-4 text-sm text-slate-400">Bandykite dar kartą vėliau. Tai nereiškia, kad pakvietimas atšauktas.</p><Link href="/" className="text-sm text-amber-200">Grįžti į renginius →</Link></section>;
  if (!invite) return <section className="panel max-w-lg mx-5 sm:mx-auto"><h1 className="text-2xl font-semibold">Pakvietimas nebegalioja</h1><p className="text-sm text-slate-400 my-4">Komanda buvo atšaukta arba renginio registracija baigėsi.</p><Link href="/" className="text-amber-200 text-sm">Rasti kitą renginį →</Link></section>;
  const { data: { user } } = await supabase.auth.getUser();
  return <section className="panel max-w-lg mx-5 sm:mx-auto"><p className="text-xs text-amber-200 mb-3">Komandos pakvietimas</p><h1 className="text-2xl font-bold">{invite.team_name}</h1><p className="mt-4 text-slate-300">{invite.event_title}</p><p className="mt-2 text-sm text-slate-400">{formatEventDate(invite.starts_at)} · {invite.free_slots} laisvos komandos vietos</p><div className="mt-6">{!invite.free_slots ? <p className="text-slate-400 text-sm">Komandos vietos jau užimtos.</p> : user ? <MutationButton action={joinTeamAction.bind(null,token)} href={`/events/${invite.event_id}`}>Prisijungti prie komandos</MutationButton> : <div className="flex flex-wrap gap-3"><Link className="primary-button" href={`/auth/login?next=/invite/${token}`}>Prisijungti</Link><Link className="secondary-button" href={`/auth/register?next=/invite/${token}`}>Sukurti paskyrą</Link></div>}</div><Link className="block mt-6 text-sm text-amber-200" href={`/events/${invite.event_id}`}>Peržiūrėti renginį →</Link></section>;
}
