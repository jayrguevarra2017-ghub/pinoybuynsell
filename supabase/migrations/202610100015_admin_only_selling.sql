begin;

-- This migration changes public marketplace objects only. Supabase owns
-- storage.objects; its additional photo-write guard is a separate migration
-- (016) so lack of Storage ownership cannot roll back the selling restriction.

-- Trusted administrator membership replaces the ID-approval requirement for
-- listing writes. Buyer verification and bidding functions are unchanged.
alter policy verified_listing_insert on public.products
  with check (public.is_marketplace_admin() and seller_id = auth.uid());
alter policy verified_listing_update on public.products
  using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());
alter table public.products enable row level security;

-- Restrictive policies also cover broad permissive policies on older sites.
drop policy if exists admin_only_listing_insert on public.products;
create policy admin_only_listing_insert on public.products as restrictive
  for insert to anon,authenticated
  with check (public.is_marketplace_admin() and seller_id = auth.uid());
drop policy if exists admin_only_listing_update on public.products;
create policy admin_only_listing_update on public.products as restrictive
  for update to anon,authenticated
  using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());
drop policy if exists admin_only_listing_delete on public.products;
create policy admin_only_listing_delete on public.products as restrictive
  for delete to anon,authenticated using (public.is_marketplace_admin());

-- Also reject non-admin listing writes through a definer function. Maintenance
-- and service operations without a signed-in user retain their existing access.
create or replace function public.require_admin_listing_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (current_user in ('anon','authenticated') or auth.uid() is not null)
      and not public.is_marketplace_admin() then
    raise exception 'Selling and listing posts are coming soon for members. Only administrators can sell or post listings for now.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function public.require_admin_listing_write() from public,anon,authenticated;
drop trigger if exists require_admin_listing_write on public.products;
create trigger require_admin_listing_write before insert or update or delete
  on public.products for each row execute function public.require_admin_listing_write();

-- This readiness check confirms listing restrictions, not Storage policies.
create or replace function public.marketplace_selling_policy() returns text
language sql stable set search_path = '' as $$select 'admin-only'::text$$;
revoke all on function public.marketplace_selling_policy() from public;
grant execute on function public.marketplace_selling_policy() to anon,authenticated;

notify pgrst,'reload schema';
commit;
