const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadAuth(client, configured = true) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/actions/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, Buffer, FormData, require: name => {
    if (name.endsWith('/server')) return { createClient: async () => client };
    if (name.endsWith('/env')) return { getSupabaseEnv: () => ({ isConfigured: configured }) };
    if (name === 'next/navigation') return { redirect: path => { throw new Error(`redirect:${path}`); } };
    if (name === 'node:crypto') return require('node:crypto');
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
function form(username, password = 'password123') { const f = new FormData(); f.set('username', username); f.set('password', password); return f; }
function signupClient() {
  const emails = [];
  return {
    emails,
    from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signUp: async args => { emails.push(args); return { data: { user: { id: 'player' }, session: {} }, error: null }; } },
    rpc: async () => ({ data: { success: true }, error: null }),
  };
}

test('Unicode names remain distinct and admin names carry no role metadata', async () => {
  const client = signupClient(); const actions = loadAuth(client);
  for (const name of ['Jonas', 'Jon-as', 'Jónas', 'Juozapas']) await assert.rejects(actions.registerAction(form(name)), /redirect:\/$/);
  assert.equal(new Set(client.emails.map(e => e.email)).size, 4);
  assert.equal(client.emails.at(-1).options.data.role, undefined);
  await assert.rejects(actions.registerAction(form('Ž'.repeat(32))), /redirect:\/$/);
  assert.ok(client.emails.every(e => e.email.split('@')[0].length <= 64));
});
test('invalid input and missing configuration return useful errors', async () => {
  const actions = loadAuth(null, false);
  assert.match((await actions.registerAction(form('Žaidėjas'))).error, /nepasiekiama/);
  assert.match((await actions.loginAction(form('Žaidėjas'))).error, /nepasiekiamas/);
  assert.match((await actions.registerAction(form('a b'))).error, /2–32/);
  const f = form('Jonas'); f.set('username', new Blob(['bad']), 'name.txt');
  assert.ok((await actions.loginAction(f)).error);
});
test('failed seat assignment keeps the successful account and redirects with a notice', async () => {
  const client = signupClient(); client.rpc = async () => ({ data: { success: false }, error: null });
  await assert.rejects(loadAuth(client).registerAction(form('Jonas')), /redirect:\/\?notice=seat-unavailable/);
});
test('email confirmation is not treated as a completed login', async () => {
  const client = signupClient(); client.auth.signUp = async () => ({ data: { user: { id: 'player' }, session: null }, error: null });
  assert.match((await loadAuth(client).registerAction(form('Jonas'))).error, /patvirtinimas/);
});
test('legacy character stripping cannot log in to a differently named profile', async () => {
  let signsOut = 0;
  const client = { auth: { signInWithPassword: async () => ({ data: { user: { id: 'player' } }, error: null }), signOut: async () => { signsOut++; } }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { username: 'Jonas' } }) }) }) }) };
  assert.ok((await loadAuth(client).loginAction(form('Jon-as'))).error);
  assert.equal(signsOut, 3);
});
