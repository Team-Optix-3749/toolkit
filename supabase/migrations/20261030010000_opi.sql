create unique index opi_one_linked_event on public.opis(event_id) where event_id is not null;
create or replace function toolkit_private.valid_docs_url(value text) returns boolean language sql immutable set search_path='' as $$select value ~ '^https://docs[.]google[.]com/document/d/[A-Za-z0-9_-]+([/?#][^[:space:]]*)?$'$$;
create or replace function public.opi_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action';proposal public.opis;fields jsonb;created jsonb;next_status text;unknown text[];
begin
 if not public.is_member() then raise exception 'Active verified session required';end if;
 if operation is null or operation not in('submit','resubmit','changes','reject','approve','reopen','convert') then raise exception 'Unknown OPI action';end if;
 select array_agg(key) into unknown from jsonb_object_keys(payload) key where key<>all(case operation when 'submit' then array['action','title','summary','document_url','season_id'] when 'resubmit' then array['action','id','title','summary','document_url'] when 'convert' then array['action','id','title','description','location','starts_at','ends_at','season_id','latitude','longitude'] else array['action','id','feedback'] end);
 if unknown is not null then raise exception 'Unsupported OPI fields: %',unknown;end if;
 if operation in('submit','resubmit') then
  if nullif(btrim(payload->>'title'),'') is null or nullif(btrim(payload->>'summary'),'') is null or not coalesce(toolkit_private.valid_docs_url(payload->>'document_url'),false) then raise exception 'Title, short summary and HTTPS Google Docs document URL required';end if;
 end if;
 if operation='submit' then
  insert into public.opis(submitter_id,title,summary,document_url,status,season_id) values(auth.uid(),btrim(payload->>'title'),btrim(payload->>'summary'),payload->>'document_url','SUBMITTED',coalesce((payload->>'season_id')::uuid,(select id from public.seasons where is_current))) returning * into proposal;
 else
  select * into proposal from public.opis where id=(payload->>'id')::uuid for update;
  if not found or (proposal.submitter_id<>auth.uid() and not public.has_perm('manage_opis')) then raise exception 'OPI unavailable';end if;
  if operation='resubmit' then
   if proposal.submitter_id<>auth.uid() or proposal.status<>'CHANGES_REQUESTED' then raise exception 'Only the submitter may resubmit requested changes';end if;
   update public.opis set title=btrim(payload->>'title'),summary=btrim(payload->>'summary'),document_url=payload->>'document_url',status='RESUBMITTED' where id=proposal.id returning * into proposal;
  else
   if not public.has_perm('manage_opis') then raise exception 'OPI management required';end if;
   if operation='convert' then
    if not public.has_perm('manage_outreach_events') or proposal.status<>'APPROVED' or proposal.event_id is not null then raise exception 'Approved OPI and both management permissions required';end if;
    created:=toolkit_private.create_outreach_event(payload,auth.uid());
    update public.opis set status='CONVERTED',event_id=(created->>'id')::uuid where id=proposal.id returning * into proposal;
   elsif operation='reopen' then
    if proposal.status not in('APPROVED','REJECTED') then raise exception 'Only approved or rejected OPI may reopen';end if;
    update public.opis set status='SUBMITTED' where id=proposal.id returning * into proposal;
   else
    if proposal.status not in('SUBMITTED','RESUBMITTED') then raise exception 'OPI is not awaiting review';end if;
    if operation in('changes','reject') and nullif(btrim(payload->>'feedback'),'') is null then raise exception 'Feedback required';end if;
    next_status:=case operation when 'changes' then 'CHANGES_REQUESTED' when 'reject' then 'REJECTED' else 'APPROVED' end;
    insert into public.opi_feedback(opi_id,user_id,feedback,decision) values(proposal.id,auth.uid(),coalesce(payload->>'feedback',''),next_status);
    update public.opis set status=next_status where id=proposal.id returning * into proposal;
   end if;
  end if;
 end if;
 if operation in('submit','resubmit') then insert into public.opi_versions(opi_id,title,summary,document_url) values(proposal.id,proposal.title,proposal.summary,proposal.document_url);end if;
 return to_jsonb(proposal);
end $$;
revoke insert,update,delete on public.opis,public.opi_versions,public.opi_feedback from public,anon,authenticated;
do $$ declare p record;begin for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in('opis','opi_versions','opi_feedback') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end $$;
create policy opi_read on public.opis for select to authenticated using(public.is_member() and(submitter_id=auth.uid() or public.has_perm('manage_opis')));
create or replace function toolkit_private.can_read_opi(id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member() and exists(select 1 from public.opis where opis.id=$1 and(submitter_id=auth.uid() or public.has_perm('manage_opis')))$$;
grant execute on function toolkit_private.can_read_opi(uuid) to authenticated;
create policy opi_versions_read on public.opi_versions for select to authenticated using(toolkit_private.can_read_opi(opi_id));
create policy opi_feedback_read on public.opi_feedback for select to authenticated using(toolkit_private.can_read_opi(opi_id));
revoke all on function public.opi_action(jsonb),toolkit_private.valid_docs_url(text) from public,anon,authenticated;
grant execute on function public.opi_action(jsonb) to authenticated;
notify pgrst,'reload schema';
