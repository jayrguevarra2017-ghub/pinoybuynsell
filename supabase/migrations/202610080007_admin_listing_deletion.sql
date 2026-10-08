begin;
alter table public.products add column deleted_at timestamptz;
create table public.listing_deletion_audit(
 id bigint generated always as identity primary key,
 listing_id text not null,admin_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 1 and 500),deleted_at timestamptz not null default now()
);
alter table public.listing_deletion_audit enable row level security;
revoke all on public.listing_deletion_audit from public,anon,authenticated;
grant select on public.listing_deletion_audit to authenticated;
create policy admin_deletion_audit_reads on public.listing_deletion_audit for select to authenticated using(public.is_marketplace_admin());
grant execute on function public.is_marketplace_admin() to anon;
create policy hide_deleted_listings on public.products as restrictive for select to anon,authenticated
using(deleted_at is null or public.is_marketplace_admin());
create policy admin_listing_reads on public.products for select to authenticated using(public.is_marketplace_admin());
create policy prevent_deleted_listing_edits on public.products as restrictive for update to authenticated
using(deleted_at is null) with check(deleted_at is null);
create function public.protect_listing_deletion() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' and new.deleted_at is not null then raise exception 'New listings cannot be marked deleted.'; end if;
 if tg_op='UPDATE' and new.deleted_at is distinct from old.deleted_at and not public.is_marketplace_admin() then
 raise exception 'Only an administrator can delete listings.'; end if;
 return new;
end; $$;
create trigger protect_listing_deletion before insert or update on public.products for each row execute function public.protect_listing_deletion();
create function public.admin_delete_listing(p_listing_id text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype; deletion_time timestamptz:=clock_timestamp();
begin
 if not public.is_marketplace_admin() then raise exception 'Administrator access required.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Enter a reason for deletion (up to 500 characters).'; end if;
 -- Match bidding lock order: auction first, then product.
 perform id from public.auctions where product_id::text=p_listing_id order by id for update;
 select * into p from public.products where id::text=p_listing_id for update;
 if not found then raise exception 'Listing not found.'; end if;
 if p.deleted_at is not null then raise exception 'This listing is already deleted.'; end if;
 update public.products set deleted_at=deletion_time where id=p.id;
 insert into public.listing_deletion_audit(listing_id,admin_id,reason,deleted_at) values(p.id::text,auth.uid(),trim(p_reason),deletion_time);
 return jsonb_build_object('id',p.id,'deleted_at',deletion_time);
end; $$;
revoke all on function public.admin_delete_listing(text,text) from public,anon;
grant execute on function public.admin_delete_listing(text,text) to authenticated;
create or replace function public.place_marketplace_bid(p_auction_id text, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.auctions%rowtype;
  seller text;
  bidder uuid := auth.uid();
begin
  if bidder is null then raise exception 'Sign in to place a bid.'; end if;
  if not public.is_marketplace_verified() then raise exception 'Upload your ID and wait for administrator approval before bidding.'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount <= 0 or p_amount > 99999999999999.99
     or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a positive bid with at most two decimal places.';
  end if;
  select * into a from public.auctions where id::text = p_auction_id for update;
  if not found then raise exception 'Auction not found.'; end if;
  select seller_id::text into seller from public.products
    where id = a.product_id and status = 'active' and deleted_at is null for share;
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

commit;
