import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    return supabaseResponse;
  }

  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  };

  try {
    const supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return redirectWithCookies(url);
      }

      // Check if admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return redirectWithCookies(url);
      }
    }
  } catch (err) {
    console.error('Middleware session update error:', err);
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return redirectWithCookies(new URL('/auth/login', request.url));
    }
  }

  return supabaseResponse;
}
