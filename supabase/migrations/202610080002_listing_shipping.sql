begin;
alter table public.products
  add column shipping_carrier text,
  add column shipping_fee numeric;
alter table public.products add constraint products_shipping_valid check (
  (shipping_carrier is null and shipping_fee is null) or
  (shipping_carrier is not null and shipping_fee is not null
   and shipping_carrier in ('LBC','J&T Express','JRS Express','Ninja Van','Flash Express','Other courier')
   and shipping_fee >= 0 and shipping_fee <= 99999999.99
   and shipping_fee = round(shipping_fee,2))
);
-- Preserve old listings without inventing fees. Require shipping on new listings
-- and whenever shipping fields are edited, regardless of client validation.
create function public.require_listing_shipping() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.shipping_carrier is null or new.shipping_fee is null then
    raise exception 'Shipping carrier and shipping fee are required.';
  end if;
  return new;
end;
$$;
create trigger require_listing_shipping
before insert or update of shipping_carrier, shipping_fee on public.products
for each row execute function public.require_listing_shipping();
commit;
