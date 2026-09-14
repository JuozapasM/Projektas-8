const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');

function loadAuth(client, configured = true) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/actions/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const utilities = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/events.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: utilities, URL, Intl, Date });
  vm.runInNewContext(js, { exports, FormData, require: name => {
    if (name.endsWith('/server')) return { createClient: async () => client };
    if (name.endsWith('/env')) return { getSupabaseEnv: () => ({ isConfigured: configured }) };
    if (name.endsWith('/site')) return { getSiteOrigin: async () => 'https://example.test' };
    if (name.endsWith('/events')) return utilities;
    if (name === 'next/navigation') return { redirect: path => { throw new Error(`redirect:${path}`); } };
    if (name === 'node:crypto') return require('node:crypto');
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
function form(username, password = 'password123') {
  const f = new FormData(); f.set('username',username); f.set('password',password);
  f.set('email',`${createHash('sha256').update(username).digest('hex').slice(0,20)}@test.invalid`); return f;
}
function signupClient() {
  const requests = [];
  return { requests, from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { signUp: async args => { requests.push(args); return { data: { user: { id: 'player' }, session: {} }, error: null }; } },
    rpc: async () => { throw new Error('Signup must not reserve an unrelated legacy seat'); },
  };
}

test('new accounts use the provided real email without granting admin metadata or silently reserving a seat', async () => {
  const client = signupClient(); const actions = loadAuth(client);
  for (const name of ['Jonas','Jon-as','Jónas','Juozapas']) { const f = form(name); await assert.rejects(actions.registerAction(f),/redirect:\/$/); assert.equal(client.requests.at(-1).email,f.get('email')); }
  assert.equal(new Set(client.requests.map(e => e.email)).size,4);
  assert.equal(client.requests.at(-1).options.data.role,undefined);
});
test('invalid input and missing configuration return useful errors', async () => {
  const actions = loadAuth(null,false);
  assert.match((await actions.registerAction(form('Žaidėjas'))).error,/nepasiekiama/);
  assert.match((await actions.loginAction(form('Žaidėjas'))).error,/nepasiekiamas/);
  assert.match((await actions.registerAction(form('a b'))).error,/2–32/);
  const f = form('Jonas'); f.set('username',new Blob(['bad']),'name.txt'); assert.ok((await actions.loginAction(f)).error);
  const missing = form('Jonas'); missing.delete('email'); assert.match((await actions.registerAction(missing)).error,/el. pašto/);
});
test('confirmation-required signup displays a successful pending confirmation message', async () => {
  const client = signupClient(); client.auth.signUp = async () => ({data:{user:{id:'player'},session:null},error:null});
  const result = await loadAuth(client).registerAction(form('Jonas')); assert.equal(result.error,undefined); assert.match(result.message,/patvirtinkite/);
});
test('signup and login preserve the invitation destination and reject external destinations', async () => {
  const client = signupClient(); const f = form('Jonas'); f.set('next','/invite/invitation');
  await assert.rejects(loadAuth(client).registerAction(f),/redirect:\/invite\/invitation/);
  assert.match(client.requests[0].options.emailRedirectTo,/next=%2Finvite%2Finvitation/);
  f.set('next','//evil.test'); await assert.rejects(loadAuth(client).registerAction(f),/redirect:\/$/);
});
test('legacy character stripping cannot log in to a differently named profile', async () => {
  let signsOut = 0;
  const client = { auth:{signInWithPassword:async () => ({data:{user:{id:'player'}},error:null}),signOut:async options => { assert.equal(options.scope,'local'); signsOut++; }},from:() => ({select:() => ({eq:() => ({maybeSingle:async () => ({data:{username:'Jonas'}})})})}) };
  assert.ok((await loadAuth(client).loginAction(form('Jon-as'))).error); assert.equal(signsOut,3);
});
test('Juozapas legacy login continues to authenticate through Supabase and preserves the existing admin profile', async () => {
  const profile = {username:'Juozapas',role:'admin'}; const calls = [];
  const client = {auth:{signInWithPassword:async args => { calls.push(args); return args.email === 'juozapas@auksinisprotas.com' ? {data:{user:{id:'admin'}},error:null} : {data:{user:null},error:{}}; }},from:() => ({select:() => ({eq:() => ({maybeSingle:async () => ({data:profile})})})})};
  await assert.rejects(loadAuth(client).loginAction(form('Juozapas')),/redirect:\/$/); assert.equal(profile.role,'admin'); assert.equal(calls.at(-1).password,'password123');
});
test('new email login authenticates directly and requires a profile', async () => {
  let email; const client = {auth:{signInWithPassword:async args => { email=args.email;return {data:{user:{id:'player'}},error:null}; }},from:() => ({select:() => ({eq:() => ({maybeSingle:async () => ({data:{username:'Jonas'}})})})})};
  await assert.rejects(loadAuth(client).loginAction(form('PLAYER@test.invalid')),/redirect:\/$/); assert.equal(email,'player@test.invalid');
});
test('username login still succeeds when the profile row is missing but auth metadata matches', async () => {
  const client = {
    auth: { signInWithPassword: async () => ({ data: { user: { id: 'player', email: 'player@test.invalid', user_metadata: { username: 'Jonas' } } }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: async payload => {
        assert.equal(payload.id, 'player');
        assert.equal(payload.username, 'Jonas');
        return { error: null };
      },
    }),
  };
  await assert.rejects(loadAuth(client).loginAction(form('Jonas')), /redirect:/);
});
test('reset requests do not disclose whether an email belongs to an account', async () => {
  let request; const client = {auth:{resetPasswordForEmail:async (email,options) => {request={email,options};return {error:null};}}};
  const f=form('Jonas'); const result=await loadAuth(client).requestPasswordResetAction(f);
  assert.match(result.message,/Jei šiuo el. paštu/);assert.match(request.options.redirectTo,/auth\/callback\?next=\/auth\/reset-password/);
});
test('password updates reject mismatches and unauthenticated requests', async () => {
  const f=form('Jonas');f.set('password_confirmation','different');const actions=loadAuth({auth:{getUser:async () => ({data:{user:null}})}});
  assert.match((await actions.resetPasswordAction(f)).error,/nesutampa/);f.set('password_confirmation','password123');assert.match((await actions.resetPasswordAction(f)).error,/nebegalioja/);
});

test('expired signup confirmations can be requested again without disclosing account existence', async () => {
  let request;
  const client = { auth: { resend: async args => { request = args; return { error: null }; } } };
  const f = form('Jonas');
  const result = await loadAuth(client).resendConfirmationAction(f);
  assert.equal(request.type, 'signup'); assert.equal(request.email, f.get('email'));
  assert.equal(request.options.emailRedirectTo, 'https://example.test/auth/callback');
  assert.match(result.message, /Jei šiuo el. paštu/);
});
