-- Accept only Supabase Storage public receipt paths; never silently rewrite external links.
do $$ declare row record;path text;begin
 for row in select id,receipt_url from public.purchases where receipt_url is not null loop
  path:=row.receipt_url;
  if path ~ '^https://' then
   if path !~ '^https://[A-Za-z0-9.-]+[.]supabase[.]co/storage/v1/object/public/receipts/[^?#]+$' then raise exception 'Unmappable receipt URL for purchase %; source must be corrected explicitly',row.id;end if;
   path:=regexp_replace(path,'^https://[^/]+/storage/v1/object/public/receipts/','');
   if position('%' in path)>0 then raise exception 'Encoded receipt path requires explicit mapping for purchase %',row.id;end if;
  elsif path ~ '^[A-Za-z]+:' or path like '/%' or position('..' in path)>0 then raise exception 'Unmappable receipt path for purchase %',row.id;end if;
  if not exists(select 1 from storage.objects where bucket_id='receipts' and name=path) then raise exception 'Missing receipt object for purchase %: %',row.id,path;end if;
  update public.purchases set receipt_url=path where id=row.id;
 end loop;
end $$;
