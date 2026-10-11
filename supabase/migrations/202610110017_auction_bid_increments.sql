begin;

-- Existing auctions retain their one-cent rule. Newly created listings default
-- to ₱20; administrators can select ₱20, ₱40, ... ₱1,000 before the first bid.
alter table public.products add column if not exists auction_bid_increment numeric not null default 0.01;
alter table public.products alter column auction_bid_increment set default 20;
alter table public.products drop constraint if exists products_auction_bid_increment_check;
alter table public.products add constraint products_auction_bid_increment_check check (
  auction_bid_increment=0.01 or
  (auction_bid_increment between 20 and 1000 and mod(auction_bid_increment,20)=0)
);
grant insert(auction_bid_increment), update(auction_bid_increment) on public.products to authenticated;

-- The product row is locked before this trigger. The bidding RPC below takes
-- the same product lock, so a concurrent first bid and rule edit serialize.
create or replace function public.guard_auction_bid_increment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.auction_bid_increment::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Choose a minimum bid increase from ₱20 to ₱1,000, in steps of ₱20.';
  end if;
  if tg_op='INSERT' then
    if new.auction_bid_increment=0.01 then
      raise exception 'New listings require a minimum bid increase from ₱20 to ₱1,000, in steps of ₱20.';
    end if;
  elsif new.auction_bid_increment is distinct from old.auction_bid_increment then
    if new.auction_bid_increment=0.01 then
      raise exception 'Choose a minimum bid increase from ₱20 to ₱1,000, in steps of ₱20.';
    end if;
    if exists(select 1 from public.marketplace_bids b join public.auctions a
      on a.id::text=b.auction_id where a.product_id=new.id) then
      raise exception 'Bids already exist. The minimum bid increase cannot be changed.';
    end if;
  elsif new.listing_type='auction' and old.listing_type is distinct from new.listing_type and new.auction_bid_increment=0.01 then
    raise exception 'Choose a minimum bid increase from ₱20 to ₱1,000, in steps of ₱20.';
  end if;
  return new;
end; $$;
revoke all on function public.guard_auction_bid_increment() from public,anon,authenticated;
drop trigger if exists guard_auction_bid_increment on public.products;
create trigger guard_auction_bid_increment before insert or update of auction_bid_increment,listing_type
on public.products for each row execute function public.guard_auction_bid_increment();

-- Include the new substantive edit in the existing acknowledgment requirement.
drop trigger require_listing_policy on public.products;
create trigger require_listing_policy before insert or update of
  title,description,price,category,condition,location,shipping_carrier,shipping_fee,image_path,listing_policy_version,
  listing_type,quantity,variations,auction_starting_price,auction_ends_at,auction_bid_increment
on public.products for each row execute function public.require_listing_policy();

create or replace function public.place_marketplace_bid(p_auction_id text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.auctions%rowtype; p public.products%rowtype; bidder uuid:=auth.uid(); minimum_bid numeric;
begin
  if bidder is null then raise exception 'Sign in to place a bid.'; end if;
  if not public.is_marketplace_verified() then raise exception 'Upload your ID and wait for administrator approval before bidding.'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount<=0 or p_amount>99999999999999.99 or p_amount<>round(p_amount,2) then
    raise exception 'Enter a positive bid with at most two decimal places.';
  end if;
  select x.* into p from public.products x join public.auctions y on y.product_id=x.id
    where y.id::text=p_auction_id for update of x;
  if not found then raise exception 'Auction not found.'; end if;
  if p.status<>'active' or p.deleted_at is not null or p.listing_type<>'auction' or p.quantity<>1 then
    raise exception 'This listing is unavailable for bidding.';
  end if;
  if p.seller_id=bidder then raise exception 'You cannot bid on your own listing.'; end if;
  select * into a from public.auctions where id::text=p_auction_id for update;
  if not found or a.status<>'active' or a.ends_at is null or a.ends_at<=clock_timestamp()
     or (a.starts_at is not null and a.starts_at>clock_timestamp()) then
    raise exception 'This auction is not open for bidding.';
  end if;
  minimum_bid:=greatest(coalesce(a.current_bid,0),coalesce(a.starting_price,0))+p.auction_bid_increment;
  if p_amount<minimum_bid then
    raise exception 'Your bid must be at least ₱%. Refresh the auction to see the latest price.', to_char(minimum_bid,'FM999999999999990.00');
  end if;
  insert into public.marketplace_bids(auction_id,bidder_id,amount) values(a.id::text,bidder,p_amount);
  update public.auctions set current_bid=p_amount where id=a.id returning * into a;
  return to_jsonb(a);
end; $$;

revoke all on function public.place_marketplace_bid(text,numeric) from public,anon;
grant execute on function public.place_marketplace_bid(text,numeric) to authenticated;

-- The website enables the new settings only when backend enforcement exists.
create or replace function public.marketplace_bid_increment_policy() returns text
language sql immutable set search_path='' as $$select 'amount-steps-v1'::text$$;
revoke all on function public.marketplace_bid_increment_policy() from public;
grant execute on function public.marketplace_bid_increment_policy() to anon,authenticated;

notify pgrst,'reload schema';
commit;
