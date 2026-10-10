begin;

-- Liker identities are private; public access is only through aggregate RPCs.
create table public.marketplace_listing_likes (
 user_id uuid not null references auth.users(id) on delete cascade,
 listing_id bigint not null references public.products(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,listing_id)
);
create index marketplace_listing_likes_listing on public.marketplace_listing_likes(listing_id);
alter table public.marketplace_listing_likes enable row level security;
revoke all on public.marketplace_listing_likes from public,anon,authenticated;

create function public.marketplace_listing_like_counts(p_listing_ids bigint[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_listing_ids is null or cardinality(p_listing_ids)>100
 or exists(select 1 from unnest(p_listing_ids) x where x is null or x<=0)
 then raise exception 'Invalid listing selection.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.listing_id) from (
  select p.id::text as listing_id,count(l.user_id) as like_count,
   coalesce(bool_or(l.user_id=auth.uid()),false) as liked
  from public.products p left join public.marketplace_listing_likes l on l.listing_id=p.id
  where p.id=any(p_listing_ids) and p.status in ('active','sold') and p.deleted_at is null
  group by p.id
 ) r),'[]'::jsonb);
end; $$;

create function public.set_marketplace_listing_like(p_listing_id bigint,p_like boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to like an item.'; end if;
 if p_listing_id is null or p_listing_id<=0 or p_like is null then raise exception 'Invalid like request.'; end if;
 if p_like then
  -- Hold visibility stable until the like is committed.
  perform 1 from public.products p where p.id=p_listing_id and p.status in ('active','sold') and p.deleted_at is null for share;
  if not found then raise exception 'This listing is unavailable.'; end if;
  insert into public.marketplace_listing_likes(user_id,listing_id) values(auth.uid(),p_listing_id) on conflict do nothing;
 else
  delete from public.marketplace_listing_likes where user_id=auth.uid() and listing_id=p_listing_id;
 end if;
 result:=public.marketplace_listing_like_counts(array[p_listing_id]);
 return result->0;
end; $$;

revoke all on function public.marketplace_listing_like_counts(bigint[]),public.set_marketplace_listing_like(bigint,boolean) from public,anon,authenticated;
grant execute on function public.marketplace_listing_like_counts(bigint[]) to anon,authenticated;
grant execute on function public.set_marketplace_listing_like(bigint,boolean) to authenticated;

commit;
