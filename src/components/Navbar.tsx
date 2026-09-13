'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions/auth';

interface NavbarProps {
  user: {
    id: string;
    username: string;
    role: string;
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-800 bg-[#0b1019]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center text-slate-950 font-black text-xl  group-hover:scale-105 transition-transform">
            AP
          </div>
          <div>
            <p className="font-extrabold text-white text-lg tracking-tight group-hover:text-amber-400 transition-colors">
              Auksinis Protas
            </p>
            <p className="text-xs text-slate-400 font-medium">Stalų rezervacijos platforma</p>
          </div>
        </Link>

        <nav aria-label="Pagrindinė navigacija" className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            Žaidimo salė
          </Link>

          {user?.role === 'admin' && (
            <>
              <Link
                href="/admin"
                className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-amber-500/10 border border-amber-500/30"
              >
                Valdymas
              </Link>
              <Link
                href="/admin/history"
                className="text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
              >
                Istorija
              </Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <span className="text-xs text-slate-400 max-w-32 truncate">
                {user.username} {user.role === 'admin' && '(Admin)'}
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                >
                  Atsijungti
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="text-xs px-3.5 py-2 bg-amber-200 hover:bg-amber-100 text-slate-950 font-bold rounded-lg transition-colors"
              >
                Prisijungti
              </Link>
              <Link
                href="/auth/register"
                className="text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                Registruotis
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
