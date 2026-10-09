begin;

-- Keep image_path as the cover for existing cards, Facebook posts and previews.
alter table public.products add column image_paths text[] not null default '{}';
grant insert(image_paths), update(image_paths) on public.products to authenticated;

create function public.valid_listing_gallery(paths text[], owner_id uuid, cover text)
returns boolean language sql immutable set search_path='' as $$
 select case when cardinality(paths)=0 then true
 else cardinality(paths) between 1 and 8
   and array_ndims(paths)=1 and array_lower(paths,1)=1
   and owner_id is not null and cover is not null and paths[1]=cover
   and (select count(distinct path)=cardinality(paths)
     and bool_and(path is not null
       and path like owner_id::text || '/%'
       and path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
     from unnest(paths) as path)
 end;
$$;

alter table public.products add constraint listing_gallery_valid
check (public.valid_listing_gallery(image_paths,seller_id,image_path));

create trigger require_gallery_listing_policy before update of image_paths
on public.products for each row execute function public.require_listing_policy();

commit;
