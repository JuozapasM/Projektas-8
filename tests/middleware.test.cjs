const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

class RequestURL extends URL { clone() { return new RequestURL(this.href); } }
function cookies() {
  const values = new Map();
  return {
    getAll: () => [...values.values()],
    set: (name, value, options) => {
      const cookie = typeof name === 'object' ? name : { name, value, ...options };
      values.set(cookie.name, cookie);
    },
  };
}
function middleware({ user = null, role = 'player', refresh = false, configured = true } = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/supabase/middleware.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { exports, console, require: name => {
    if (name === './env') return { getSupabaseEnv: () => ({ isConfigured: configured }) };
    if (name === 'next/server') return { NextResponse: {
      next: () => ({ kind: 'next', cookies: cookies() }),
      redirect: url => ({ kind: 'redirect', url: url.href, cookies: cookies() }),
    } };
    if (name === '@supabase/ssr') return { createServerClient: (url, key, options) => ({
      auth: { getUser: async () => {
        if (refresh) options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]);
        return { data: { user } };
      } },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }),
    }) };
    throw new Error(`Unexpected import: ${name}`);
  } });
  return path => exports.updateSession({ nextUrl: new RequestURL(`https://example.test${path}`), cookies: cookies() });
}

test('private ticket and password pages redirect before rendering any streamed content', async () => {
  const guard = middleware();
  for (const path of ['/reservations', '/admin/events', '/admin/check-in?token=private']) {
    const result = await guard(path); const url = new URL(result.url);
    assert.equal(result.kind, 'redirect'); assert.equal(url.pathname, '/auth/login');
    assert.equal(url.searchParams.get('next'), path);
  }
  const recovery = new URL((await guard('/auth/reset-password')).url);
  assert.equal(recovery.pathname, '/auth/forgot-password');
});

test('admin access rejects player accounts and strips private query tokens from the public destination', async () => {
  const result = await middleware({ user: { id: 'player' } })('/admin/check-in?token=private');
  assert.equal(result.url, 'https://example.test/');
  assert.equal((await middleware({ user: { id: 'admin' }, role: 'admin' })('/admin/events')).kind, 'next');
});

test('session refresh cookies survive access-control redirects', async () => {
  const result = await middleware({ user: { id: 'player' }, refresh: true })('/admin/events');
  assert.equal(result.cookies.getAll()[0].value, 'refreshed');
  assert.equal(result.cookies.getAll()[0].httpOnly, true);
});

test('unconfigured installations keep public pages readable while protecting private pages', async () => {
  const guard = middleware({ configured: false });
  assert.equal((await guard('/')).kind, 'next');
  assert.equal((await guard('/reservations')).kind, 'redirect');
});
