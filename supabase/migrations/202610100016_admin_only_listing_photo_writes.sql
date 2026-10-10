begin;

-- Additional Storage protection, separate from migration 015. Run only through
-- an authorized role that can manage policies on Supabase's Storage table.
-- Do not change Storage ownership or grant yourself a managed role to run this.
do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'storage.objects'::regclass
      and pg_has_role(current_user, relowner, 'USAGE')
  ) and not exists (select 1 from pg_roles where rolname = current_user and rolsuper) then
    raise exception 'Listing-photo protection requires authorized Storage policy management. Migration 015 can be run separately to activate admin-only listing writes. Ask Supabase support to resolve Storage policy permissions; do not change storage.objects ownership.'
      using errcode = '42501';
  end if;
end; $$;

-- Existing public photo reads, other buckets and owner-folder rules stay intact.
drop policy if exists admin_only_listing_photo_insert on storage.objects;
create policy admin_only_listing_photo_insert on storage.objects as restrictive
  for insert to anon,authenticated
  with check (bucket_id <> 'listing-photos' or public.is_marketplace_admin());
drop policy if exists admin_only_listing_photo_update on storage.objects;
create policy admin_only_listing_photo_update on storage.objects as restrictive
  for update to anon,authenticated
  using (bucket_id <> 'listing-photos' or public.is_marketplace_admin())
  with check (bucket_id <> 'listing-photos' or public.is_marketplace_admin());
drop policy if exists admin_only_listing_photo_delete on storage.objects;
create policy admin_only_listing_photo_delete on storage.objects as restrictive
  for delete to anon,authenticated
  using (bucket_id <> 'listing-photos' or public.is_marketplace_admin());

notify pgrst,'reload schema';
commit;
