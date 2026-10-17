-- Link relists without deleting originals, bids, orders, photos or Page posts.
-- Run after the existing listing/options/gallery and payment migrations.
begin;

alter table public.products
 add column if not exists relisted_from_id bigint unique references public.products(id),
 add column if not exists relisted_to_id bigint references public.products(id);
create index if not exists products_relisted_to on public.products(relisted_to_id) where relisted_to_id is not null;
grant insert(relisted_from_id) on public.products to authenticated;

create or replace function public.protect_listing_relist_fields()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' and new.relisted_to_id is not null then
  raise exception 'New listings cannot already have a replacement.';
 end if;
 if tg_op='UPDATE' and current_user in ('anon','authenticated') then
  if new.relisted_from_id is distinct from old.relisted_from_id
     or new.relisted_to_id is distinct from old.relisted_to_id then
   raise exception 'Relisting links are managed automatically.' using errcode='42501';
  end if;
  if old.relisted_to_id is not null then
   raise exception 'This item has already been relisted. Edit its replacement listing.';
  end if;
 end if;
 return new;
end; $$;

create or replace function public.validate_listing_relist_source()
returns trigger language plpgsql security definer set search_path='' as $$
declare source public.products%rowtype; a public.auctions%rowtype; closed boolean;
begin
 if new.relisted_from_id is null then return new; end if;
 if auth.uid() is null or not public.is_marketplace_admin() or new.seller_id is distinct from auth.uid() then
  raise exception 'Administrator ownership is required to relist.' using errcode='42501';
 end if;
 -- Product then auction, matching bid/payment lock order. Concurrent attempts
 -- serialize here and cannot create two replacements for the same source.
 select * into source from public.products where id=new.relisted_from_id for update;
 if not found or source.id=new.id or source.seller_id is distinct from auth.uid() or source.deleted_at is not null then
  raise exception 'Choose one of your available ended listings.';
 end if;
 if source.relisted_to_id is not null then raise exception 'This item has already been relisted.'; end if;
 closed:=source.status='sold' or (source.status='active' and source.listing_type='fixed_price' and source.quantity=0);
 if source.status='active' and source.listing_type='auction' then
  select * into a from public.auctions where product_id=source.id order by created_at desc,id desc limit 1 for update;
  closed:=case when a.id is not null then a.status<>'active' or a.ends_at<=clock_timestamp()
   else source.auction_ends_at<=clock_timestamp() end;
 end if;
 if closed is not true then raise exception 'Only ended, sold or out-of-stock listings can be relisted.'; end if;
 return new;
end; $$;

create or replace function public.link_listing_relist_source()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.relisted_from_id is not null then
  update public.products set relisted_to_id=new.id where id=new.relisted_from_id and relisted_to_id is null;
  if not found then raise exception 'This item has already been relisted.'; end if;
 end if;
 return new;
end; $$;

revoke all on function public.protect_listing_relist_fields(),public.validate_listing_relist_source(),public.link_listing_relist_source() from public,anon,authenticated;
drop trigger if exists protect_listing_relist_fields on public.products;
create trigger protect_listing_relist_fields before insert or update on public.products for each row execute function public.protect_listing_relist_fields();
drop trigger if exists validate_listing_relist_source on public.products;
create trigger validate_listing_relist_source before insert on public.products for each row execute function public.validate_listing_relist_source();
drop trigger if exists link_listing_relist_source on public.products;
create trigger link_listing_relist_source after insert on public.products for each row execute function public.link_listing_relist_source();

-- Older versions did not record which source was used. Retire a previous row
-- only when a later listing reuses that owner's exact uploaded cover, title,
-- category and format, and the old item was closed before the newer creation.
-- Multiple old copies can point to the same current listing. We do not invent
-- an exact historical relisted_from_id, or merge bids/orders between copies.
update public.products source set relisted_to_id=(
 select target.id from public.products target
 where target.seller_id=source.seller_id and target.image_path=source.image_path
  and lower(trim(target.title))=lower(trim(source.title))
  and target.category is not distinct from source.category
  and target.listing_type=source.listing_type and target.deleted_at is null
  and target.status in ('active','sold') and target.relisted_to_id is null
  and target.created_at>source.created_at
  and case when source.listing_type='auction' then
   coalesce((select a.ends_at from public.auctions a where a.product_id=source.id order by a.created_at desc,a.id desc limit 1),source.auction_ends_at)<=target.created_at
   else source.updated_at<=target.created_at and (source.status='sold' or source.quantity=0) end
 order by target.created_at desc,target.id desc limit 1
)
where source.relisted_to_id is null and source.deleted_at is null
 and source.status in ('active','sold') and source.image_path is not null
 and exists(select 1 from public.products target
  where target.seller_id=source.seller_id and target.image_path=source.image_path
   and lower(trim(target.title))=lower(trim(source.title))
   and target.category is not distinct from source.category and target.listing_type=source.listing_type
   and target.deleted_at is null and target.status in ('active','sold') and target.relisted_to_id is null
   and target.created_at>source.created_at
   and case when source.listing_type='auction' then
    coalesce((select a.ends_at from public.auctions a where a.product_id=source.id order by a.created_at desc,a.id desc limit 1),source.auction_ends_at)<=target.created_at
    else source.updated_at<=target.created_at and (source.status='sold' or source.quantity=0) end);

notify pgrst,'reload schema';
commit;
