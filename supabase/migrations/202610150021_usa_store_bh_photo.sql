-- Run after 202610120020_usa_shopping_items.sql to allow B&H item cards.
-- Replacing the helper preserves existing cards, policies and stored store names.
begin;

create or replace function public.usa_item_store(p_url text)
returns text language sql immutable strict set search_path = '' as $$
 select case
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*amazon\.com(/[^[:space:]]*)?$' then 'Amazon'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*ebay\.com(/[^[:space:]]*)?$' then 'eBay'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*walmart\.com(/[^[:space:]]*)?$' then 'Walmart'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*target\.com(/[^[:space:]]*)?$' then 'Target'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*bestbuy\.com(/[^[:space:]]*)?$' then 'Best Buy'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*nike\.com(/[^[:space:]]*)?$' then 'Nike'
 when p_url ~ '^https://([A-Za-z0-9-]+\.)*bhphotovideo\.com(/[^[:space:]]*)?$' then 'B&H Photo'
 end;
$$;

revoke all on function public.usa_item_store(text) from public;
grant execute on function public.usa_item_store(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
