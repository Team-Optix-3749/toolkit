-- ============================================================================
-- Cross-account communication system check.
-- Impersonates real accounts (MEMBER A, MEMBER B, OWNER O) via JWT claims,
-- exercises every cross-account flow, then RAISES at the end so the whole
-- transaction rolls back. Nothing is persisted. The report is the error text.
-- ============================================================================
do $$
declare
  a uuid; b uuid; o uuid;
  res jsonb := '[]'::jsonb;
  oid uuid; tid uuid; pid uuid; eid uuid; mid uuid; sid uuid;
  n int; ok boolean; perms text[];
begin
  select id into a from profiles where role = 'MEMBER' and account_status = 'active' order by created_at limit 1;
  select id into b from profiles where role = 'MEMBER' and account_status = 'active' and id <> a order by created_at limit 1;
  select id into o from profiles where role = 'OWNER' and account_status = 'active' order by created_at limit 1;
  if a is null or b is null or o is null then raise exception 'need 2 members + 1 owner'; end if;

  -- 1. Privilege escalation: member grants self permissions
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update profiles set permissions = array['manage_accounts','manage_opis'], account_status = 'active' where id = a;
  execute 'reset role';
  select permissions into perms from profiles where id = a;
  res := res || jsonb_build_object('check', 'member cannot self-grant permissions', 'pass', not ('manage_accounts' = any(coalesce(perms,'{}'))));

  -- 2. Member cannot write a notification into another inbox
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into notifications (user_id, type, title) values (b, 'general', 'spoof');
    ok := false;
  exception when others then ok := true;
  end;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'member cannot spoof notifications to others', 'pass', ok);

  -- 3. OPI: member submits → reviewers notified; owner requests changes → member notified
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  oid := (opi_action(jsonb_build_object('action','submit','title','__syscheck opi','summary','x'))->>'id')::uuid;
  execute 'reset role';
  select count(*) into n from notifications where user_id = o and link like '%' || oid || '%';
  res := res || jsonb_build_object('check', 'OPI submit → owner notified', 'pass', n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform opi_action(jsonb_build_object('action','changes','id',oid,'feedback','more detail'));
  execute 'reset role';
  select count(*) into n from notifications where user_id = a and link = '/opi/' || oid;
  res := res || jsonb_build_object('check', 'OPI changes requested → submitter notified', 'pass', n = 1);

  -- 4. Tasks: owner assigns A (reviewer B); A submits → B notified; B requests changes → A notified
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into tasks (created_by, title, status, requires_review) values (o, '__syscheck task', 'assigned', true) returning id into tid;
  insert into task_assignees (task_id, user_id) values (tid, a);
  insert into task_reviewers (task_id, user_id) values (tid, b);
  execute 'reset role';
  select count(*) into n from notifications where user_id = a and link = '/tasks/' || tid;
  res := res || jsonb_build_object('check', 'task assigned → assignee notified', 'pass', n = 1);
  select count(*) into n from notifications where user_id = b and link = '/tasks/' || tid;
  res := res || jsonb_build_object('check', 'task reviewer added → reviewer notified', 'pass', n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update tasks set status = 'submitted' where id = tid;
  get diagnostics n = row_count;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'assignee can update own task status', 'pass', n = 1);
  select count(*) into n from notifications where user_id = b and link = '/tasks/' || tid and title like '%review%' and title like 'Task ready%';
  res := res || jsonb_build_object('check', 'task submitted → reviewer notified', 'pass', n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update tasks set status = 'changes_requested' where id = tid;
  execute 'reset role';
  select count(*) into n from notifications where user_id = a and link = '/tasks/' || tid and title like 'Changes%';
  res := res || jsonb_build_object('check', 'reviewer requests changes → assignee notified', 'pass', n = 1);

  -- 5. Task evidence: B (reviewer of tid) can insert; member on no task cannot insert into it
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into task_evidence (task_id, user_id, kind, content) values (tid, b, 'note', 'looks good');
    ok := true;
  exception when others then ok := false;
  end;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'reviewer can add evidence/notes', 'pass', ok);

  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into tasks (created_by, title, status) values (o, '__syscheck other task', 'assigned') returning id into pid;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into task_evidence (task_id, user_id, kind, content) values (pid, a, 'note', 'intrude');
    ok := false;
  exception when others then ok := true;
  end;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'non-assignee cannot add evidence to other tasks', 'pass', ok);

  -- 6. Purchases: member requests → leadership notified; owner approves → member notified
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into purchases (user_id, kind, description, amount, status) values (a, 'reimbursement', '__syscheck purchase', 12.5, 'PENDING') returning id into pid;
  execute 'reset role';
  select count(*) into n from notifications where user_id = o and link like '%' || pid || '%';
  res := res || jsonb_build_object('check', 'purchase request → leadership notified', 'pass', n = 1);
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update purchases set status = 'APPROVED', reviewer_id = o where id = pid;
  execute 'reset role';
  select count(*) into n from notifications where user_id = a and link = '/purchases/' || pid;
  res := res || jsonb_build_object('check', 'purchase approved → requester notified', 'pass', n = 1);

  -- 7. Scouting: owner creates event + match + assigns A → A notified;
  --    A logs data; B can read it but not edit it.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into scout_events (name, created_by) values ('__syscheck event', o) returning id into eid;
  insert into scout_matches (event_id, match_number, red, blue) values (eid, 1, '{3749,254,1678}', '{971,604,5940}') returning id into mid;
  insert into scout_assignments (match_id, station, scout_id) values (mid, 'red1', a);
  execute 'reset role';
  select count(*) into n from notifications where user_id = a and type = 'scouting';
  res := res || jsonb_build_object('check', 'scout assignment → scout notified', 'pass', n >= 1);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into scout_events (name) values ('__member event');
    ok := false;
  exception when others then ok := true;
  end;
  insert into match_scouting (event_id, match_number, team_number, alliance, scout_id, data)
    values (eid, 1, 3749, 'red', a, '{"tele_scored": 7}') returning id into sid;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'member cannot create scouting events', 'pass', ok);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from match_scouting where id = sid;
  res := res || jsonb_build_object('check', 'other members can read scouting data', 'pass', n = 1);
  update match_scouting set data = '{"tele_scored": 0}' where id = sid;
  get diagnostics n = row_count;
  execute 'reset role';
  res := res || jsonb_build_object('check', 'members cannot edit others'' scouting entries', 'pass', n = 0);

  -- 8. Notifications respect "in-app off" preference
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  insert into notification_preferences (user_id, prefs) values (b, '{"task": {"in_app": false, "email": false}}')
    on conflict (user_id) do update set prefs = excluded.prefs;
  execute 'set local role authenticated';
  insert into task_assignees (task_id, user_id) values (tid, b);
  execute 'reset role';
  select count(*) into n from notifications where user_id = b and link = '/tasks/' || tid and title like 'Task assigned%';
  res := res || jsonb_build_object('check', 'muted notification type is not delivered', 'pass', n = 0);

  raise exception 'SYSCHECK_RESULT %', res::text;
end $$;
