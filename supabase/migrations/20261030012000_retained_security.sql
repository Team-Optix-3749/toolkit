create or replace function public.purchase_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action';request public.purchases;amount numeric;receipt text;unknown text[];
begin
 if not public.is_member() then raise exception 'Active verified session required';end if;
 if operation not in('submit','edit_pending','approve','reject') or operation is null then raise exception 'Unknown purchase action';end if;
 select array_agg(key) into unknown from jsonb_object_keys(payload) key where key<>all(case when operation='submit' then array['action','kind','description','amount','receipt_url'] when operation='edit_pending' then array['action','id','kind','description','amount','receipt_url'] else array['action','id'] end);
 if unknown is not null then raise exception 'Unsupported purchase fields';end if;
 if operation<>'submit' then select * into request from public.purchases where id=(payload->>'id')::uuid for update;if not found or request.status<>'PENDING' then raise exception 'Pending purchase request required';end if;end if;
 if operation in('approve','reject') then
  if not public.has_perm('manage_purchases') then raise exception 'Purchase review permission required';end if;
  update public.purchases set status=case operation when 'approve' then 'APPROVED' else 'REJECTED' end,reviewer_id=auth.uid(),decided_at=now() where id=request.id returning * into request;return to_jsonb(request);
 end if;
 if operation='edit_pending' and request.user_id<>auth.uid() then raise exception 'Only owner may edit pending request';end if;
 if payload?'kind' then request.kind:=payload->>'kind';end if;if payload?'description' then request.description:=btrim(payload->>'description');end if;if payload?'amount' then request.amount:=(payload->>'amount')::numeric;end if;if payload?'receipt_url' then request.receipt_url:=payload->>'receipt_url';end if;
 if request.kind not in('purchase','reimbursement') or request.kind is null or nullif(btrim(request.description),'') is null or request.amount is null or request.amount<=0 or request.amount in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Valid kind, nonblank description and positive finite amount required';end if;
 receipt:=request.receipt_url;
 if receipt is not null and(split_part(receipt,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='receipts' and name=receipt)) then raise exception 'Upload a caller-owned receipt first';end if;
 if operation='submit' then insert into public.purchases(user_id,kind,description,amount,receipt_url,status) values(auth.uid(),request.kind,request.description,request.amount,receipt,'PENDING') returning * into request;
 else update public.purchases set kind=request.kind,description=request.description,amount=request.amount,receipt_url=receipt where id=request.id returning * into request;end if;return to_jsonb(request);
end $$;
revoke insert,update,delete on public.purchases from public,anon,authenticated;
revoke all on function public.purchase_action(jsonb) from public,anon,authenticated;grant execute on function public.purchase_action(jsonb) to authenticated;
-- Auth/session admission is restrictive on all retained tables; authors remain immutable.
create or replace function toolkit_private.scout_author_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is null then return new;end if;
 if tg_op='UPDATE' and new.scout_id is distinct from old.scout_id then raise exception 'Scouting author is immutable';end if;
 if new.scout_id is distinct from auth.uid() and tg_op='INSERT' then raise exception 'Scouting author must be caller';end if;
 if not public.is_member() then raise exception 'Active session required';end if;
 if not exists(select 1 from public.scout_events where id=new.event_id) or new.team_number<=0 then raise exception 'Valid scouting event and team required';end if;
 if tg_op='INSERT' and tg_table_name='match_scouting' then
  if not exists(select 1 from public.scout_matches m where m.event_id=new.event_id and m.match_type=new.match_type and m.match_number=new.match_number and new.team_number=any(m.red||m.blue)) then raise exception 'Match and team must belong to the selected event schedule';end if;
 end if;
 return new;
end $$;
create trigger scout_author_guard before insert or update on public.match_scouting for each row execute function toolkit_private.scout_author_guard();
create trigger scout_author_guard before insert or update on public.pit_scouting for each row execute function toolkit_private.scout_author_guard();
alter policy baseline_match_scouting_update on public.match_scouting with check(public.is_member() and(scout_id=auth.uid() or public.has_perm('manage_scouting')));
alter policy baseline_pit_scouting_update on public.pit_scouting with check(public.is_member() and(scout_id=auth.uid() or public.has_perm('manage_scouting')));
insert into toolkit_upgrade.source_rows select 'email_templates',id::text,to_jsonb(t) from public.email_templates t on conflict do nothing;
drop table public.email_templates;
notify pgrst,'reload schema';
