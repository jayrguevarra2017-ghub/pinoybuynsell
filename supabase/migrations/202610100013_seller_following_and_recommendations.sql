begin;

-- Followers are private. Public functions expose counts, never follower identities.
create table public.marketplace_seller_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 seller_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,seller_id),
 check(follower_id<>seller_id)
);
create index marketplace_seller_follows_seller on public.marketplace_seller_follows(seller_id);
alter table public.marketplace_seller_follows enable row level security;
revoke all on public.marketplace_seller_follows from public,anon,authenticated;

create table public.marketplace_seller_recommendations (
 id uuid primary key default gen_random_uuid(),
 reviewer_id uuid not null references auth.users(id) on delete cascade,
 seller_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(length(trim(body)) between 10 and 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(reviewer_id,seller_id),
 check(reviewer_id<>seller_id)
);
create index marketplace_seller_recommendations_seller on public.marketplace_seller_recommendations(seller_id,created_at desc,id);
alter table public.marketplace_seller_recommendations enable row level security;
revoke all on public.marketplace_seller_recommendations from public,anon,authenticated;

-- Only usernames are public; do not return legal names, phone numbers or email.
create function public.marketplace_seller_profile(p_seller_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'username',coalesce(nullif(trim(p.username),''),'Marketplace seller'),
  'location',p.location,
  'active_listing_count',(select count(*) from public.products x where x.seller_id=p.id and x.status='active' and x.deleted_at is null),
  'follower_count',(select count(*) from public.marketplace_seller_follows f where f.seller_id=p.id),
  'recommendation_count',(select count(*) from public.marketplace_seller_recommendations r where r.seller_id=p.id),
  'following',exists(select 1 from public.marketplace_seller_follows f where f.seller_id=p.id and f.follower_id=auth.uid()),
  'can_recommend',auth.uid() is not null and auth.uid()<>p.id and public.is_marketplace_verified(),
  'own_recommendation',(select jsonb_build_object('body',r.body) from public.marketplace_seller_recommendations r where r.seller_id=p.id and r.reviewer_id=auth.uid())
 ) from public.profiles p where p.id=p_seller_id
 and exists(select 1 from public.products x where x.seller_id=p.id and x.status in ('active','sold') and x.deleted_at is null);
$$;

create function public.set_marketplace_seller_follow(p_seller_id uuid,p_follow boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to follow a seller.'; end if;
 if p_seller_id is null or p_seller_id=auth.uid() or p_follow is null then raise exception 'Choose another seller to follow.'; end if;
 if p_follow then
  if public.marketplace_seller_profile(p_seller_id) is null then raise exception 'This seller is unavailable.'; end if;
  insert into public.marketplace_seller_follows(follower_id,seller_id) values(auth.uid(),p_seller_id) on conflict do nothing;
 else
  delete from public.marketplace_seller_follows where follower_id=auth.uid() and seller_id=p_seller_id;
 end if;
 return public.marketplace_seller_profile(p_seller_id);
end; $$;

create function public.marketplace_followed_sellers()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to view followed sellers.'; end if;
 return coalesce((select jsonb_agg(coalesce(public.marketplace_seller_profile(f.seller_id),
  jsonb_build_object('id',f.seller_id,'username','Seller unavailable','following',true)) order by f.created_at desc,f.seller_id)
  from public.marketplace_seller_follows f where f.follower_id=auth.uid()),'[]'::jsonb);
end; $$;

create function public.marketplace_seller_recommendations(p_seller_id uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid recommendation page.'; end if;
 if public.marketplace_seller_profile(p_seller_id) is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from (
  select r.id,r.body,r.created_at,r.updated_at,
   coalesce(nullif(trim(p.username),''),'Marketplace member') as author_name,
   coalesce(r.reviewer_id=auth.uid(),false) as is_own
  from public.marketplace_seller_recommendations r left join public.profiles p on p.id=r.reviewer_id
  where r.seller_id=p_seller_id order by r.created_at desc,r.id limit 21 offset p_offset
 ) r),'[]'::jsonb);
end; $$;

create function public.save_marketplace_seller_recommendation(p_seller_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to recommend a seller.'; end if;
 if p_seller_id is null or p_seller_id=auth.uid() then raise exception 'You cannot recommend yourself.'; end if;
 if not public.is_marketplace_verified() then raise exception 'ID approval is required before recommending a seller.'; end if;
 if public.marketplace_seller_profile(p_seller_id) is null then raise exception 'This seller is unavailable.'; end if;
 p_body := regexp_replace(p_body,'^\s+|\s+$','','g');
 if p_body is null or length(p_body) not between 10 and 1000 then raise exception 'Write a recommendation between 10 and 1000 characters.'; end if;
 insert into public.marketplace_seller_recommendations(reviewer_id,seller_id,body) values(auth.uid(),p_seller_id,p_body)
 on conflict(reviewer_id,seller_id) do update set body=excluded.body,updated_at=clock_timestamp();
 return public.marketplace_seller_profile(p_seller_id);
end; $$;

create function public.delete_marketplace_seller_recommendation(p_seller_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to remove your recommendation.'; end if;
 delete from public.marketplace_seller_recommendations where reviewer_id=auth.uid() and seller_id=p_seller_id;
 return public.marketplace_seller_profile(p_seller_id);
end; $$;

revoke all on function public.marketplace_seller_profile(uuid),public.set_marketplace_seller_follow(uuid,boolean),
 public.marketplace_followed_sellers(),public.marketplace_seller_recommendations(uuid,integer),
 public.save_marketplace_seller_recommendation(uuid,text),public.delete_marketplace_seller_recommendation(uuid)
 from public,anon,authenticated;
grant execute on function public.marketplace_seller_profile(uuid),public.marketplace_seller_recommendations(uuid,integer) to anon,authenticated;
grant execute on function public.set_marketplace_seller_follow(uuid,boolean),public.marketplace_followed_sellers(),
 public.save_marketplace_seller_recommendation(uuid,text),public.delete_marketplace_seller_recommendation(uuid) to authenticated;

commit;
