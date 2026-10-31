insert into public.org_settings(key,value) select 'task_evidence_mime_types',case when allowed_mime_types is not null and cardinality(allowed_mime_types)>0 and allowed_mime_types<@array['image/jpeg','image/png','image/webp','image/gif','image/avif'] then to_jsonb(allowed_mime_types)::text else '["image/jpeg","image/png","image/webp"]' end from storage.buckets where id='task-evidence' on conflict do nothing;
insert into public.org_settings(key,value) select 'task_evidence_max_bytes',case when file_size_limit>0 then file_size_limit::text else '10485760' end from storage.buckets where id='task-evidence' on conflict do nothing;
update storage.buckets set public=false,allowed_mime_types=(select array(select jsonb_array_elements_text(value::jsonb)) from public.org_settings where key='task_evidence_mime_types'),file_size_limit=(select value::bigint from public.org_settings where key='task_evidence_max_bytes') where id='task-evidence';
create or replace function public.task_evidence_settings(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare mime jsonb;size bigint;
begin
 if not public.is_member() then raise exception 'Active verified session required';end if;
 if payload->>'action'='edit' then
  if not public.has_perm('manage_tasks') then raise exception 'Task management required';end if;
  mime:=payload->'mime_types';size:=(payload->>'max_bytes')::bigint;
  if jsonb_typeof(mime) is distinct from 'array' or jsonb_array_length(mime)=0 or exists(select 1 from jsonb_array_elements_text(mime) value where value not in('image/jpeg','image/png','image/webp','image/gif','image/avif')) or size is null or size<=0 or size>52428800 then raise exception 'Accepted image MIME array and positive maximum up to 50MiB required';end if;
  update public.org_settings set value=mime::text where key='task_evidence_mime_types';update public.org_settings set value=size::text where key='task_evidence_max_bytes';
  update storage.buckets set allowed_mime_types=array(select jsonb_array_elements_text(mime)),file_size_limit=size where id='task-evidence';
 elsif payload->>'action'<>'get' then raise exception 'Unknown settings action';end if;
 select value::jsonb into mime from public.org_settings where key='task_evidence_mime_types';select value::bigint into size from public.org_settings where key='task_evidence_max_bytes';
 return jsonb_build_object('mime_types',mime,'max_bytes',size);
end $$;
create or replace function toolkit_private.validate_task_picture() returns trigger language plpgsql security definer set search_path='' as $$
declare mime text[];size bigint;
begin
 if new.kind='picture' and not new.removed then
  select array(select jsonb_array_elements_text(value::jsonb)) into mime from public.org_settings where key='task_evidence_mime_types';select value::bigint into size from public.org_settings where key='task_evidence_max_bytes';
  if not exists(select 1 from storage.objects where bucket_id='task-evidence' and name=new.file_url and metadata->>'mimetype'=any(mime) and(metadata->>'size')::bigint>0 and(metadata->>'size')::bigint<=size) then raise exception 'Picture violates task evidence policy';end if;
 end if;return new;
end $$;
create trigger validate_task_picture before insert on public.task_evidence for each row execute function toolkit_private.validate_task_picture();
revoke all on function public.task_evidence_settings(jsonb) from public,anon,authenticated;
grant execute on function public.task_evidence_settings(jsonb) to authenticated;
