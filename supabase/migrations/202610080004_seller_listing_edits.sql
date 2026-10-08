begin;
alter table public.products enable row level security;
create policy seller_read_own_listings on public.products
for select to authenticated using (seller_id = auth.uid());
grant select on public.products to authenticated;
-- Restrictive policy applies even if an older UPDATE policy was too broad.
create policy seller_edit_ownership_guard on public.products
as restrictive for update to authenticated
using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy seller_edit_own_listing on public.products
for update to authenticated
using (seller_id = auth.uid()) with check (seller_id = auth.uid());
grant update (title,description,price,category,condition,location,shipping_carrier,shipping_fee,image_path)
on public.products to authenticated;
-- Prevent an existing broad UPDATE grant from allowing ownership transfers.
create function public.preserve_listing_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.seller_id is distinct from old.seller_id then
    raise exception 'Listing ownership cannot be changed.';
  end if;
  return new;
end;
$$;
create trigger preserve_listing_owner before update on public.products
for each row execute function public.preserve_listing_owner();
commit;
