alter table public.tasks alter column owner_group_id set not null;
alter table public.tasks alter column season_id set not null;
create table public.task_submissions(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id) on delete restrict,author_id uuid not null references public.profiles(id),submitted_at timestamptz not null default now());
create table public.task_submission_evidence(submission_id uuid references public.task_submissions(id) on delete restrict,evidence_id uuid references public.task_evidence(id) on delete restrict,primary key(submission_id,evidence_id));
alter table public.task_history add column submission_id uuid references public.task_submissions(id);
alter table public.task_evidence add column removed boolean not null default false;
create or replace function public.is_task_assignee(task_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member() and exists(select 1 from public.tasks t join public.group_members m on m.group_id=t.owner_group_id where t.id=$1 and m.user_id=auth.uid())$$;
create or replace function public.can_view_task_overview(task_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member() and exists(select 1 from public.tasks where id=$1)$$;
create or replace function public.can_view_task_work(task_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member() and(public.is_task_assignee($1) or public.has_perm('manage_tasks') or exists(select 1 from public.task_reviewers where task_reviewers.task_id=$1 and user_id=auth.uid()))$$;
create or replace function public.group_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action';gid uuid;names uuid[];result public.groups;
begin
 if not public.has_perm('manage_groups') then raise exception 'Manage groups permission required';end if;
 if operation='create' then
  if nullif(btrim(payload->>'name'),'') is null then raise exception 'Group name required';end if;
  insert into public.groups(name) values(btrim(payload->>'name')) returning * into result;return to_jsonb(result);
 end if;
 gid:=(payload->>'id')::uuid;select * into result from public.groups where id=gid for update;if not found then raise exception 'Group not found';end if;
 if operation='rename' then if nullif(btrim(payload->>'name'),'') is null then raise exception 'Group name required';end if;update public.groups set name=btrim(payload->>'name') where id=gid returning * into result;
 elsif operation='members' then
  if jsonb_typeof(payload->'member_ids') is distinct from 'array' then raise exception 'Member array required';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into names from jsonb_array_elements_text(payload->'member_ids');
  if exists(select 1 from unnest(names) selected(id) left join public.profiles p on p.id=selected.id left join auth.users u on u.id=p.id where p.id is null or p.role='PENDING' or p.account_status<>'active' or u.email_confirmed_at is null) then raise exception 'Choose active admitted members';end if;
  delete from public.group_members where group_id=gid;insert into public.group_members(group_id,user_id) select gid,unnest(names);
 elsif operation='delete' then
  if exists(select 1 from public.tasks where owner_group_id=gid) then raise exception 'Group owns retained tasks; move them before deletion';end if;
  delete from public.group_members where group_id=gid;delete from public.groups where id=gid;
 else raise exception 'Unknown group action';end if;return to_jsonb(result);
end $$;
create or replace function public.task_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action';task public.tasks;next_status text;reviewers uuid[];submission uuid;field text;eid uuid;path text;kind text;
begin
 if not public.is_member() then raise exception 'Active verified session required';end if;
 if jsonb_typeof(payload) is distinct from 'object' or operation is null then raise exception 'Action object required';end if;
 if operation not in ('create','edit','move_group','reviewers','cancel','reopen','override_complete','start','submit','resubmit','complete','request_changes','approve','evidence','remove_file') then raise exception 'Unknown task action';end if;
 for field in select jsonb_object_keys(payload) loop
  if field<>all(case when operation in('create','edit') then array['action','id','expected_status','title','description','owner_group_id','group_id','season_id','deadline','requires_review','reviewer_ids'] when operation='move_group' then array['action','id','expected_status','owner_group_id'] when operation='reviewers' then array['action','id','expected_status','reviewer_ids'] when operation='evidence' then array['action','id','expected_status','kind','content','file_url'] when operation='remove_file' then array['action','id','expected_status','evidence_id'] when operation='request_changes' then array['action','id','expected_status','feedback'] else array['action','id','expected_status'] end) then raise exception 'Unknown task field %',field;end if;
 end loop;
 if operation='create' then
  if not public.has_perm('manage_tasks') then raise exception 'Manage tasks permission required';end if;
  if nullif(btrim(payload->>'title'),'') is null or payload->>'owner_group_id' is null then raise exception 'Title and owning group required';end if;
  insert into public.tasks(title,description,owner_group_id,group_id,season_id,deadline,requires_review,created_by)
  values(btrim(payload->>'title'),payload->>'description',(payload->>'owner_group_id')::uuid,(payload->>'group_id')::uuid,coalesce((payload->>'season_id')::uuid,(select id from public.seasons where is_current)),(payload->>'deadline')::date,coalesce((payload->>'requires_review')::boolean,false),auth.uid()) returning * into task;
 else select * into task from public.tasks where id=(payload->>'id')::uuid for update;if not found then raise exception 'Task not found';end if;end if;
 if operation in ('create','edit','move_group','reviewers','cancel','reopen','override_complete','remove_file','evidence_settings') and not public.has_perm('manage_tasks') then raise exception 'Manage tasks permission required';end if;
 if payload?'expected_status' and payload->>'expected_status'<>task.status then raise exception 'Task state changed; reload';end if;
 if operation in ('create','reviewers') or(operation='edit' and payload?'reviewer_ids') then
  if jsonb_typeof(coalesce(payload->'reviewer_ids','[]')) is distinct from 'array' then raise exception 'Reviewer array required';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into reviewers from jsonb_array_elements_text(coalesce(payload->'reviewer_ids','[]'));
  if exists(select 1 from unnest(reviewers) selected(id) left join public.profiles p on p.id=selected.id left join auth.users u on u.id=p.id where p.id is null or p.account_status<>'active' or p.role='PENDING' or u.email_confirmed_at is null) then raise exception 'Active reviewers required';end if;
  delete from public.task_reviewers where task_id=task.id;insert into public.task_reviewers(task_id,user_id) select task.id,unnest(reviewers);
 end if;
 if operation='edit' then
  if payload?'title' and nullif(btrim(payload->>'title'),'') is null then raise exception 'Title required';end if;
  update public.tasks t set title=case when payload?'title' then btrim(payload->>'title') else t.title end,description=case when payload?'description' then payload->>'description' else t.description end,owner_group_id=case when payload?'owner_group_id' then(payload->>'owner_group_id')::uuid else t.owner_group_id end,group_id=case when payload?'group_id' then(payload->>'group_id')::uuid else t.group_id end,season_id=case when payload?'season_id' then(payload->>'season_id')::uuid else t.season_id end,deadline=case when payload?'deadline' then(payload->>'deadline')::date else t.deadline end,requires_review=case when payload?'requires_review' then(payload->>'requires_review')::boolean else t.requires_review end where t.id=task.id returning * into task;
 elsif operation='move_group' then update public.tasks set owner_group_id=(payload->>'owner_group_id')::uuid where id=task.id returning * into task;
 elsif operation='evidence' then
  if not public.is_task_assignee(task.id) or task.status in ('completed','cancelled','submitted','resubmitted') then raise exception 'Current assignee in an editable work state required';end if;
  kind:=payload->>'kind';if kind not in ('note','link','picture') or nullif(btrim(payload->>'content'),'') is null then raise exception 'Evidence kind and content required';end if;
  if kind='link' and payload->>'content' !~ '^https?://' then raise exception 'Evidence link requires HTTP(S)';end if;
  path:=payload->>'file_url';
  if kind='picture' and (path is null or split_part(path,'/',1)<>auth.uid()::text or split_part(path,'/',2)<>task.id::text or not exists(select 1 from storage.objects where bucket_id='task-evidence' and name=path)) then raise exception 'Upload a scoped accepted picture first';end if;
  insert into public.task_evidence(task_id,user_id,kind,content,file_url) values(task.id,auth.uid(),kind,payload->>'content',path);
 elsif operation='remove_file' then
  update public.task_evidence set removed=true where id=(payload->>'evidence_id')::uuid and task_id=task.id returning file_url into path;if not found then raise exception 'Evidence not found';end if;
  return jsonb_build_object('id',task.id,'removed_path',path);
 elsif operation in ('start','submit','resubmit','complete','request_changes','approve','cancel','reopen','override_complete') then
  next_status:=null;
  if operation in ('start','submit','resubmit','complete') and not public.is_task_assignee(task.id) then raise exception 'Current owning-group membership required';end if;
  if operation='start' and task.status='assigned' then next_status:='in_progress';
  elsif operation='complete' and not task.requires_review and task.status in ('assigned','in_progress') then next_status:='completed';
  elsif operation='submit' and task.requires_review and task.status in ('assigned','in_progress') then next_status:='submitted';
  elsif operation='resubmit' and task.requires_review and task.status='changes_requested' then next_status:='resubmitted';
  elsif operation in ('request_changes','approve') and task.status in ('submitted','resubmitted') and exists(select 1 from public.task_reviewers where task_id=task.id and user_id=auth.uid()) then
   if operation='request_changes' then if nullif(btrim(payload->>'feedback'),'') is null then raise exception 'Feedback required';end if;next_status:='changes_requested';else next_status:='completed';end if;
  elsif operation='cancel' and task.status not in ('completed','cancelled') then next_status:='cancelled';
  elsif operation='reopen' and task.status='completed' then next_status:='in_progress';
  elsif operation='override_complete' and task.status not in ('completed','cancelled') then next_status:='completed';end if;
  if next_status is null then raise exception 'Illegal actor or task state transition';end if;
  if operation in ('submit','resubmit') then
   if not exists(select 1 from public.task_reviewers where task_id=task.id) then raise exception 'Select at least one reviewer';end if;
   insert into public.task_submissions(task_id,author_id) values(task.id,auth.uid()) returning id into submission;
   insert into public.task_submission_evidence select submission,id from public.task_evidence where task_id=task.id;
  elsif operation in ('approve','request_changes') then
   select id into submission from public.task_submissions where task_id=task.id order by submitted_at desc,id desc limit 1;
   insert into public.task_history(task_id,user_id,from_status,to_status,feedback,submission_id) values(task.id,auth.uid(),task.status,next_status,payload->>'feedback',submission);
  end if;
  update public.tasks set status=next_status where id=task.id returning * into task;
 elsif operation not in ('create','edit','move_group','reviewers','evidence','remove_file') then raise exception 'Unknown task action';end if;
 if task.requires_review and operation in ('create','edit','reviewers') and not exists(select 1 from public.task_reviewers where task_id=task.id) then raise exception 'Review-required task needs selected reviewers';end if;
 return to_jsonb(task);
end $$;
create or replace function public.task_overviews(payload jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;cursor uuid;last_id uuid;cnt integer;
begin
 if not public.is_member() then raise exception 'Active admission required';end if;
 cursor:=(payload->>'cursor')::uuid;
 select coalesce(jsonb_agg(value order by id),'[]'),max(id::text)::uuid,count(*) into rows,last_id,cnt from(
 select t.id,to_jsonb(t)||jsonb_build_object('owner_group_name',g.name,'category_name',c.name,'category_color',c.color,'assignee_names',coalesce((select jsonb_agg(p.display_name order by p.display_name) from public.group_members m join public.profiles p on p.id=m.user_id where m.group_id=t.owner_group_id and p.account_status='active'),'[]'),'is_assignee',public.is_task_assignee(t.id),'is_reviewer',exists(select 1 from public.task_reviewers where task_id=t.id and user_id=auth.uid())) value
 from public.tasks t join public.groups g on g.id=t.owner_group_id left join public.task_groups c on c.id=t.group_id
 where(cursor is null or t.id>cursor) and(not(payload?'owner_group_id') or t.owner_group_id=(payload->>'owner_group_id')::uuid)
 and(coalesce(payload->>'scope','all')<>'mine' or public.is_task_assignee(t.id)) and(coalesce(payload->>'scope','all')<>'review' or exists(select 1 from public.task_reviewers where task_id=t.id and user_id=auth.uid()))
 order by t.id limit 500) page;
 return jsonb_build_object('rows',rows,'next_cursor',case when cnt=500 then last_id else null end);
end $$;
revoke insert,update,delete on public.tasks,public.task_reviewers,public.task_evidence,public.task_history,public.groups,public.group_members from public,anon,authenticated;
alter table public.task_submissions enable row level security;alter table public.task_submission_evidence enable row level security;
grant select on public.task_submissions,public.task_submission_evidence to authenticated;
do $$ declare p record;t text;begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('tasks','task_reviewers','task_evidence','task_history') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;
 foreach t in array array['task_reviewers','task_evidence','task_history','task_submissions'] loop execute format('create policy task_work_read on public.%I for select to authenticated using(public.can_view_task_work(task_id))',t);end loop;
end $$;
create policy task_overview_read on public.tasks for select to authenticated using(public.is_member());
create policy submission_evidence_read on public.task_submission_evidence for select to authenticated using(exists(select 1 from public.task_submissions s where s.id=submission_id and public.can_view_task_work(s.task_id)));
create or replace function toolkit_private.can_read_task_file(object_name text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.tasks t where t.id::text=split_part(object_name,'/',2) and public.can_view_task_work(t.id))$$;
create or replace function toolkit_private.can_upload_task_file(object_name text) returns boolean language sql stable security definer set search_path='' as $$select split_part(object_name,'/',1)=auth.uid()::text and exists(select 1 from public.tasks t where t.id::text=split_part(object_name,'/',2) and public.is_task_assignee(t.id) and t.status not in('completed','cancelled','submitted','resubmitted'))$$;
create policy task_file_removal on storage.objects as restrictive for delete to authenticated using(bucket_id<>'task-evidence' or(public.has_perm('manage_tasks') and exists(select 1 from public.task_evidence e where e.file_url=storage.objects.name and e.removed)) or(not exists(select 1 from public.task_evidence e where e.file_url=storage.objects.name) and split_part(name,'/',1)=auth.uid()::text));
insert into toolkit_upgrade.source_rows select 'task_assignees',task_id::text||':'||user_id::text,to_jsonb(a) from public.task_assignees a on conflict do nothing;
drop table public.task_assignees;
revoke all on function public.group_action(jsonb),public.task_action(jsonb),public.task_overviews(jsonb),public.is_task_assignee(uuid),public.can_view_task_overview(uuid),public.can_view_task_work(uuid) from public,anon,authenticated;
grant execute on function public.group_action(jsonb),public.task_action(jsonb),public.task_overviews(jsonb),public.is_task_assignee(uuid),public.can_view_task_overview(uuid),public.can_view_task_work(uuid) to authenticated;
notify pgrst,'reload schema';
