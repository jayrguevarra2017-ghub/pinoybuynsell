begin;
create table public.marketplace_admins(user_id uuid primary key references auth.users(id));
alter table public.marketplace_admins enable row level security;
revoke all on public.marketplace_admins from public,anon,authenticated;
create function public.is_marketplace_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.marketplace_admins where user_id=auth.uid()); $$;
revoke all on function public.is_marketplace_admin() from public;
grant execute on function public.is_marketplace_admin() to authenticated;
create table public.identity_verifications(
 user_id uuid primary key references auth.users(id),
 full_name text not null check(length(trim(full_name)) between 2 and 150),
 id_type text not null check(id_type in ('PhilSys ID','Passport','Driver license','Other government ID')),
 document_path text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id),review_note text
);
alter table public.identity_verifications enable row level security;
revoke all on public.identity_verifications from public,anon,authenticated;
grant select on public.identity_verifications to authenticated;
create policy verification_reads on public.identity_verifications for select to authenticated
using(user_id=auth.uid() or public.is_marketplace_admin());
create function public.is_marketplace_verified() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.identity_verifications where user_id=auth.uid() and status='approved'); $$;
revoke all on function public.is_marketplace_verified() from public;
grant execute on function public.is_marketplace_verified() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('identity-documents','identity-documents',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy identity_uploads on storage.objects for insert to authenticated
with check(bucket_id='identity-documents' and (storage.foldername(name))[1]=auth.uid()::text
 and not public.is_marketplace_verified());
create policy identity_document_reads on storage.objects for select to authenticated
using(bucket_id='identity-documents' and public.is_marketplace_admin());
create function public.submit_identity(p_name text,p_type text,p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in before submitting your ID.'; end if;
 if p_path not like auth.uid()::text || '/%' then raise exception 'Invalid document owner.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='identity-documents' and name=p_path) then
 raise exception 'Upload your ID first.'; end if;
 insert into public.identity_verifications(user_id,full_name,id_type,document_path)
 values(auth.uid(),trim(p_name),p_type,p_path)
 on conflict(user_id) do update set full_name=excluded.full_name,id_type=excluded.id_type,
 document_path=excluded.document_path,status='pending',submitted_at=now(),reviewed_at=null,reviewed_by=null,review_note=null
 where identity_verifications.status='rejected';
 if not found then raise exception 'Your verification is already pending or approved.'; end if;
end; $$;
create function public.review_identity(p_user_id uuid,p_decision text,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_marketplace_admin() then raise exception 'Administrator access required.'; end if;
 if p_user_id=auth.uid() then raise exception 'Another administrator must review your ID.'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision.'; end if;
 if length(p_note)>500 then raise exception 'Review note is too long.'; end if;
 update public.identity_verifications set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),review_note=p_note
 where user_id=p_user_id and status='pending';
 if not found then raise exception 'This submission has already been reviewed.'; end if;
end; $$;
revoke all on function public.submit_identity(text,text,text),public.review_identity(uuid,text,text) from public,anon;
grant execute on function public.submit_identity(text,text,text),public.review_identity(uuid,text,text) to authenticated;
create policy verified_listing_insert on public.products as restrictive for insert to authenticated
with check(public.is_marketplace_verified() and seller_id=auth.uid());
create policy verified_listing_update on public.products as restrictive for update to authenticated
using(public.is_marketplace_verified()) with check(public.is_marketplace_verified());
revoke insert,update,delete on public.products from public,anon;
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

commit;
