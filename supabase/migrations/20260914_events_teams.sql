-- Additive migration: existing profiles, admin roles and legacy reservations are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS public.game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  location TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 200),
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'completed', 'cancelled')),
  results_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  capacity INT NOT NULL CHECK (capacity BETWEEN 2 AND 4),
  invite_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, owner_id)
);
CREATE TABLE IF NOT EXISTS public.event_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  table_number INT NOT NULL CHECK (table_number BETWEEN 1 AND 6),
  seat_number INT NOT NULL CHECK (seat_number BETWEEN 1 AND 4),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.event_teams(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, table_number, seat_number),
  UNIQUE(event_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_id UUID UNIQUE REFERENCES public.event_seats(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.event_teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'waiting', 'cancelled')),
  checkin_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id),
  CHECK ((status = 'reserved' AND seat_id IS NOT NULL) OR (status <> 'reserved' AND seat_id IS NULL))
);
CREATE INDEX IF NOT EXISTS event_waitlist_order ON public.event_registrations(event_id, created_at, id) WHERE status = 'waiting';
CREATE TABLE IF NOT EXISTS public.event_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  table_number INT NOT NULL CHECK (table_number BETWEEN 1 AND 6),
  team_name TEXT NOT NULL CHECK (length(team_name) BETWEEN 2 AND 60),
  points INT NOT NULL CHECK (points BETWEEN 0 AND 1000000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, table_number)
);

ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events are visible" ON public.game_events;
CREATE POLICY "Events are visible" ON public.game_events FOR SELECT USING (
  status <> 'draft' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Event seats are visible" ON public.event_seats;
CREATE POLICY "Event seats are visible" ON public.event_seats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_events WHERE id = event_id)
);
DROP POLICY IF EXISTS "Private registration tickets" ON public.event_registrations;
CREATE POLICY "Private registration tickets" ON public.event_registrations FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Team invitations are private" ON public.event_teams;
CREATE POLICY "Team invitations are private" ON public.event_teams FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.event_registrations WHERE team_id = event_teams.id AND user_id = auth.uid() AND status = 'reserved')
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Published results are visible" ON public.event_results;
CREATE POLICY "Published results are visible" ON public.event_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_events WHERE id = event_id AND results_published AND status = 'completed')
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
GRANT SELECT ON public.game_events, public.event_seats, public.event_results TO anon, authenticated;
GRANT SELECT ON public.event_teams, public.event_registrations TO authenticated;

-- Internal helper: all mutations serialize on an event row, keeping queue order and team allocation atomic.
CREATE OR REPLACE FUNCTION public.promote_event_waitlist(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_wait RECORD; v_seat UUID; v_event RECORD;
BEGIN
  SELECT * INTO v_event FROM public.game_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.status <> 'open' OR v_event.starts_at <= now() THEN RETURN; END IF;
  FOR v_wait IN SELECT * FROM public.event_registrations WHERE event_id = p_event_id AND status = 'waiting' ORDER BY created_at, id FOR UPDATE LOOP
    SELECT id INTO v_seat FROM public.event_seats WHERE event_id = p_event_id AND user_id IS NULL AND team_id IS NULL ORDER BY random() LIMIT 1;
    IF v_seat IS NULL THEN EXIT; END IF;
    UPDATE public.event_seats SET user_id = v_wait.user_id, updated_at = now() WHERE id = v_seat;
    UPDATE public.event_registrations SET status = 'reserved', seat_id = v_seat, checkin_token = gen_random_uuid(), checked_in_at = NULL WHERE id = v_wait.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_event_waitlist(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_event_seat(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event RECORD; v_existing RECORD; v_seat UUID; v_position INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Prisijunkite prie paskyros'; END IF;
  SELECT * INTO v_event FROM public.game_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' OR v_event.starts_at <= now() THEN RAISE EXCEPTION 'Registracija į renginį uždaryta'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Nerastas žaidėjo profilis'; END IF;
  PERFORM public.promote_event_waitlist(p_event_id);
  SELECT * INTO v_existing FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid();
  IF v_existing.status = 'reserved' THEN RETURN jsonb_build_object('success', false, 'message', 'Jau turite vietą šiame renginyje'); END IF;
  IF v_existing.status = 'waiting' THEN RETURN jsonb_build_object('success', false, 'message', 'Jau esate laukiančiųjų eilėje'); END IF;
  SELECT id INTO v_seat FROM public.event_seats WHERE event_id = p_event_id AND user_id IS NULL AND team_id IS NULL ORDER BY random() LIMIT 1;
  INSERT INTO public.event_registrations(event_id, user_id, status, seat_id)
  VALUES (p_event_id, auth.uid(), CASE WHEN v_seat IS NULL THEN 'waiting' ELSE 'reserved' END, v_seat)
  ON CONFLICT(event_id, user_id) DO UPDATE SET status = EXCLUDED.status, seat_id = EXCLUDED.seat_id, team_id = NULL, checked_in_at = NULL, checkin_token = gen_random_uuid(), created_at = now();
  IF v_seat IS NOT NULL THEN
    UPDATE public.event_seats SET user_id = auth.uid(), updated_at = now() WHERE id = v_seat;
    RETURN jsonb_build_object('success', true, 'message', 'Vieta rezervuota. Jūsų bilietas jau paruoštas.');
  END IF;
  SELECT count(*) INTO v_position FROM public.event_registrations WHERE event_id = p_event_id AND status = 'waiting';
  RETURN jsonb_build_object('success', true, 'message', 'Prisijungėte prie laukiančiųjų eilės. Atlaisvinta vieta bus priskirta automatiškai.', 'position', v_position);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_waitlist_position(p_event_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_registration RECORD; v_position INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Prisijunkite prie paskyros'; END IF;
  SELECT * INTO v_registration FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid() AND status = 'waiting';
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_position FROM public.event_registrations WHERE event_id = p_event_id AND status = 'waiting' AND (created_at, id) <= (v_registration.created_at, v_registration.id);
  RETURN v_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_event_reservation(p_event_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := coalesce(p_user_id, auth.uid()); v_registration RECORD; v_team public.event_teams%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR (v_user <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')) THEN RAISE EXCEPTION 'Neturite teisės atšaukti šios rezervacijos'; END IF;
  PERFORM 1 FROM public.game_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Renginys nerastas'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_events WHERE id = p_event_id AND status = 'completed') THEN RAISE EXCEPTION 'Pasibaigusio renginio rezervacijos nekeičiamos'; END IF;
  SELECT * INTO v_registration FROM public.event_registrations WHERE event_id = p_event_id AND user_id = v_user;
  IF NOT FOUND OR v_registration.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'message', 'Aktyvios registracijos nėra'); END IF;
  IF v_registration.team_id IS NOT NULL THEN
    SELECT * INTO v_team FROM public.event_teams WHERE id = v_registration.team_id;
  END IF;
  IF v_team.owner_id = v_user THEN
    UPDATE public.event_registrations SET status = 'cancelled', seat_id = NULL, team_id = NULL, checkin_token = gen_random_uuid() WHERE team_id = v_team.id;
    UPDATE public.event_seats SET user_id = NULL, team_id = NULL, updated_at = now() WHERE team_id = v_team.id;
    DELETE FROM public.event_teams WHERE id = v_team.id;
  ELSE
    UPDATE public.event_seats SET user_id = NULL, updated_at = now() WHERE id = v_registration.seat_id;
    UPDATE public.event_registrations SET status = 'cancelled', seat_id = NULL, team_id = NULL, checkin_token = gen_random_uuid() WHERE id = v_registration.id;
  END IF;
  PERFORM public.promote_event_waitlist(p_event_id);
  RETURN jsonb_build_object('success', true, 'message', CASE WHEN v_team.owner_id = v_user THEN 'Komandos rezervacija atšaukta' ELSE 'Registracija atšaukta' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_event_team(p_event_id UUID, p_name TEXT, p_capacity INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event RECORD; v_table INT; v_team UUID; v_seat UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Prisijunkite prie paskyros'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 60 OR p_capacity IS NULL OR p_capacity NOT BETWEEN 2 AND 4 THEN RAISE EXCEPTION 'Komandai pasirinkite 2–4 vietas ir įveskite 2–60 simbolių pavadinimą'; END IF;
  SELECT * INTO v_event FROM public.game_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' OR v_event.starts_at <= now() THEN RAISE EXCEPTION 'Registracija į renginį uždaryta'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = auth.uid() AND status <> 'cancelled') THEN RAISE EXCEPTION 'Pirmiausia atšaukite savo ankstesnę registraciją'; END IF;
  PERFORM public.promote_event_waitlist(p_event_id);
  SELECT table_number INTO v_table FROM public.event_seats WHERE event_id = p_event_id AND user_id IS NULL AND team_id IS NULL GROUP BY table_number HAVING count(*) >= p_capacity ORDER BY random() LIMIT 1;
  IF v_table IS NULL THEN RAISE EXCEPTION 'Vienam stalui nepakanka laisvų vietų jūsų komandai'; END IF;
  INSERT INTO public.event_teams(event_id, owner_id, name, capacity) VALUES(p_event_id, auth.uid(), trim(p_name), p_capacity) RETURNING id INTO v_team;
  UPDATE public.event_seats SET team_id = v_team, updated_at = now() WHERE id IN (SELECT id FROM public.event_seats WHERE event_id = p_event_id AND table_number = v_table AND user_id IS NULL AND team_id IS NULL ORDER BY seat_number LIMIT p_capacity);
  SELECT id INTO v_seat FROM public.event_seats WHERE team_id = v_team ORDER BY seat_number LIMIT 1;
  UPDATE public.event_seats SET user_id = auth.uid() WHERE id = v_seat;
  INSERT INTO public.event_registrations(event_id, user_id, status, seat_id, team_id) VALUES(p_event_id, auth.uid(), 'reserved', v_seat, v_team)
  ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'reserved', seat_id = EXCLUDED.seat_id, team_id = EXCLUDED.team_id, checkin_token = gen_random_uuid(), checked_in_at = NULL, created_at = now();
  RETURN jsonb_build_object('success', true, 'message', 'Komandos vietos rezervuotos prie vieno stalo. Pasidalinkite pakvietimu.');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_invite(p_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_team RECORD; v_event RECORD; v_free INT;
BEGIN
  SELECT * INTO v_team FROM public.event_teams WHERE invite_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_event FROM public.game_events WHERE id = v_team.event_id AND status = 'open' AND starts_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_free FROM public.event_seats WHERE team_id = v_team.id AND user_id IS NULL;
  RETURN jsonb_build_object('event_id', v_event.id, 'event_title', v_event.title, 'starts_at', v_event.starts_at, 'team_name', v_team.name, 'free_slots', v_free);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_event_team(p_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_team RECORD; v_event RECORD; v_seat UUID; v_existing RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Prisijunkite prie paskyros'; END IF;
  SELECT * INTO v_team FROM public.event_teams WHERE invite_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pakvietimas nebegalioja'; END IF;
  SELECT * INTO v_event FROM public.game_events WHERE id = v_team.event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' OR v_event.starts_at <= now() THEN RAISE EXCEPTION 'Registracija į renginį uždaryta'; END IF;
  -- Recheck the invitation after acquiring the event lock (the captain may have cancelled).
  SELECT * INTO v_team FROM public.event_teams WHERE invite_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pakvietimas nebegalioja'; END IF;
  SELECT * INTO v_existing FROM public.event_registrations WHERE event_id = v_team.event_id AND user_id = auth.uid();
  IF v_existing.status = 'reserved' THEN RAISE EXCEPTION 'Jau turite vietą. Pirmiausia atšaukite ankstesnę rezervaciją'; END IF;
  SELECT id INTO v_seat FROM public.event_seats WHERE team_id = v_team.id AND user_id IS NULL ORDER BY seat_number LIMIT 1;
  IF v_seat IS NULL THEN RAISE EXCEPTION 'Komandos vietos jau užimtos'; END IF;
  UPDATE public.event_seats SET user_id = auth.uid(), updated_at = now() WHERE id = v_seat;
  INSERT INTO public.event_registrations(event_id, user_id, status, seat_id, team_id) VALUES(v_team.event_id, auth.uid(), 'reserved', v_seat, v_team.id)
  ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'reserved', seat_id = EXCLUDED.seat_id, team_id = EXCLUDED.team_id, checkin_token = gen_random_uuid(), checked_in_at = NULL, created_at = now();
  RETURN jsonb_build_object('success', true, 'message', 'Prisijungėte prie komandos. Jūsų vieta rezervuota.', 'event_id', v_team.event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_game_event(p_title TEXT, p_starts_at TIMESTAMPTZ, p_location TEXT, p_description TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Neturite administratoriaus teisių'; END IF;
  IF p_starts_at IS NULL OR p_starts_at <= now() THEN RAISE EXCEPTION 'Pasirinkite būsimą renginio laiką'; END IF;
  INSERT INTO public.game_events(title, starts_at, location, description) VALUES(trim(p_title), p_starts_at, trim(p_location), coalesce(trim(p_description), '')) RETURNING id INTO v_event;
  INSERT INTO public.event_seats(event_id, table_number, seat_number) SELECT v_event, t, s FROM generate_series(1,6) t CROSS JOIN generate_series(1,4) s;
  RETURN jsonb_build_object('success', true, 'message', 'Renginys sukurtas su 24 vietomis.', 'event_id', v_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_game_event(p_event_id UUID, p_title TEXT, p_starts_at TIMESTAMPTZ, p_location TEXT, p_description TEXT, p_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Neturite administratoriaus teisių'; END IF;
  SELECT * INTO v_event FROM public.game_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Renginys nerastas'; END IF;
  IF v_event.status IN ('completed','cancelled') AND p_status IS DISTINCT FROM v_event.status THEN RAISE EXCEPTION 'Pasibaigusio arba atšaukto renginio atidaryti negalima'; END IF;
  IF p_status NOT IN ('draft','open','completed','cancelled') OR p_status IS NULL THEN RAISE EXCEPTION 'Neteisinga renginio būsena'; END IF;
  IF p_status = 'open' AND p_starts_at <= now() THEN RAISE EXCEPTION 'Atviro renginio data turi būti ateityje'; END IF;
  UPDATE public.game_events SET title = trim(p_title), starts_at = p_starts_at, location = trim(p_location), description = coalesce(trim(p_description), ''), status = p_status WHERE id = p_event_id;
  IF p_status = 'cancelled' THEN
    UPDATE public.event_registrations SET status = 'cancelled', seat_id = NULL, team_id = NULL, checkin_token = gen_random_uuid() WHERE event_id = p_event_id;
    UPDATE public.event_seats SET user_id = NULL, team_id = NULL, updated_at = now() WHERE event_id = p_event_id;
    DELETE FROM public.event_teams WHERE event_id = p_event_id;
  ELSIF p_status = 'open' THEN PERFORM public.promote_event_waitlist(p_event_id);
  END IF;
  RETURN jsonb_build_object('success', true, 'message', 'Renginys atnaujintas.');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_in_event(p_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_registration RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Neturite administratoriaus teisių'; END IF;
  SELECT * INTO v_registration FROM public.event_registrations WHERE checkin_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bilietas nerastas arba nebegalioja'; END IF;
  PERFORM 1 FROM public.game_events WHERE id = v_registration.event_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Renginio atvykimo registracija uždaryta'; END IF;
  SELECT * INTO v_registration FROM public.event_registrations WHERE checkin_token = p_token FOR UPDATE;
  IF NOT FOUND OR v_registration.status <> 'reserved' THEN RAISE EXCEPTION 'Bilietas neturi aktyvios rezervacijos'; END IF;
  IF v_registration.checked_in_at IS NULL THEN UPDATE public.event_registrations SET checked_in_at = now() WHERE id = v_registration.id; END IF;
  RETURN jsonb_build_object('success', true, 'message', CASE WHEN v_registration.checked_in_at IS NULL THEN 'Žaidėjo atvykimas pažymėtas.' ELSE 'Žaidėjo atvykimas jau buvo pažymėtas.' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_event_result(p_event_id UUID, p_table_number INT, p_team_name TEXT, p_points INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Neturite administratoriaus teisių'; END IF;
  PERFORM 1 FROM public.game_events WHERE id = p_event_id AND status = 'completed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rezultatai įvedami pasibaigus renginiui'; END IF;
  INSERT INTO public.event_results(event_id, table_number, team_name, points) VALUES(p_event_id, p_table_number, trim(p_team_name), p_points)
  ON CONFLICT(event_id, table_number) DO UPDATE SET team_name = EXCLUDED.team_name, points = EXCLUDED.points, updated_at = now();
  RETURN jsonb_build_object('success', true, 'message', 'Rezultatas išsaugotas.');
END;
$$;
CREATE OR REPLACE FUNCTION public.publish_event_results(p_event_id UUID, p_published BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Neturite administratoriaus teisių'; END IF;
  PERFORM 1 FROM public.game_events WHERE id = p_event_id AND status = 'completed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Skelbiami tik pasibaigusio renginio rezultatai'; END IF;
  IF p_published AND NOT EXISTS(SELECT 1 FROM public.event_results WHERE event_id = p_event_id) THEN RAISE EXCEPTION 'Pirmiausia įveskite bent vieną rezultatą'; END IF;
  UPDATE public.game_events SET results_published = p_published WHERE id = p_event_id;
  RETURN jsonb_build_object('success', true, 'message', CASE WHEN p_published THEN 'Rezultatai paskelbti.' ELSE 'Rezultatai paslėpti.' END);
END;
$$;

-- Restrict every new privileged RPC explicitly.
DO $$
DECLARE v_function TEXT;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'reserve_event_seat(uuid)', 'get_event_waitlist_position(uuid)', 'cancel_event_reservation(uuid,uuid)', 'create_event_team(uuid,text,integer)',
    'join_event_team(uuid)', 'create_game_event(text,timestamp with time zone,text,text)',
    'update_game_event(uuid,text,timestamp with time zone,text,text,text)', 'check_in_event(uuid)',
    'save_event_result(uuid,integer,text,integer)', 'publish_event_results(uuid,boolean)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || v_function || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || v_function || ' TO authenticated';
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.get_team_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invite(UUID) TO anon, authenticated;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_seats') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_seats; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_registrations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_registrations; END IF;
  END IF;
END;
$$;
COMMIT;
