'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { logoutAction } from '@/lib/actions/auth';

interface NavbarProps {
  user: { id: string; username: string; role: string } | null;
}

const adminLinks = [
  { href: '/admin/events', label: 'Renginių valdymas' },
  { href: '/admin/check-in', label: 'Atvykimo registracija' },
  { href: '/admin', label: 'Ankstesnė salė ir žaidėjai' },
  { href: '/admin/history', label: 'Ankstesnių rezervacijų istorija' },
];

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);
  const linkClass = 'rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-amber-200 aria-[current=page]:bg-slate-800 aria-[current=page]:text-amber-200';

  return <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0b1019]/95 backdrop-blur">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
      <Link href="/" className="group flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200 text-xl font-black text-slate-950">AP</span>
        <span><span className="block text-lg font-extrabold tracking-tight text-white group-hover:text-amber-200">Auksinis Protas</span><span className="block text-xs text-slate-400">Žaidimų vakarai ir komandos</span></span>
      </Link>
      <nav aria-label="Pagrindinė navigacija" className="relative flex w-full flex-wrap items-center gap-1 sm:w-auto">
        <Link href="/" className={linkClass} aria-current={pathname === '/' ? 'page' : undefined}>Renginiai</Link>
        <Link href="/results" className={linkClass} aria-current={pathname === '/results' ? 'page' : undefined}>Rezultatai</Link>
        {user && <Link href="/reservations" className={linkClass} aria-current={pathname === '/reservations' ? 'page' : undefined}>Mano bilietai</Link>}
        {user?.role === 'admin' && <details ref={menu} className="sm:relative">
          <summary className={`flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm ${pathname.startsWith('/admin') ? 'bg-amber-200/10 text-amber-200' : 'text-slate-300 hover:bg-slate-800'}`}>Valdymas<ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="absolute inset-x-0 top-full mt-2 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl sm:left-auto sm:right-0 sm:w-64">
            {adminLinks.map(({ href, label }) => <Link key={href} href={href} className={`block ${linkClass}`} aria-current={pathname === href || (href === '/admin/events' && pathname.startsWith('/admin/events/')) ? 'page' : undefined}>{label}</Link>)}
          </div>
        </details>}
        {user ? <div className="ml-1 flex items-center gap-2 border-l border-slate-800 pl-3">
          <span title={`${user.username}${user.role === 'admin' ? ' · administratorius' : ''}`} className="max-w-28 truncate text-xs text-slate-400">{user.username}{user.role === 'admin' && ' · Admin'}</span>
          <form action={logoutAction}><button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Atsijungti</button></form>
        </div> : <div className="ml-1 flex flex-wrap gap-2">
          <Link href="/auth/login" className="rounded-lg bg-amber-200 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-100">Prisijungti</Link>
          <Link href="/auth/register" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">Registruotis</Link>
        </div>}
      </nav>
    </div>
  </header>;
}
