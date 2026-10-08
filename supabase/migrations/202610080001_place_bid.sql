begin;
create table public.marketplace_bids (
  id bigint generated always as identity primary key,
  auction_id text not null,
  bidder_id uuid not null references auth.users(id),
  amount numeric(16,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.marketplace_bids enable row level security;
create policy own_bid_reads on public.marketplace_bids
  for select to authenticated using (bidder_id = auth.uid());
revoke all on public.marketplace_bids from public, anon, authenticated;
grant select on public.marketplace_bids to authenticated;

create function public.place_marketplace_bid(p_auction_id text, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions%rowtype;
  seller text;
  bidder uuid := auth.uid();
begin
  if bidder is null then raise exception 'Sign in to place a bid.'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount <= 0 or p_amount > 99999999999999.99
     or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a positive bid with at most two decimal places.';
  end if;
  select * into a from public.auctions where id::text = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  select seller_id::text into seller from public.products
    where id = a.product_id and status = 'active' for share;
  if not found then raise exception 'This listing is unavailable.'; end if;
  if seller = bidder::text then raise exception 'You cannot bid on your own listing.'; end if;
  if a.status <> 'active' or a.ends_at is null or a.ends_at <= clock_timestamp()
     or (a.starts_at is not null and a.starts_at > clock_timestamp()) then
    raise exception 'This auction is not open for bidding.';
  end if;
  if p_amount <= greatest(coalesce(a.current_bid,0),coalesce(a.starting_price,0)) then
    raise exception 'Your bid must exceed the current bid and starting price.';
  end if;
  insert into public.marketplace_bids(auction_id,bidder_id,amount)
    values (a.id::text,bidder,p_amount);
  update public.auctions set current_bid = p_amount where id = a.id
    returning * into a;
  return to_jsonb(a);
end;
$$;
revoke all on function public.place_marketplace_bid(text,numeric) from public, anon;
grant execute on function public.place_marketplace_bid(text,numeric) to authenticated;
-- Bids and current price must be changed through the atomic function only.
revoke insert, update, delete on public.auctions from public, anon, authenticated;
commit;
