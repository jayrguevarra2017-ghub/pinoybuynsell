begin;
alter table public.products add column listing_policy_version text;
grant insert(listing_policy_version),update(listing_policy_version) on public.products to authenticated;
create function public.require_listing_policy() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.listing_policy_version is distinct from '2026-10-08' then
   raise exception 'Read and confirm the current prohibited-items policy before saving your listing.';
 end if;
 return new;
end; $$;
-- Existing records remain readable. Publishing or editing requires acknowledgment.
-- Admin deletion updates only deleted_at, so moderation is never blocked here.
create trigger require_listing_policy before insert or update of
 title,description,price,category,condition,location,shipping_carrier,shipping_fee,image_path,listing_policy_version
on public.products for each row execute function public.require_listing_policy();
commit;
