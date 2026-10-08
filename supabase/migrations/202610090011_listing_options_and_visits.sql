begin;

alter table public.products
  add column listing_type text not null default 'fixed_price' check (listing_type in ('fixed_price','auction')),
  add column quantity integer not null default 1 check (quantity between 0 and 1000000),
  add column variations jsonb not null default '[]'::jsonb,
  add column auction_starting_price numeric,
  add column auction_ends_at timestamptz;

-- Preserve existing live/expired auction records and their actual starting bids.
update public.products p set listing_type='auction',
  auction_starting_price=a.starting_price,auction_ends_at=a.ends_at
from public.auctions a where a.product_id=p.id and a.status='active';
-- Multiple active auctions for one item must be resolved before this migration.
create unique index auctions_one_active_per_product on public.auctions(product_id) where status='active';
grant insert(listing_type,quantity,variations,auction_starting_price,auction_ends_at),
  update(listing_type,quantity,variations,auction_starting_price,auction_ends_at)
on public.products to authenticated;

create function public.validate_listing_options() returns trigger
language plpgsql set search_path='' as $$
declare v jsonb; names text[]:=array[]::text[]; total bigint:=0; n text;
begin
  if jsonb_typeof(new.variations) is distinct from 'array' or jsonb_array_length(new.variations)>20 then
    raise exception 'Use up to 20 variations.';
  end if;
  for v in select value from jsonb_array_elements(new.variations) loop
    if jsonb_typeof(v) is distinct from 'object'
       or jsonb_typeof(v->'name') is distinct from 'string'
       or length(trim(v->>'name')) not between 1 and 100
       or jsonb_typeof(v->'quantity') is distinct from 'number'
       or (v->>'quantity') !~ '^\d+$'
       or (v->>'quantity')::numeric not between 0 and 1000000
       or v-'name'-'quantity' <> '{}'::jsonb then
      raise exception 'Each variation needs a name and a whole quantity from 0 to 1,000,000.';
    end if;
    n:=lower(trim(v->>'name'));
    if n=any(names) then raise exception 'Variation names must be different.'; end if;
    names:=array_append(names,n);
    total:=total+(v->>'quantity')::bigint;
  end loop;
  if jsonb_array_length(new.variations)>0 and total<>new.quantity then
    raise exception 'Total quantity must match variation quantities.';
  end if;
  if new.listing_type='auction' then
    if new.quantity<>1 or jsonb_array_length(new.variations)<>0 then
      raise exception 'An auction is for one item or lot without selectable variations.';
    end if;
    if new.auction_starting_price is null or new.auction_starting_price::text in ('NaN','Infinity','-Infinity')
       or new.auction_starting_price<=0 or new.auction_starting_price>99999999999999.99
       or new.auction_starting_price<>round(new.auction_starting_price,2)
       or new.auction_ends_at is null or not isfinite(new.auction_ends_at) then
      raise exception 'Enter a positive starting bid and an auction closing time.';
    end if;
    if (tg_op='INSERT' or old.listing_type is distinct from new.listing_type
        or old.auction_ends_at is distinct from new.auction_ends_at)
        and new.auction_ends_at<=clock_timestamp() then
      raise exception 'Choose an auction closing time in the future.';
    end if;
  elsif new.auction_starting_price is not null or new.auction_ends_at is not null then
    raise exception 'Fixed-price listings cannot have auction settings.';
  end if;
  return new;
end; $$;
create trigger validate_listing_options before insert or update of
  listing_type,quantity,variations,auction_starting_price,auction_ends_at
on public.products for each row execute function public.validate_listing_options();

-- A product save and its auction configuration commit together. Clients retain
-- no direct auction-write grants. Product RLS and ID approval still apply.
create function public.sync_listing_auction() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.auctions%rowtype; has_bids boolean;
begin
  -- Product is already locked by INSERT/UPDATE. Bidding and moderation below
  -- use the same product-then-auction order to avoid lock inversions.
  perform id from public.auctions where product_id=new.id order by id for update;
  select exists(select 1 from public.marketplace_bids b join public.auctions x
    on x.id::text=b.auction_id where x.product_id=new.id) into has_bids;
  if tg_op='UPDATE' and has_bids and (
    new.listing_type is distinct from old.listing_type or new.quantity is distinct from old.quantity
    or new.variations is distinct from old.variations or new.price is distinct from old.price
    or new.auction_starting_price is distinct from old.auction_starting_price
    or new.auction_ends_at is distinct from old.auction_ends_at) then
    raise exception 'Bids already exist. Selling format, price, quantity, variations and closing time cannot be changed.';
  end if;
  select * into a from public.auctions where product_id=new.id and status='active';
  if new.listing_type='fixed_price' then
    if a.id is not null then delete from public.auctions where id=a.id; end if;
  elsif a.id is null then
    if has_bids then raise exception 'This auction already has bids and cannot be restarted.'; end if;
    if new.auction_ends_at<=clock_timestamp() then raise exception 'Choose a future auction closing time.'; end if;
    insert into public.auctions(product_id,starting_price,current_bid,starts_at,ends_at,status)
    values(new.id,new.auction_starting_price,new.auction_starting_price,clock_timestamp(),new.auction_ends_at,'active');
  elsif not has_bids then
    update public.auctions set starting_price=new.auction_starting_price,
      current_bid=new.auction_starting_price,ends_at=new.auction_ends_at where id=a.id;
  end if;
  return new;
end; $$;
revoke all on function public.sync_listing_auction() from public,anon,authenticated;
create trigger sync_listing_auction after insert or update of
  listing_type,quantity,variations,price,auction_starting_price,auction_ends_at
on public.products for each row execute function public.sync_listing_auction();

-- Require policy acknowledgment for the new substantive edit fields too.
drop trigger require_listing_policy on public.products;
create trigger require_listing_policy before insert or update of
  title,description,price,category,condition,location,shipping_carrier,shipping_fee,image_path,listing_policy_version,
  listing_type,quantity,variations,auction_starting_price,auction_ends_at
on public.products for each row execute function public.require_listing_policy();

create or replace function public.place_marketplace_bid(p_auction_id text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.auctions%rowtype; p public.products%rowtype; bidder uuid:=auth.uid();
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
  if p_amount<=greatest(coalesce(a.current_bid,0),coalesce(a.starting_price,0)) then
    raise exception 'Your bid must exceed the current bid and starting price.';
  end if;
  insert into public.marketplace_bids(auction_id,bidder_id,amount) values(a.id::text,bidder,p_amount);
  update public.auctions set current_bid=p_amount where id=a.id returning * into a;
  return to_jsonb(a);
end; $$;

create or replace function public.admin_delete_listing(p_listing_id text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype; deletion_time timestamptz:=clock_timestamp();
begin
  if not public.is_marketplace_admin() then raise exception 'Administrator access required.'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Enter a reason for deletion (up to 500 characters).'; end if;
  select * into p from public.products where id::text=p_listing_id for update;
  if not found then raise exception 'Listing not found.'; end if;
  if p.deleted_at is not null then raise exception 'This listing is already deleted.'; end if;
  perform id from public.auctions where product_id=p.id order by id for update;
  update public.products set deleted_at=deletion_time where id=p.id;
  insert into public.listing_deletion_audit(listing_id,admin_id,reason,deleted_at)
    values(p.id::text,auth.uid(),trim(p_reason),deletion_time);
  return jsonb_build_object('id',p.id,'deleted_at',deletion_time);
end; $$;

-- Private daily deduplication; no IP addresses, emails, user IDs or page paths.
create table public.marketplace_visit_total(id boolean primary key default true check(id),total bigint not null default 0);
insert into public.marketplace_visit_total(id) values(true);
create table public.marketplace_visit_days(day date not null,visitor_hash text not null,primary key(day,visitor_hash));
alter table public.marketplace_visit_total enable row level security;
alter table public.marketplace_visit_days enable row level security;
revoke all on public.marketplace_visit_total,public.marketplace_visit_days from public,anon,authenticated;
create function public.record_marketplace_visit(p_visitor uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'Asia/Manila')::date; counted boolean; result bigint;
begin
  if p_visitor is null then raise exception 'Visitor token required.'; end if;
  insert into public.marketplace_visit_days(day,visitor_hash) values(today,md5(p_visitor::text||today::text))
    on conflict do nothing;
  counted:=found;
  if counted then
    update public.marketplace_visit_total set total=total+1 where id=true returning total into result;
    delete from public.marketplace_visit_days where day<today-7;
  else select total into result from public.marketplace_visit_total where id=true;
  end if;
  return result;
end; $$;
revoke all on function public.record_marketplace_visit(uuid) from public;
grant execute on function public.record_marketplace_visit(uuid) to anon,authenticated;

notify pgrst,'reload schema';
commit;
