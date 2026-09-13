import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const adminRoute = path === '/admin' || path.startsWith('/admin/');
  const resetRoute = path === '/auth/reset-password';
  const protectedRoute = adminRoute || resetRoute || path === '/reservations';

  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  };
  const redirectToLogin = () => {
    const url = request.nextUrl.clone();
    const next = url.pathname + url.search;
    url.pathname = resetRoute ? '/auth/forgot-password' : '/auth/login';
    url.search = '';
    if (!resetRoute) url.searchParams.set('next', next);
    return redirectWithCookies(url);
  };

  const { url, anonKey, isConfigured } = getSupabaseEnv();
  if (!isConfigured) return protectedRoute ? redirectToLogin() : supabaseResponse;

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (protectedRoute && !user) return redirectToLogin();
    if (adminRoute && user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/'; url.search = '';
        return redirectWithCookies(url);
      }
    }
  } catch (err) {
    console.error('Middleware session update error:', err);
    if (protectedRoute) return redirectToLogin();
  }
  return supabaseResponse;
}
