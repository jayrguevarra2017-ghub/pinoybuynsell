begin;
create table public.marketplace_payment_settings (
 seller_id uuid primary key references auth.users(id), details jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.marketplace_orders (
 id uuid primary key default gen_random_uuid(), request_key uuid not null,
 buyer_id uuid not null references auth.users(id), seller_id uuid not null references auth.users(id),
 product_id bigint not null references public.products(id), auction_id text unique,
 title text not null, quantity integer not null check(quantity between 1 and 1000000), variation text,
 unit_price numeric(16,2) not null check(unit_price>0), shipping_fee numeric(16,2) not null check(shipping_fee>=0),
 total numeric(16,2) not null check(total>0), shipping_carrier text not null,
 recipient_name text not null, phone text not null, address text not null,
 payment_details jsonb not null,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','payment_submitted','paid','cancelled')),
 last_receipt_id uuid, payment_method text check(payment_method in ('gcash','bank_deposit')), payment_reference text,
 review_note text not null default '', paid_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(buyer_id,request_key), check(buyer_id<>seller_id)
);
create index marketplace_orders_product_reservations on public.marketplace_orders(product_id,status);
create index marketplace_orders_buyer_created on public.marketplace_orders(buyer_id,created_at desc);
create index marketplace_orders_seller_created on public.marketplace_orders(seller_id,created_at desc);
create table public.marketplace_payment_receipts (
 id uuid primary key, order_id uuid not null references public.marketplace_orders(id),
 buyer_id uuid not null references auth.users(id), path text not null unique,
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 size_bytes integer not null check(size_bytes between 1 and 5242880), created_at timestamptz not null default now(),
 check(path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
alter table public.marketplace_orders add constraint marketplace_orders_receipt_fk
 foreign key(last_receipt_id) references public.marketplace_payment_receipts(id);
create table public.marketplace_payment_reviews (
 id bigint generated always as identity primary key, order_id uuid not null references public.marketplace_orders(id),
 receipt_id uuid not null references public.marketplace_payment_receipts(id), reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('paid','rejected')), note text not null, created_at timestamptz not null default now()
);
alter table public.marketplace_payment_settings enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_payment_receipts enable row level security;
alter table public.marketplace_payment_reviews enable row level security;
revoke all on public.marketplace_payment_settings,public.marketplace_orders,public.marketplace_payment_receipts,public.marketplace_payment_reviews from public,anon,authenticated;
grant select on public.marketplace_payment_settings,public.marketplace_orders,public.marketplace_payment_receipts,public.marketplace_payment_reviews to authenticated;
grant all on public.marketplace_payment_settings,public.marketplace_orders,public.marketplace_payment_receipts,public.marketplace_payment_reviews to service_role;
grant usage,select on sequence public.marketplace_payment_reviews_id_seq to service_role;
create policy own_payment_settings on public.marketplace_payment_settings for select to authenticated using(seller_id=auth.uid());
create policy private_order_reads on public.marketplace_orders for select to authenticated
 using(buyer_id=auth.uid() or seller_id=auth.uid() or public.is_marketplace_admin());
create policy private_receipt_reads on public.marketplace_payment_receipts for select to authenticated
 using(exists(select 1 from public.marketplace_orders o where o.id=order_id));
create policy private_review_reads on public.marketplace_payment_reviews for select to authenticated
 using(exists(select 1 from public.marketplace_orders o where o.id=order_id));

create function public.set_marketplace_payment_settings(p_details jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb:='{}'::jsonb; m text; x jsonb;
begin
 if auth.uid() is null or not public.is_marketplace_admin() then raise exception 'Administrator selling access required.'; end if;
 if jsonb_typeof(p_details) is distinct from 'object' or p_details-'gcash'-'bank_deposit'<>'{}'::jsonb then raise exception 'Choose GCash or bank deposit.'; end if;
 foreach m in array array['gcash','bank_deposit'] loop
  if p_details ? m then
   x:=p_details->m;
   if jsonb_typeof(x) is distinct from 'object' or x-'name'-'account'-'bank'<>'{}'::jsonb
      or jsonb_typeof(x->'name') is distinct from 'string' or length(trim(x->>'name')) not between 1 and 120
      or jsonb_typeof(x->'account') is distinct from 'string' or length(trim(x->>'account')) not between 1 and 100 then raise exception 'Enter the account name and number.'; end if;
   if m='gcash' and trim(x->>'account') !~ '^(09[0-9]{9}|\+639[0-9]{9})$' then raise exception 'Enter a valid Philippine GCash number.'; end if;
   if m='bank_deposit' and (jsonb_typeof(x->'bank') is distinct from 'string' or length(trim(x->>'bank')) not between 1 and 100) then raise exception 'Enter the bank name.'; end if;
   d:=d||jsonb_build_object(m,jsonb_build_object('name',trim(x->>'name'),'account',trim(x->>'account'))||case when m='bank_deposit' then jsonb_build_object('bank',trim(x->>'bank')) else '{}'::jsonb end);
  end if;
 end loop;
 if d='{}'::jsonb then raise exception 'Configure at least one payment method.'; end if;
 insert into public.marketplace_payment_settings(seller_id,details) values(auth.uid(),d)
 on conflict(seller_id) do update set details=excluded.details,updated_at=clock_timestamp();
 return d;
end; $$;

-- Public stock includes unpaid order reservations but never private buyers.
create function public.marketplace_checkout_preview(p_listing_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype; a public.auctions%rowtype; b public.marketplace_bids%rowtype; reserved bigint; choices jsonb; methods text[];
begin
 if auth.uid() is null then raise exception 'Sign in to check out.'; end if;
 select * into p from public.products where id::text=p_listing_id and status='active' and deleted_at is null;
 if not found then raise exception 'This item is unavailable for purchase.'; end if;
 if p.listing_policy_version is distinct from '2026-10-08' then raise exception 'The seller needs to update this listing before purchases are enabled.'; end if;
 select array_agg(key order by key) into methods from public.marketplace_payment_settings s,jsonb_object_keys(s.details) key where s.seller_id=p.seller_id;
 if methods is null then raise exception 'The seller has not configured payment details yet.'; end if;
 if p.listing_type='auction' then
  select * into a from public.auctions where product_id=p.id order by created_at desc,id desc limit 1;
  if not found or a.ends_at>clock_timestamp() or a.status not in ('active','ended') then raise exception 'Auction payment is available after bidding ends.'; end if;
  select * into b from public.marketplace_bids where auction_id=a.id::text order by amount desc,id desc limit 1;
  if not found then raise exception 'This auction ended without a winning bid.'; end if;
  if auth.uid() is null or b.bidder_id<>auth.uid() then raise exception 'Only the winning bidder can pay for this auction.'; end if;
  if exists(select 1 from public.marketplace_orders where auction_id=a.id::text and status<>'cancelled') then raise exception 'An order already exists for this auction. Open My orders.'; end if;
  return jsonb_build_object('id',p.id,'title',p.title,'listing_type','auction','unit_price',b.amount::text,'available',1,'variations','[]'::jsonb,'shipping_fee',p.shipping_fee::text,'shipping_carrier',p.shipping_carrier,'methods',methods);
 end if;
 select coalesce(sum(quantity),0) into reserved from public.marketplace_orders where product_id=p.id and status in ('awaiting_payment','payment_submitted');
 select coalesce(jsonb_agg(jsonb_build_object('name',v->>'name','quantity',greatest(0,(v->>'quantity')::bigint-(select coalesce(sum(o.quantity),0) from public.marketplace_orders o where o.product_id=p.id and o.variation=v->>'name' and o.status in ('awaiting_payment','payment_submitted'))))), '[]'::jsonb)
 into choices from jsonb_array_elements(p.variations) v;
 return jsonb_build_object('id',p.id,'title',p.title,'listing_type','fixed_price','unit_price',p.price::text,'available',greatest(0,p.quantity-reserved),'variations',choices,'shipping_fee',p.shipping_fee::text,'shipping_carrier',p.shipping_carrier,'methods',methods);
end; $$;

create function public.create_marketplace_order(p_listing_id text,p_quantity integer,p_variation text,p_recipient_name text,p_phone text,p_address text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype; preview jsonb; o public.marketplace_orders%rowtype; details jsonb; a public.auctions%rowtype; stock bigint; amount numeric; fee numeric;
begin
 if auth.uid() is null then raise exception 'Sign in to place an order.'; end if;
 if p_request_key is null or p_quantity is null or p_quantity not between 1 and 1000000
 or length(trim(coalesce(p_recipient_name,''))) not between 1 and 120 or length(trim(coalesce(p_phone,''))) not between 5 and 50
 or length(trim(coalesce(p_address,''))) not between 5 and 500 then raise exception 'Enter quantity, recipient name, phone and delivery address.'; end if;
 select * into p from public.products where id::text=p_listing_id for update;
 if not found then raise exception 'Item not found.'; end if;
 select * into o from public.marketplace_orders where buyer_id=auth.uid() and request_key=p_request_key;
 if found then
  if o.product_id<>p.id or o.quantity<>p_quantity or o.variation is distinct from nullif(trim(p_variation),'') then raise exception 'This order request was already used. Open My orders.'; end if;
  return to_jsonb(o);
 end if;
 if p.seller_id=auth.uid() then raise exception 'You cannot buy your own listing.'; end if;
 if p.listing_type='auction' then
  select * into a from public.auctions where product_id=p.id order by created_at desc,id desc limit 1 for update;
  select * into o from public.marketplace_orders where auction_id=a.id::text;
  if found then
   if o.buyer_id<>auth.uid() or o.status='cancelled' then raise exception 'This auction order is unavailable. Contact support.'; end if;
   return to_jsonb(o);
  end if;
  if p_quantity<>1 or nullif(trim(p_variation),'') is not null then raise exception 'An auction is for one lot.'; end if;
 end if;
 preview:=public.marketplace_checkout_preview(p_listing_id);
 if jsonb_array_length(preview->'variations')>0 then
  select (v->>'quantity')::bigint into stock from jsonb_array_elements(preview->'variations') v where v->>'name'=nullif(trim(p_variation),'');
  if not found then raise exception 'Choose an available variation.'; end if;
 elsif nullif(trim(p_variation),'') is not null then raise exception 'This listing has no selectable variations.';
 else stock:=(preview->>'available')::bigint; end if;
 if stock<p_quantity then raise exception 'Not enough stock remains. Refresh the item before ordering.'; end if;
 amount:=(preview->>'unit_price')::numeric; fee:=(preview->>'shipping_fee')::numeric;
 if amount::text in ('NaN','Infinity','-Infinity') or fee::text in ('NaN','Infinity','-Infinity') or amount is null or amount<=0 or amount<>round(amount,2) or fee is null or fee<0 or fee<>round(fee,2)
 or amount*p_quantity+fee>99999999999999.99 or nullif(trim(preview->>'shipping_carrier'),'') is null then raise exception 'The seller needs to update pricing or shipping before purchases are enabled.'; end if;
 select s.details into details from public.marketplace_payment_settings s where seller_id=p.seller_id;
 insert into public.marketplace_orders(request_key,buyer_id,seller_id,product_id,auction_id,title,quantity,variation,unit_price,shipping_fee,total,shipping_carrier,recipient_name,phone,address,payment_details)
 values(p_request_key,auth.uid(),p.seller_id,p.id,a.id::text,p.title,p_quantity,nullif(trim(p_variation),''),amount,fee,amount*p_quantity+fee,preview->>'shipping_carrier',trim(p_recipient_name),trim(p_phone),trim(p_address),details) returning * into o;
 return to_jsonb(o);
end; $$;

create function public.submit_marketplace_payment(p_order_id uuid,p_receipt_id uuid,p_method text,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.marketplace_orders%rowtype; r public.marketplace_payment_receipts%rowtype;
begin
 select * into o from public.marketplace_orders where id=p_order_id and buyer_id=auth.uid() for update;
 if not found then raise exception 'Order not found.'; end if;
 if o.last_receipt_id=p_receipt_id and o.status in ('payment_submitted','paid') then return to_jsonb(o); end if;
 if o.status<>'awaiting_payment' then raise exception 'This order is not accepting another payment receipt.'; end if;
 if p_method is null or p_method not in ('gcash','bank_deposit') or not (o.payment_details ? p_method)
 or length(trim(coalesce(p_reference,''))) not between 1 and 120 then raise exception 'Choose an available payment method and enter its reference.'; end if;
 select * into r from public.marketplace_payment_receipts where id=p_receipt_id and order_id=o.id and buyer_id=auth.uid();
 if not found then raise exception 'Upload your receipt before submitting payment.'; end if;
 update public.marketplace_orders set status='payment_submitted',last_receipt_id=r.id,payment_method=p_method,payment_reference=trim(p_reference),review_note='',updated_at=clock_timestamp() where id=o.id returning * into o;
 return to_jsonb(o);
end; $$;

create function public.review_marketplace_payment(p_order_id uuid,p_receipt_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.marketplace_orders%rowtype; p public.products%rowtype; updated_variations jsonb;
begin
 if auth.uid() is null or not public.is_marketplace_admin() then raise exception 'Administrator selling access required.'; end if;
 if p_decision is null or p_decision not in ('paid','rejected') or length(trim(coalesce(p_note,'')))>500
 or (p_decision='rejected' and length(trim(coalesce(p_note,'')))=0) then raise exception 'Choose a decision and enter a reason for rejection.'; end if;
 select x.* into p from public.products x join public.marketplace_orders y on y.product_id=x.id where y.id=p_order_id for update of x;
 select * into o from public.marketplace_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 if o.status='paid' and p_decision='paid' and o.last_receipt_id=p_receipt_id then return to_jsonb(o); end if;
 if o.status<>'payment_submitted' or o.last_receipt_id is distinct from p_receipt_id or p_receipt_id is null then raise exception 'This payment changed. Refresh before reviewing.'; end if;
 update public.marketplace_orders set status=case when p_decision='paid' then 'paid' else 'awaiting_payment' end,
 review_note=trim(coalesce(p_note,'')),paid_at=case when p_decision='paid' then clock_timestamp() else null end,updated_at=clock_timestamp() where id=o.id;
 if p_decision='paid' then
  if p.deleted_at is not null or p.status<>'active' then raise exception 'This listing is unavailable. Resolve the order with the buyer before confirming payment.'; end if;
  if o.auction_id is not null then
   update public.products set status='sold' where id=p.id;
  else
   if p.listing_type<>'fixed_price' or p.quantity<o.quantity then raise exception 'Stock changed. Resolve this order before confirming payment.'; end if;
   if o.variation is not null then
    if not exists(select 1 from jsonb_array_elements(p.variations) v where v->>'name'=o.variation and (v->>'quantity')::integer>=o.quantity) then raise exception 'Variation stock changed. Resolve this order before confirming payment.'; end if;
    select jsonb_agg(case when v->>'name'=o.variation then jsonb_set(v,'{quantity}',to_jsonb((v->>'quantity')::integer-o.quantity)) else v end order by ord) into updated_variations from jsonb_array_elements(p.variations) with ordinality t(v,ord);
   else updated_variations:=p.variations; end if;
   update public.products set quantity=quantity-o.quantity,variations=updated_variations where id=p.id;
  end if;
 end if;
 insert into public.marketplace_payment_reviews(order_id,receipt_id,reviewer_id,decision,note) values(o.id,p_receipt_id,auth.uid(),p_decision,trim(coalesce(p_note,'')));
 select * into o from public.marketplace_orders where id=o.id;
 return to_jsonb(o);
end; $$;

create function public.cancel_marketplace_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.marketplace_orders%rowtype;
begin
 perform x.id from public.products x join public.marketplace_orders y on y.product_id=x.id where y.id=p_order_id for update of x;
 select * into o from public.marketplace_orders where id=p_order_id for update;
 if auth.uid() is null or not found or (o.buyer_id<>auth.uid() and o.seller_id<>auth.uid() and not public.is_marketplace_admin()) then raise exception 'Order not found.'; end if;
 if o.status='cancelled' then return to_jsonb(o); end if;
 if o.status<>'awaiting_payment' then raise exception 'A submitted or paid order cannot be cancelled here. Contact support.'; end if;
 update public.marketplace_orders set status='cancelled',updated_at=clock_timestamp() where id=o.id returning * into o;
 return to_jsonb(o);
end; $$;

-- Sellers must not reduce offered stock below quantities already reserved.
create function public.guard_marketplace_reserved_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare reserved bigint; v jsonb;
begin
 select coalesce(sum(quantity),0) into reserved from public.marketplace_orders where product_id=new.id and status in ('awaiting_payment','payment_submitted');
 if reserved>0 and (new.listing_type is distinct from old.listing_type or new.price is distinct from old.price
 or new.shipping_fee is distinct from old.shipping_fee or new.shipping_carrier is distinct from old.shipping_carrier
 or new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at) then raise exception 'Open orders exist. Resolve them before changing price, shipping, selling format, availability or deletion.'; end if;
 if new.listing_type='fixed_price' and new.quantity<reserved then raise exception 'Stock is reserved by open orders. Resolve them before reducing quantity.'; end if;
 for v in select value from jsonb_array_elements(old.variations) loop
  select coalesce(sum(o.quantity),0) into reserved from public.marketplace_orders o where o.product_id=new.id and o.variation=v->>'name'
   and o.status in ('awaiting_payment','payment_submitted');
  if reserved>coalesce((select (n->>'quantity')::bigint from jsonb_array_elements(new.variations) n where n->>'name'=v->>'name'),0) then raise exception 'Variation stock is reserved by open orders.'; end if;
 end loop;
 return new;
end; $$;
revoke all on function public.guard_marketplace_reserved_stock() from public,anon,authenticated;
create trigger guard_marketplace_reserved_stock before update of quantity,variations,price,listing_type,shipping_fee,shipping_carrier,status,deleted_at on public.products for each row execute function public.guard_marketplace_reserved_stock();

create function public.marketplace_won_auctions() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from (
 select p.id,p.title,b.amount from public.products p join public.auctions a on a.product_id=p.id
 join lateral (select bidder_id,amount from public.marketplace_bids where auction_id=a.id::text order by amount desc,id desc limit 1) b on true
 where auth.uid() is not null and b.bidder_id=auth.uid() and p.status='active' and p.deleted_at is null
 and a.ends_at<=now() and a.status in ('active','ended')
 and not exists(select 1 from public.marketplace_orders o where o.auction_id=a.id::text)
 and not exists(select 1 from public.auctions newer where newer.product_id=p.id and (newer.created_at,newer.id)>(a.created_at,a.id))
 order by a.ends_at desc limit 25) w;
$$;
revoke all on function public.marketplace_won_auctions() from public,anon;
grant execute on function public.marketplace_won_auctions() to authenticated;

create function public.marketplace_payment_policy() returns text language sql immutable set search_path='' as $$select 'receipt-review-v1'::text$$;
revoke all on function public.set_marketplace_payment_settings(jsonb),public.marketplace_checkout_preview(text),public.create_marketplace_order(text,integer,text,text,text,text,uuid),public.submit_marketplace_payment(uuid,uuid,text,text),public.review_marketplace_payment(uuid,uuid,text,text),public.cancel_marketplace_order(uuid) from public,anon;
grant execute on function public.set_marketplace_payment_settings(jsonb),public.marketplace_checkout_preview(text),public.create_marketplace_order(text,integer,text,text,text,text,uuid),public.submit_marketplace_payment(uuid,uuid,text,text),public.review_marketplace_payment(uuid,uuid,text,text),public.cancel_marketplace_order(uuid) to authenticated;
revoke all on function public.marketplace_payment_policy() from public;
grant execute on function public.marketplace_payment_policy() to anon,authenticated;
notify pgrst,'reload schema';
commit;
