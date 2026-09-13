'use client';

import React from 'react';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions/auth';

interface NavbarProps {
  user: {
    id: string;
    username: string;
    role: string;
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            AP
          </div>
          <div>
            <h1 className="font-extrabold text-white text-lg tracking-tight group-hover:text-amber-400 transition-colors">
              Auksinis Protas
            </h1>
            <p className="text-xs text-slate-400 font-medium">Stalų rezervacijos platforma</p>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/"
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
                Admin Valdymas
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
              <span className="text-xs text-slate-400 font-mono">
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
                className="text-xs px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors"
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
