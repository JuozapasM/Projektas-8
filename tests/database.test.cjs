const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const player = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const admin = '00000000-0000-0000-0000-000000000003';

test('SQL migration protects direct RPC calls, profile roles, history and reservations', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql AS $$ SELECT current_user::text $$;
      CREATE PUBLICATION supabase_realtime;`);
    // uuid-ossp is unavailable in WASM; gen_random_uuid has the same role here.
    const schema = fs.readFileSync('supabase/schema.sql', 'utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '').replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
    await db.exec(schema);
    const migration = fs.readFileSync('supabase/migrations/20260913_reservation_security.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);
    await db.exec(`GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      GRANT SELECT, INSERT ON public.profiles TO anon, authenticated;
      GRANT SELECT ON public.seats, public.seat_history TO anon, authenticated;
      INSERT INTO auth.users VALUES ('${player}', 'player@test.invalid', '{"username":"Juozapas"}'), ('${other}', 'other@test.invalid', '{"username":"Other"}'), ('${admin}', 'admin@test.invalid', '{"username":"Organizer"}');
      UPDATE public.profiles SET role = 'admin' WHERE id = '${admin}';`);
    assert.equal((await db.query(`SELECT role FROM public.profiles WHERE id = '${player}'`)).rows[0].role, 'player');
    await db.exec('SET ROLE anon;');
    await assert.rejects(db.query(`SELECT public.assign_random_seat('${player}')`), /permission denied/);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${player}', false);`);
    await assert.rejects(db.query(`SELECT public.assign_random_seat('${other}')`), /kito žaidėjo/);
    await assert.rejects(db.query(`SELECT public.cancel_seat_reservation('${other}')`), /kito žaidėjo/);
    await assert.rejects(db.query(`SELECT public.admin_remove_seat('${other}')`), /administratoriaus/);
    await db.exec(`RESET ROLE; INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000004', 'missing@test.invalid', '{}'); DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004'; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);`);
    await assert.rejects(db.query(`INSERT INTO public.profiles (id, username, role) VALUES (auth.uid(), 'Attacker', 'admin')`), /row-level security/);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${player}', false);`);
    const reserve = await db.query(`SELECT public.assign_random_seat('${player}') AS result`);
    assert.equal(reserve.rows[0].result.success, true);
    assert.equal((await db.query(`SELECT public.assign_random_seat('${player}') AS result`)).rows[0].result.success, false);
    assert.equal((await db.query('SELECT * FROM public.seat_history')).rows.length, 0);
    assert.equal((await db.query(`SELECT public.cancel_seat_reservation('${player}') AS result`)).rows[0].result.success, true);
    await db.query(`SELECT public.assign_random_seat('${player}')`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${admin}', false);`);
    assert.equal((await db.query(`SELECT public.admin_remove_seat('${player}') AS result`)).rows[0].result.success, true);
    assert.equal((await db.query('SELECT * FROM public.seat_history')).rows.length, 4);
    assert.equal((await db.query('SELECT * FROM public.seats WHERE user_id IS NOT NULL')).rows.length, 0);
    // Filling the hall returns a graceful failure for the next player.
    await db.exec('RESET ROLE;');
    for (let i = 10; i < 35; i++) {
      const id = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
      await db.exec(`INSERT INTO auth.users VALUES ('${id}', 'p${i}@test.invalid', '{"username":"Player${i}"}'); SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${id}', false);`);
      const result = (await db.query(`SELECT public.assign_random_seat('${id}') AS result`)).rows[0].result;
      assert.equal(result.success, i < 34);
      await db.exec('RESET ROLE;');
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.seats WHERE user_id IS NOT NULL')).rows[0].n, 24);
  } finally { await db.close(); }
});
