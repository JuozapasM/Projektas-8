const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('event reservations, FIFO waiting list, teams, tickets, result publication and RLS work together',async () => {
  const db = new PGlite();
  const as = async n => { await db.exec(`RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${uuid(n)}',false);`); };
  const admin = () => as(100);
  const rpc = async (name,args) => (await db.query(`SELECT public.${name}(${args}) AS result`)).rows[0].result;
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql AS $$ SELECT current_user::text $$;CREATE PUBLICATION supabase_realtime;`);
    await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";','').replaceAll('uuid_generate_v4()','gen_random_uuid()'));
    const migration = fs.readFileSync('supabase/migrations/20260914_events_teams.sql','utf8');await db.exec(migration);await db.exec(migration);
    await db.exec(`GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;GRANT SELECT ON public.profiles TO anon,authenticated;
      GRANT ALL ON public.game_events,public.event_seats,public.event_teams,public.event_registrations,public.event_results TO anon,authenticated;`);
    for(let n=0;n<26;n++) await db.exec(`INSERT INTO auth.users VALUES('${uuid(n)}','p${n}@test.invalid','{"username":"Player${n}"}');`);
    await db.exec(`INSERT INTO auth.users VALUES('${uuid(100)}','admin@test.invalid','{"username":"Juozapas"}');UPDATE public.profiles SET role='admin' WHERE id='${uuid(100)}';`);
    await as(0);await assert.rejects(rpc('create_game_event',"'Game',now()+interval '7 days','Hall',''"),/administratoriaus/);
    await admin();const event1=(await rpc('create_game_event',"'Game One',now()+interval '7 days','Hall','Description'")).event_id;
    const event2=(await rpc('create_game_event',"'Game Two',now()+interval '8 days','Hall',''")).event_id;
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.event_seats WHERE event_id='${event1}'`)).rows[0].n,24);
    await db.exec(`RESET ROLE;SET ROLE anon;SELECT set_config('request.jwt.claim.sub','',false);`);await assert.rejects(rpc('reserve_event_seat',`'${event1}'`),/permission denied/);
    await assert.rejects(rpc('promote_event_waitlist',`'${event1}'`),/permission denied/);
    await as(0);await assert.rejects(db.query(`INSERT INTO public.game_events(title,location,starts_at) VALUES('Fake','Hall',now())`),/row-level security/);
    assert.equal((await rpc('reserve_event_seat',`'${event1}'`)).success,true);
    assert.equal((await rpc('reserve_event_seat',`'${event2}'`)).success,true);
    assert.equal((await rpc('reserve_event_seat',`'${event1}'`)).success,false);
    for(let n=1;n<26;n++){await as(n);assert.equal((await rpc('reserve_event_seat',`'${event1}'`)).success,true);}
    // Control registration timestamps: PGlite can assign the same millisecond to both arrivals.
    await db.exec(`RESET ROLE;UPDATE public.event_registrations SET created_at=CASE WHEN user_id='${uuid(24)}' THEN '2026-01-01'::timestamptz ELSE '2026-01-02'::timestamptz END WHERE event_id='${event1}' AND status='waiting';`);
    await as(25);assert.equal(await rpc('get_event_waitlist_position',`'${event1}'`),2);assert.equal((await db.query(`SELECT status FROM public.event_registrations WHERE event_id='${event1}' AND user_id='${uuid(25)}'`)).rows[0].status,'waiting');
    await as(1);await assert.rejects(rpc('cancel_event_reservation',`'${event1}','${uuid(0)}'`),/teisės/);
    await as(0);assert.equal((await rpc('cancel_event_reservation',`'${event1}'`)).success,true);
    assert.equal((await rpc('cancel_event_reservation',`'${event1}'`)).success,false);
    await admin();const queue=await db.query(`SELECT user_id,status FROM public.event_registrations WHERE event_id='${event1}' AND user_id IN('${uuid(24)}','${uuid(25)}') ORDER BY user_id`);
    assert.deepEqual(queue.rows.map(r=>r.status),['reserved','waiting']);
    await as(24);assert.equal((await db.query(`SELECT * FROM public.event_registrations WHERE event_id='${event1}'`)).rows.length,1);
    await as(1);assert.equal((await rpc('create_event_team',`'${event2}','Friends',4`)).success,true);
    const team=(await db.query(`SELECT * FROM public.event_teams WHERE event_id='${event2}'`)).rows[0];
    await as(2);assert.equal((await db.query(`SELECT * FROM public.event_teams WHERE event_id='${event2}'`)).rows.length,0);
    for(const n of [2,3,4]){await as(n);assert.equal((await rpc('join_event_team',`'${team.invite_token}'`)).success,true);}
    await as(5);await assert.rejects(rpc('join_event_team',`'${team.invite_token}'`),/jau užimtos/);
    await admin();const teamSeats=await db.query(`SELECT * FROM public.event_seats WHERE team_id='${team.id}'`);assert.equal(teamSeats.rows.length,4);assert.equal(new Set(teamSeats.rows.map(r=>r.table_number)).size,1);
    await as(2);await rpc('cancel_event_reservation',`'${event2}'`);await admin();assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.event_seats WHERE team_id='${team.id}' AND user_id IS NULL`)).rows[0].n,1);
    await as(5);await rpc('join_event_team',`'${team.invite_token}'`);
    await as(1);await rpc('cancel_event_reservation',`'${event2}'`);assert.equal(await rpc('get_team_invite',`'${team.invite_token}'`),null);
    await admin();assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.event_seats WHERE team_id='${team.id}'`)).rows[0].n,0);
    const ticket=(await db.query(`SELECT * FROM public.event_registrations WHERE event_id='${event2}' AND user_id='${uuid(0)}'`)).rows[0];
    await as(0);await assert.rejects(rpc('check_in_event',`'${ticket.checkin_token}'`),/administratoriaus/);
    await admin();assert.equal((await rpc('check_in_event',`'${ticket.checkin_token}'`)).success,true);
    const before=(await db.query(`SELECT checked_in_at FROM public.event_registrations WHERE id='${ticket.id}'`)).rows[0].checked_in_at;
    assert.match((await rpc('check_in_event',`'${ticket.checkin_token}'`)).message,/jau buvo/);
    assert.deepEqual((await db.query(`SELECT checked_in_at FROM public.event_registrations WHERE id='${ticket.id}'`)).rows[0].checked_in_at,before);
    await rpc('cancel_event_reservation',`'${event2}','${uuid(0)}'`);await assert.rejects(rpc('check_in_event',`'${ticket.checkin_token}'`),/nebegalioja/);
    await assert.rejects(rpc('save_event_result',`'${event2}',1,'Friends',10`),/pasibaigus/);
    await rpc('update_game_event',`'${event2}','Game Two',now()+interval '8 days','Hall','','completed'`);
    await rpc('save_event_result',`'${event2}',1,'Friends',10`);await rpc('save_event_result',`'${event2}',1,'Friends',12`);
    await as(2);await assert.rejects(rpc('publish_event_results',`'${event2}',true`),/administratoriaus/);
    await db.exec(`RESET ROLE;SET ROLE anon;SELECT set_config('request.jwt.claim.sub','',false);`);assert.equal((await db.query(`SELECT * FROM public.event_results WHERE event_id='${event2}'`)).rows.length,0);
    await admin();await rpc('publish_event_results',`'${event2}',true`);
    await db.exec(`RESET ROLE;SET ROLE anon;SELECT set_config('request.jwt.claim.sub','',false);`);assert.equal((await db.query(`SELECT points FROM public.event_results WHERE event_id='${event2}'`)).rows[0].points,12);
    await admin();await assert.rejects(rpc('update_game_event',`'${event2}','Game Two',now()+interval '8 days','Hall','','open'`),/atidaryti negalima/);
    const draft=(await rpc('create_game_event',"'Private',now()+interval '9 days','Hall',''")).event_id;
    await rpc('update_game_event',`'${draft}','Private',now()+interval '9 days','Hall','','draft'`);
    await db.exec(`RESET ROLE;SET ROLE anon;SELECT set_config('request.jwt.claim.sub','',false);`);assert.equal((await db.query(`SELECT * FROM public.game_events WHERE id='${draft}'`)).rows.length,0);assert.equal((await db.query(`SELECT * FROM public.event_seats WHERE event_id='${draft}'`)).rows.length,0);
    await admin();await rpc('update_game_event',`'${event1}','Game One',now()+interval '7 days','Hall','','cancelled'`);
    assert.equal((await db.query(`SELECT * FROM public.event_registrations WHERE event_id='${event1}' AND status <> 'cancelled'`)).rows.length,0);
    assert.equal((await db.query(`SELECT * FROM public.event_seats WHERE event_id='${event1}' AND (user_id IS NOT NULL OR team_id IS NOT NULL)`)).rows.length,0);
    await db.exec('RESET ROLE;');await db.exec(migration);assert.equal((await db.query(`SELECT role FROM public.profiles WHERE id='${uuid(100)}'`)).rows[0].role,'admin');
  } finally {await db.close();}
});
