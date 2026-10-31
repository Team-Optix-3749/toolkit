alter table public.invitations add column token_hash text;
update public.invitations set token_hash=encode(extensions.digest(code,'sha256'),'hex');
alter table public.invitations alter column token_hash set not null;
create unique index invitations_token_hash_key on public.invitations(token_hash);
alter table public.invitations drop column code;
revoke all on public.invitations from public,anon,authenticated;
create or replace function public.invitation_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action'; invitation public.invitations; raw_token text; target_id uuid; expires timestamptz; unknown text[]; account public.profiles; result jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('inspect','create','list','revoke','redeem') then raise exception 'Unknown invitation action'; end if;
  select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(case operation when 'inspect' then array['action','code'] when 'redeem' then array['action','code'] when 'create' then array['action','expires_at'] when 'revoke' then array['action','id'] else array['action'] end));
  if unknown is not null then raise exception 'Unsupported invitation fields: %',unknown; end if;
  if operation in ('inspect','redeem') then
    raw_token:=payload->>'code';
    if raw_token is null or length(raw_token) not between 8 and 256 then return jsonb_build_object('state','invalid'); end if;
    if operation='inspect' then
      select * into invitation from public.invitations where token_hash=encode(extensions.digest(raw_token,'sha256'),'hex');
      return jsonb_build_object('state',case when not found or invitation.revoked then 'invalid' when invitation.expires_at<=clock_timestamp() then 'expired' else 'valid' end);
    end if;
    if not toolkit_private.has_auth_session() then raise exception using errcode='28000',message='A verified sign-in session is required'; end if;
    select * into account from public.profiles where id=auth.uid() for update;
    if account.id is null or account.role<>'PENDING' or account.account_status<>'active' then raise exception 'Invitation admission requires a prospective ordinary account'; end if;
    if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before redeeming this invitation'; end if;
    select * into invitation from public.invitations where token_hash=encode(extensions.digest(raw_token,'sha256'),'hex') for update;
    if not found or invitation.revoked then return jsonb_build_object('state','invalid'); end if;
    if invitation.expires_at<=clock_timestamp() then return jsonb_build_object('state','expired'); end if;
    update public.profiles set role='MEMBER',permissions='{}' where id=auth.uid();
    return jsonb_build_object('state','admitted');
  end if;
  if not public.has_perm('manage_invitations') then raise exception using errcode='42501',message='Invitation management permission is required'; end if;
  if operation='list' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'expires_at',expires_at,'revoked',revoked) order by created_at desc),'[]') into result from public.invitations;
    return result;
  elsif operation='create' then
    if payload->>'expires_at' is null or payload->>'expires_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'An offset-qualified expiry is required'; end if;
    expires:=(payload->>'expires_at')::timestamptz;
    if expires<=clock_timestamp() then raise exception 'Expiry must be in the future'; end if;
    raw_token:=encode(extensions.gen_random_bytes(32),'hex');
    insert into public.invitations(created_by,expires_at,token_hash) values(auth.uid(),expires,encode(extensions.digest(raw_token,'sha256'),'hex')) returning * into invitation;
    return jsonb_build_object('id',invitation.id,'code',raw_token,'expires_at',expires);
  else
    target_id:=(payload->>'id')::uuid;
    select * into invitation from public.invitations where id=target_id for update;
    if not found then raise exception 'Invitation not found'; end if;
    if invitation.revoked then raise exception 'Invitation already revoked'; end if;
    update public.invitations set revoked=true where id=target_id;
    return jsonb_build_object('id',target_id,'revoked',true);
  end if;
end $$;
revoke all on function public.invitation_action(jsonb) from public,anon,authenticated;
grant execute on function public.invitation_action(jsonb) to anon,authenticated;
notify pgrst,'reload schema';
