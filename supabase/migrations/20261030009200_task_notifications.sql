create or replace function public.trg_notify_task_status() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record;
begin
 if new.status is not distinct from old.status then return new;end if;
 if new.status in ('submitted','resubmitted') then
  for recipient in select user_id from public.task_reviewers where task_id=new.id loop perform public.notify(recipient.user_id,'task','Task ready for review',new.title,'/tasks/'||new.id);end loop;
 else
  for recipient in select user_id from public.group_members where group_id=new.owner_group_id loop perform public.notify(recipient.user_id,'task','Shared task updated',new.title||' — '||new.status,'/tasks/'||new.id);end loop;
 end if;return new;
end $$;
revoke all on function public.trg_notify_task_status() from public,anon,authenticated;
