-- Server-validated QR check-in for build sessions and outreach events.
--
-- Previously build_action('qr') returned a random token that was never stored,
-- so check_in accepted any string. Tokens now live in checkin_tokens and are
-- validated on check-in. Outreach events get the same flow: leads / attendance
-- managers display a QR, members scan it on arrival.
--
-- A QR encodes a deep link (…/build/check-in?session=…&code=…  or
-- …/outreach/check-in?event=…&code=…) so the phone's native camera works too.

CREATE TABLE IF NOT EXISTS checkin_tokens (
  token      text PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('build', 'outreach')),
  ref_id     uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkin_tokens_ref_idx ON checkin_tokens (kind, ref_id);

-- Only touched through SECURITY DEFINER RPCs; no direct client access.
ALTER TABLE checkin_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.checkin_token_valid(p_kind text, p_ref uuid, p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM checkin_tokens
    WHERE token = p_token AND kind = p_kind AND ref_id = p_ref AND expires_at > now()
  );
$$;
REVOKE ALL ON FUNCTION public.checkin_token_valid(text, uuid, text) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.build_action(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  sid uuid;
  rid uuid;
  r record;
  tok text;
  exp timestamptz;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'location' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      UPDATE build_locations SET name = payload->>'name' WHERE id = (payload->>'id')::uuid
      RETURNING to_jsonb(build_locations.*) INTO result;
    ELSE
      INSERT INTO build_locations (name) VALUES (payload->>'name')
      RETURNING to_jsonb(build_locations.*) INTO result;
    END IF;

  WHEN 'session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO build_sessions (title, location_id, opens_at, closes_at, season_id, created_by)
    VALUES (
      payload->>'title',
      (payload->>'location_id')::uuid,
      COALESCE((payload->>'opens_at')::timestamptz, now()),
      (payload->>'closes_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1)),
      uid
    ) RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'edit_session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'id')::uuid;
    UPDATE build_sessions SET
      title = COALESCE(payload->>'title', title),
      location_id = COALESCE((payload->>'location_id')::uuid, location_id),
      opens_at = COALESCE((payload->>'opens_at')::timestamptz, opens_at),
      closes_at = COALESCE((payload->>'closes_at')::timestamptz, closes_at)
    WHERE id = sid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE build_sessions SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'qr' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'session_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM build_sessions WHERE id = sid AND NOT cancelled) THEN
      RAISE EXCEPTION 'session not found';
    END IF;
    DELETE FROM checkin_tokens WHERE expires_at < now() - interval '1 day';
    tok := encode(extensions.gen_random_bytes(8), 'hex');
    exp := now() + interval '45 seconds';
    INSERT INTO checkin_tokens (token, kind, ref_id, expires_at, created_by)
    VALUES (tok, 'build', sid, exp, uid);
    result := jsonb_build_object('token', tok, 'expires_at', exp, 'session_id', sid);

  WHEN 'check_in' THEN
    sid := (payload->>'session_id')::uuid;
    SELECT * INTO r FROM build_sessions WHERE id = sid;
    IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'session cancelled'; END IF;
    IF now() < r.opens_at OR (r.closes_at IS NOT NULL AND now() > r.closes_at) THEN
      RAISE EXCEPTION 'session not in window';
    END IF;
    IF (payload->>'token') IS NOT NULL AND NOT checkin_token_valid('build', sid, payload->>'token') THEN
      RAISE EXCEPTION 'QR code is invalid or expired — scan the current code';
    END IF;
    SELECT * INTO r FROM build_records WHERE session_id = sid AND member_id = uid AND check_out IS NULL;
    IF FOUND THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    IF EXISTS (SELECT 1 FROM build_records WHERE member_id = uid AND check_out IS NULL) THEN
      RAISE EXCEPTION 'already checked in to another session';
    END IF;
    INSERT INTO build_records (session_id, member_id, check_in, checkout_method)
    VALUES (sid, uid, now(), 'qr')
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'check_out' THEN
    rid := (payload->>'id')::uuid;
    SELECT * INTO r FROM build_records WHERE id = rid AND member_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'record not found'; END IF;
    IF r.check_out IS NOT NULL THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    UPDATE build_records SET
      check_out = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - check_in))::integer / 60
    WHERE id = rid
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'correct' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      rid := (payload->>'id')::uuid;
      UPDATE build_records SET
        check_in = COALESCE((payload->>'check_in')::timestamptz, check_in),
        check_out = COALESCE((payload->>'check_out')::timestamptz, check_out),
        credited_minutes = EXTRACT(EPOCH FROM (
          COALESCE((payload->>'check_out')::timestamptz, check_out) -
          COALESCE((payload->>'check_in')::timestamptz, check_in)
        ))::integer / 60,
        checkout_method = 'administrative'
      WHERE id = rid
      RETURNING to_jsonb(build_records.*) INTO result;
    ELSE
      INSERT INTO build_records (session_id, member_id, check_in, check_out, checkout_method, credited_minutes)
      VALUES (
        (payload->>'session_id')::uuid,
        (payload->>'member_id')::uuid,
        (payload->>'check_in')::timestamptz,
        (payload->>'check_out')::timestamptz,
        'administrative',
        EXTRACT(EPOCH FROM ((payload->>'check_out')::timestamptz - (payload->>'check_in')::timestamptz))::integer / 60
      ) RETURNING to_jsonb(build_records.*) INTO result;
    END IF;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.outreach_action(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  eid uuid;
  r record;
  tok text;
  exp timestamptz;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'create' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_events (title, description, location, latitude, longitude, starts_at, ends_at, season_id)
    VALUES (
      payload->>'title',
      payload->>'description',
      payload->>'location',
      (payload->>'latitude')::double precision,
      (payload->>'longitude')::double precision,
      (payload->>'starts_at')::timestamptz,
      (payload->>'ends_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'edit' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'id')::uuid;
    UPDATE outreach_events SET
      title = COALESCE(payload->>'title', title),
      description = COALESCE(payload->>'description', description),
      location = COALESCE(payload->>'location', location),
      latitude = COALESCE((payload->>'latitude')::double precision, latitude),
      longitude = COALESCE((payload->>'longitude')::double precision, longitude),
      starts_at = COALESCE((payload->>'starts_at')::timestamptz, starts_at),
      ends_at = COALESCE((payload->>'ends_at')::timestamptz, ends_at)
    WHERE id = eid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'restore' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = false WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'leads' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'event_id')::uuid;
    DELETE FROM outreach_leads WHERE event_id = eid;
    INSERT INTO outreach_leads (event_id, member_id)
    SELECT eid, (j.value)::uuid FROM jsonb_array_elements_text(payload->'member_ids') j;
    SELECT to_jsonb(e.*) INTO result FROM outreach_events e WHERE e.id = eid;

  WHEN 'rsvp' THEN
    eid := (payload->>'event_id')::uuid;
    IF (payload->>'planned')::boolean THEN
      INSERT INTO outreach_rsvps (event_id, member_id, planned) VALUES (eid, uid, true)
      ON CONFLICT (event_id, member_id) DO UPDATE SET planned = true;
    ELSE
      DELETE FROM outreach_rsvps WHERE event_id = eid AND member_id = uid;
    END IF;
    result := jsonb_build_object('event_id', eid, 'member_id', uid, 'planned', (payload->>'planned')::boolean);

  WHEN 'attendance' THEN
    IF NOT has_perm('manage_outreach_attendance') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival, departure, credited_minutes)
    VALUES (
      (payload->>'event_id')::uuid,
      (payload->>'member_id')::uuid,
      (payload->>'arrival')::timestamptz,
      (payload->>'departure')::timestamptz,
      EXTRACT(EPOCH FROM ((payload->>'departure')::timestamptz - (payload->>'arrival')::timestamptz))::integer / 60
    )
    ON CONFLICT (event_id, member_id) DO UPDATE SET
      arrival = EXCLUDED.arrival,
      departure = EXCLUDED.departure,
      credited_minutes = EXCLUDED.credited_minutes
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  -- Check-in QR for an event. Event leads can display it, as can anyone who
  -- manages outreach events or attendance. `fixed` = one code valid until the
  -- event ends (for printing); otherwise a 60s rotating code.
  WHEN 'qr' THEN
    eid := (payload->>'event_id')::uuid;
    IF NOT (
      has_perm('manage_outreach_attendance')
      OR has_perm('manage_outreach_events')
      OR EXISTS (SELECT 1 FROM outreach_leads WHERE event_id = eid AND member_id = uid)
    ) THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT * INTO r FROM outreach_events WHERE id = eid;
    IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'event cancelled'; END IF;
    IF r.ends_at IS NOT NULL AND now() > r.ends_at THEN RAISE EXCEPTION 'event has ended'; END IF;
    DELETE FROM checkin_tokens WHERE expires_at < now() - interval '1 day';
    tok := encode(extensions.gen_random_bytes(8), 'hex');
    IF COALESCE((payload->>'fixed')::boolean, false) THEN
      exp := COALESCE(r.ends_at, GREATEST(r.starts_at, now()) + interval '12 hours');
    ELSE
      exp := now() + interval '60 seconds';
    END IF;
    INSERT INTO checkin_tokens (token, kind, ref_id, expires_at, created_by)
    VALUES (tok, 'outreach', eid, exp, uid);
    result := jsonb_build_object('token', tok, 'expires_at', exp, 'event_id', eid);

  WHEN 'self_checkin' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_events WHERE id = eid;
    IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'event cancelled'; END IF;
    IF r.ends_at IS NOT NULL AND now() > r.ends_at THEN RAISE EXCEPTION 'event has ended'; END IF;
    IF (payload->>'token') IS NOT NULL AND NOT checkin_token_valid('outreach', eid, payload->>'token') THEN
      RAISE EXCEPTION 'QR code is invalid or expired — scan the current code';
    END IF;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid;
    IF FOUND THEN
      IF r.departure IS NULL THEN
        result := to_jsonb(r);
        RETURN result;
      END IF;
      RAISE EXCEPTION 'already attended this event';
    END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival, method)
    VALUES (eid, uid, now(), CASE WHEN (payload->>'token') IS NOT NULL THEN 'qr' ELSE 'gps' END)
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  WHEN 'self_checkout' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid AND departure IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'no active check-in for this event'; END IF;
    UPDATE outreach_attendance SET
      departure = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - arrival))::integer / 60
    WHERE event_id = eid AND member_id = uid AND departure IS NULL
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$function$;
