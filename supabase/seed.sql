-- LOCAL FAKE DATA ONLY. Never apply this file to a hosted project.
-- All identities use password Optix-local-only-3749! and example.test addresses.
-- The unverified identity intentionally cannot sign in until locally verified.
-- Storage objects are uploaded separately through real application workflows.
begin;

create temporary table toolkit_seed_people (
  n integer primary key, email text, name text, role text, account_type text,
  account_status text default 'active', permissions text[] default '{}'
) on commit drop;
insert into toolkit_seed_people (n,email,name,role,account_type,account_status,permissions) values
 (1,'president','Fake President','OWNER','member','active','{}'),
 (2,'officer','Fake Officer','OFFICER','member','active','{manage_tasks,manage_groups}'),
 (3,'leadership','Fake Leadership','LEADERSHIP','member','active','{}'),
 (4,'member-a','Fake Member A','MEMBER','member','active','{}'),
 (5,'member-b','Fake Member B','MEMBER','member','active','{}'),
 (6,'mentor','Fake Mentor','MEMBER','mentor','active','{}'),
 (7,'pending','Fake Pending','PENDING','member','active','{}'),
 (8,'unverified','Fake Unverified','PENDING','member','active','{}'),
 (9,'deactivated','Fake Deactivated','MEMBER','member','deactivated','{}'),
 (10,'reviewer','Fake Selected Reviewer','MEMBER','member','active','{}'),
 (11,'event-lead','Fake Event Lead','MEMBER','member','active','{}'),
 (12,'officer-no-grants','Fake Officer Without Grants','OFFICER','member','active','{}');
insert into toolkit_seed_people (n,email,name,role,account_type,permissions)
select 12 + ordinality, replace(permission,'_','-'), 'Fake ' || permission,
 'MEMBER', 'member', array[permission]
from unnest(array['manage_accounts','manage_invitations','manage_tasks','manage_groups',
 'manage_seasons','manage_outreach_events','manage_outreach_attendance','manage_build_hours',
 'manage_opis','export_records','manage_purchases','manage_scouting']) with ordinality p(permission,ordinality);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,
 email_change_token_new,recovery_token)
select '00000000-0000-0000-0000-000000000000',
 ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'authenticated','authenticated',email||'@example.test',
 extensions.crypt('Optix-local-only-3749!','$2a$06$abcdefghijklmnopqrstuu'),
 case when n=8 then null else '2026-01-01T00:00:00+00:00'::timestamptz end,
 '{"provider":"email","providers":["email"]}'::jsonb,
 jsonb_build_object('name',name,'display_name',name,'account_type',account_type),
 '2026-01-01T00:00:00+00:00','2026-01-01T00:00:00+00:00','','','',''
from toolkit_seed_people;
insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select u.id,u.id,u.id::text,jsonb_build_object('sub',u.id,'email',u.email,
 'email_verified',u.email_confirmed_at is not null),'email',
 '2026-01-01T00:00:00+00:00','2026-01-01T00:00:00+00:00','2026-01-01T00:00:00+00:00'
from auth.users u join toolkit_seed_people p on u.email=p.email||'@example.test';
-- Provisioning is deliberately exercised through auth.users, never profile INSERT.
update public.profiles target set display_name=p.name,role=p.role,
 account_type=p.account_type,account_status=p.account_status,permissions=p.permissions,
 department=case when p.n=4 then 'Software' else null end,
 bio=case when p.n=4 then 'Local fake profile for workflow checks.' else null end
from toolkit_seed_people p where target.id=('10000000-0000-4000-8000-'||lpad(p.n::text,12,'0'))::uuid;

insert into public.seasons (id,name,is_current,outreach_target,build_target,individual_outreach_cap_minutes) values
 ('20000000-0000-4000-8000-000000000001','S1 Local Current',true,20,40,360),
 ('20000000-0000-4000-8000-000000000002','S2 Local Historical',false,20,40,360);
insert into public.groups (id,name) values
 ('60000000-0000-4000-8000-000000000001','Local Software'),
 ('60000000-0000-4000-8000-000000000002','Local Outreach'),
 ('60000000-0000-4000-8000-000000000003','Local Design'),
 ('60000000-0000-4000-8000-000000000004','Local Empty Group');
insert into public.group_members (group_id,user_id) values
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004'),
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005'),
 ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004'),
 ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011'),
 ('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000005');
insert into public.task_groups (id,name,color) values
 ('61000000-0000-4000-8000-000000000001','Local Build Category','#84cc16'),
 ('61000000-0000-4000-8000-000000000002','Local Outreach Category','#22d3ee');
insert into public.tasks (id,title,description,status,deadline,requires_review,created_by,season_id,group_id,owner_group_id)
select ('70000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Local task '||n,'Fake group-owned task for local workflow checks.',status,
 case when n=1 then null when n=2 then (date_trunc('month',now() at time zone 'America/Los_Angeles')::date-1)
 when n=3 then date_trunc('month',now() at time zone 'America/Los_Angeles')::date
 else (now() at time zone 'America/Los_Angeles')::date+n::int end,
 n in (3,4,5),'10000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000001',
 '61000000-0000-4000-8000-000000000001',
 ('60000000-0000-4000-8000-'||lpad((1+(n-1)%3)::text,12,'0'))::uuid
from unnest(array['assigned','in_progress','submitted','changes_requested','resubmitted','completed','cancelled'])
 with ordinality s(status,n);
insert into public.task_reviewers (task_id,user_id)
select id,'10000000-0000-4000-8000-000000000010' from public.tasks
where id::text like '70000000-%' and requires_review;

insert into public.build_locations (id,name,latitude,longitude,radius_m) values
 ('30000000-0000-4000-8000-000000000001','Local School GPS Fixture',33.0144,-117.1222,1609.344),
 ('30000000-0000-4000-8000-000000000002','Local QR-only Workshop',null,null,null);
insert into public.build_sessions (id,title,location_id,season_id,opens_at,closes_at,cancelled)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Local build '||n,('30000000-0000-4000-8000-'||lpad((1+(n-1)%2)::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad((case when n=1 then 2 else 1 end)::text,12,'0'))::uuid,
 now()+offset_start,now()+offset_end,n=4
from (values (1,interval '-10 days',interval '-10 days 2 hours'),
 (2,interval '-1 hour',interval '2 hours'),(3,interval '2 days',interval '2 days 2 hours'),
 (4,interval '-4 days',interval '-4 days 2 hours')) s(n,offset_start,offset_end);
insert into public.build_records (id,session_id,member_id,check_in,check_out,checkout_method,
 automatically_closed,credit_enabled,credited_minutes,credit_interval)
select '41000000-0000-4000-8000-000000000001',id,'10000000-0000-4000-8000-000000000004',
 opens_at,opens_at+interval '90 seconds','automatic',true,true,1.5,
 tstzrange(opens_at,opens_at+interval '90 seconds','[)')
from public.build_sessions where id='40000000-0000-4000-8000-000000000001';
insert into public.build_records (id,session_id,member_id,check_in,reserved_until,
 credit_enabled,credited_minutes,automatically_closed)
select '41000000-0000-4000-8000-000000000002',id,'10000000-0000-4000-8000-000000000005',
 greatest(opens_at,now()-interval '10 minutes'),closes_at,true,0,false
from public.build_sessions where id='40000000-0000-4000-8000-000000000002';
insert into public.build_records (id,session_id,member_id,check_in,check_out,checkout_method,
 automatically_closed,credit_enabled,credited_minutes)
select '41000000-0000-4000-8000-000000000003',id,'10000000-0000-4000-8000-000000000004',
 opens_at,closes_at,'member',false,false,0
from public.build_sessions where id='40000000-0000-4000-8000-000000000004';

insert into public.outreach_events (id,title,description,location,starts_at,ends_at,season_id,cancelled)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Local outreach '||n,
 'Fake outreach event for local checks.','Local Library',now()+offset_start,now()+offset_end,
 ('20000000-0000-4000-8000-'||lpad((case when n=1 then 2 else 1 end)::text,12,'0'))::uuid,n=4
from (values (1,interval '-8 days',interval '-8 days 2 hours'),
 (2,interval '-1 hour',interval '2 hours'),(3,interval '3 days',interval '3 days 2 hours'),
 (4,interval '-5 days',interval '-5 days 2 hours')) s(n,offset_start,offset_end);
insert into public.outreach_leads (event_id,member_id)
select id,'10000000-0000-4000-8000-000000000011' from public.outreach_events where id::text like '50000000-%';
insert into public.outreach_rsvps (event_id,member_id,planned) values
 ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',true);
insert into public.outreach_attendance (id,event_id,member_id,arrival,departure,credit_enabled,credited_minutes,credit_interval)
select '51000000-0000-4000-8000-000000000001',id,'10000000-0000-4000-8000-000000000004',
 starts_at,starts_at+interval '90 seconds',true,1.5,tstzrange(starts_at,starts_at+interval '90 seconds','[)')
from public.outreach_events where id='50000000-0000-4000-8000-000000000001';
insert into public.outreach_attendance (id,event_id,member_id,arrival,credit_enabled,credited_minutes)
select '51000000-0000-4000-8000-000000000002',id,'10000000-0000-4000-8000-000000000006',
 greatest(starts_at,now()-interval '10 minutes'),true,0
from public.outreach_events where id='50000000-0000-4000-8000-000000000002';
insert into public.outreach_attendance (id,event_id,member_id,arrival,departure,credit_enabled,credited_minutes)
select '51000000-0000-4000-8000-000000000003',id,'10000000-0000-4000-8000-000000000004',
 starts_at,ends_at,false,0
from public.outreach_events where id='50000000-0000-4000-8000-000000000004';

insert into public.opis (id,submitter_id,status,title,summary,document_url,event_id,season_id)
select ('80000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000004',status,'Local proposal '||n,
 'Fake proposal summary; no real Google document is linked.',
 'https://docs.google.com/document/d/local-sandbox-fixture-'||n||'/edit',
 case when status='CONVERTED' then '50000000-0000-4000-8000-000000000001'::uuid else null end,
 case when status='CONVERTED' then '20000000-0000-4000-8000-000000000002'::uuid
 else '20000000-0000-4000-8000-000000000001'::uuid end
from unnest(array['SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','CONVERTED'])
 with ordinality s(status,n);
insert into public.opi_versions (id,opi_id,title,summary,document_url)
select ('81000000-0000-4000-8000-'||right(id::text,12))::uuid,id,title,summary,document_url
from public.opis where id::text like '80000000-%';
insert into public.opi_feedback (id,opi_id,user_id,feedback,decision) values
 ('82000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000021','Please clarify the fake proposal schedule.','CHANGES_REQUESTED');

insert into public.individual_outreach (id,user_id,full_name,event_name,what_you_did,impact,
 claimed_minutes,approved_minutes,event_date,people_impacted,status,season_id,reviewer_id,decided_at)
select ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000004','Fake Member A','Local individual request '||n,
 'Helped with a fake community workshop.','Local fixture only.',240,
 case when status='APPROVED' then 240 else null end,
 (now() at time zone 'America/Los_Angeles')::date-n::int,10,status,
 '20000000-0000-4000-8000-000000000001',
 case when status<>'PENDING' then '10000000-0000-4000-8000-000000000019'::uuid else null end,
 case when status<>'PENDING' then now() else null end
from unnest(array['APPROVED','APPROVED','PENDING','REJECTED']) with ordinality s(status,n);
insert into public.purchases (id,user_id,kind,description,amount,status,reviewer_id,decided_at)
select ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000004',case when n=1 then 'purchase' else 'reimbursement' end,
 'Local fake supplies '||n,12.50,status,
 case when status<>'PENDING' then '10000000-0000-4000-8000-000000000023'::uuid else null end,
 case when status<>'PENDING' then now() else null end
from unnest(array['PENDING','APPROVED','REJECTED']) with ordinality s(status,n);
insert into public.notification_preferences (user_id,prefs) values
 ('10000000-0000-4000-8000-000000000004','{"task_assigned":{"in_app":true}}');
insert into public.notifications (id,user_id,type,title,body,link) values
 ('92000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004',
 'general','Local fixture ready','Fake local notification.','/dashboard');

insert into public.scout_events (id,created_by,season_id,name,event_code,starts_on,ends_on,is_active) values
 ('93000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000024',
 '20000000-0000-4000-8000-000000000001','Local Scouting Fixture','LOCAL',current_date,current_date+1,true);
insert into public.scout_matches (id,event_id,match_type,match_number,red,blue) values
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','qm',1,
 array[3749,1111,2222],array[3333,4444,5555]);
insert into public.scout_assignments (id,match_id,station,scout_id) values
 ('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','red1',
 '10000000-0000-4000-8000-000000000004');
insert into public.task_evidence (id,task_id,user_id,kind,content) values
 ('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000004','note','Fake retained contribution.');
insert into public.task_history (id,task_id,user_id,from_status,to_status,feedback) values
 ('72000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000004',
 '10000000-0000-4000-8000-000000000010','submitted','changes_requested','Clarify the fake result.');
insert into public.match_scouting (id,event_id,match_type,match_number,team_number,alliance,scout_id,data,notes) values
 ('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','qm',1,3749,'red',
 '10000000-0000-4000-8000-000000000004',
 '{"auto_path":[[[0.1,0.2],[0.3,0.4]]],"auto_leave":true,"auto_scored":2,"auto_missed":1}',
 'Fake local scouting submission.');
insert into public.pit_scouting (id,event_id,team_number,scout_id,data,notes) values
 ('97000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',3749,
 '10000000-0000-4000-8000-000000000005','{}','Fake local pit submission.');
commit;
