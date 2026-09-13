const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(path, dependencies = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, URL, Intl, Date, FormData, require: name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
const events = loadModule('src/lib/events.ts');
const eventId = '00000000-0000-4000-8000-000000000001';

function actions(client) {
  return loadModule('src/lib/actions/events.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/env': { getSupabaseEnv: () => ({ isConfigured: true }) },
    '@/lib/events': events,
  });
}
function client() {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: eventId } } }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: { success: true, message: 'OK' }, error: null }; },
  };
}
function resultForm() {
  const data = new FormData();
  data.set('table_number', '1'); data.set('team_name', 'Smalsūs protai'); data.set('points', '0');
  return data;
}

test('team capacity counts free places at a single table and excludes private team holds', () => {
  const scattered = [1, 2, 3, 4].map(table_number => ({ table_number, user_id: null }));
  assert.equal(events.maxTeamCapacity(scattered), 1);
  assert.equal(events.maxTeamCapacity([...scattered, { table_number: 1, user_id: null }]), 2);
  assert.equal(events.maxTeamCapacity([{ table_number: 1, user_id: null, team_id: eventId }]), 0);
  assert.equal(events.maxTeamCapacity([]), 0);
});

test('ticket lookup accepts QR links and bare tokens while rejecting unrelated URLs', () => {
  assert.equal(events.readTicketToken(` ${eventId} `), eventId);
  assert.equal(events.readTicketToken(`https://example.test/admin/check-in?token=${eventId}`), eventId);
  for (const value of [null, 'broken', `https://example.test/?token=${eventId}`, `ftp://example.test/admin/check-in?token=${eventId}`, 'https://example.test/admin/check-in?token=broken']) {
    assert.equal(events.readTicketToken(value), null);
  }
});

test('result actions reject missing, empty and malformed points instead of silently recording zero', async () => {
  const db = client(); const action = actions(db);
  for (const value of [null, '', ' ', '1.5', '-1', '1e3', 'Infinity', '1000001']) {
    const data = resultForm();
    if (value === null) data.delete('points'); else data.set('points', value);
    assert.equal((await action.saveResultAction(eventId, data)).success, false);
  }
  assert.equal(db.calls.length, 0);
  assert.equal((await action.saveResultAction(eventId, resultForm())).success, true);
  assert.equal(db.calls[0].args.p_points, 0);
});

test('uploaded files cannot masquerade as a team name or event description', async () => {
  const db = client(); const action = actions(db);
  const team = new FormData(); team.set('capacity', '4'); team.set('team_name', new Blob(['bad']), 'team.txt');
  assert.equal((await action.createTeamAction(eventId, team)).success, false);
  const event = new FormData(); event.set('title', 'Žaidimo vakaras'); event.set('location', 'Vilnius'); event.set('starts_at', '2099-01-01T18:00:00Z');
  event.set('description', new Blob(['bad']), 'description.txt');
  assert.equal((await action.createEventAction(event)).success, false);
  assert.equal(db.calls.length, 0);
});

test('unauthenticated mutations never reach the privileged reservation RPC', async () => {
  const db = client(); db.auth.getUser = async () => ({ data: { user: null } });
  const result = await actions(db).reserveEventAction(eventId);
  assert.equal(result.success, false); assert.equal(db.calls.length, 0);
});

test('internal database errors remain private while deliberate business errors are recoverable', async () => {
  const db = client(); db.rpc = async () => ({ error: { code: 'XX000', message: 'internal secret details' } });
  const action = actions(db);
  assert.doesNotMatch((await action.reserveEventAction(eventId)).message, /secret/);
  db.rpc = async () => ({ error: { code: 'P0001', message: 'Registracija uždaryta' } });
  assert.equal((await action.reserveEventAction(eventId)).message, 'Registracija uždaryta');
});

test('authentication destinations cannot escape the application origin', () => {
  for (const path of ['//evil.test', '/\\evil.test', '/\nevil.test', 'https://evil.test', ' /events']) assert.equal(events.safeNextPath(path), '/');
  assert.equal(events.safeNextPath('/admin/check-in?token=abc'), '/admin/check-in?token=abc');
});
