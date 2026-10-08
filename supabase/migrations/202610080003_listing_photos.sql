begin;
alter table public.products add column image_path text;
alter table public.products add constraint listing_photo_owner_path check (
  image_path is null or (
    seller_id is not null and image_path like seller_id::text || '/%'
    and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  )
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('listing-photos','listing-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy listing_photos_upload on storage.objects for insert to authenticated
with check (bucket_id='listing-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy listing_photos_own_read on storage.objects for select to authenticated
using (bucket_id='listing-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy listing_photos_cleanup on storage.objects for delete to authenticated
using (bucket_id='listing-photos' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
