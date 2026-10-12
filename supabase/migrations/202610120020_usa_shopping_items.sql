begin;

create function public.usa_item_store(p_url text)
returns text language sql immutable strict set search_path = '' as $$
 select case
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*amazon\.com(/[^[:space:]]*)?$' then 'Amazon'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*ebay\.com(/[^[:space:]]*)?$' then 'eBay'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*walmart\.com(/[^[:space:]]*)?$' then 'Walmart'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*target\.com(/[^[:space:]]*)?$' then 'Target'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*bestbuy\.com(/[^[:space:]]*)?$' then 'Best Buy'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*nike\.com(/[^[:space:]]*)?$' then 'Nike'
 end;
$$;

create table public.usa_shopping_items (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 3 and 200),
 item_url text not null check(length(item_url) <= 2000),
 store text generated always as (public.usa_item_store(item_url)) stored not null,
 description text not null check(length(trim(description)) between 10 and 1500),
 image_path text check(image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and image_path like admin_id::text || '/%'),
 usd_price numeric(12,2) check(usd_price >= 0 and usd_price <= 999999999),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(status <> 'published' or image_path is not null)
);
create index usa_items_public_time on public.usa_shopping_items(created_at desc) where status = 'published';
create index usa_items_owner_time on public.usa_shopping_items(admin_id,created_at desc);

create function public.stamp_usa_item_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at := clock_timestamp();
 return new;
end; $$;
create trigger usa_items_stamp before update on public.usa_shopping_items
for each row execute function public.stamp_usa_item_update();

alter table public.usa_shopping_items enable row level security;
revoke all on public.usa_shopping_items from public,anon,authenticated;
grant select on public.usa_shopping_items to anon,authenticated;
grant insert(title,item_url,description,image_path,usd_price,status) on public.usa_shopping_items to authenticated;
grant update(title,item_url,description,image_path,usd_price,status) on public.usa_shopping_items to authenticated;
grant delete on public.usa_shopping_items to authenticated;
grant all on public.usa_shopping_items to service_role;

create policy usa_items_reads on public.usa_shopping_items for select to anon,authenticated
using(status = 'published' or (admin_id = auth.uid() and public.is_marketplace_admin()));
create policy usa_items_create on public.usa_shopping_items for insert to authenticated
with check(admin_id = auth.uid() and public.is_marketplace_admin());
create policy usa_items_update on public.usa_shopping_items for update to authenticated
using(admin_id = auth.uid() and public.is_marketplace_admin())
with check(admin_id = auth.uid() and public.is_marketplace_admin());
create policy usa_items_delete on public.usa_shopping_items for delete to authenticated
using(admin_id = auth.uid() and public.is_marketplace_admin());

revoke all on function public.usa_item_store(text) from public;
grant execute on function public.usa_item_store(text) to anon,authenticated,service_role;
revoke all on function public.stamp_usa_item_update() from public;
notify pgrst,'reload schema';
commit;
