begin;

create table public.facebook_listing_posts (
 listing_id text primary key,
 owner_id uuid not null references auth.users(id),
 page_id text not null check(page_id ~ '^[0-9]+$'),
 status text not null check(status in ('processing','published','failed','uncertain')),
 claim_token uuid not null default gen_random_uuid(),
 post_id text check(post_id ~ '^[0-9]+(_[0-9]+)?$'),
 message text not null default '',
 attempts integer not null default 1,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.facebook_listing_posts enable row level security;
revoke all on public.facebook_listing_posts from public,anon,authenticated;
grant select on public.facebook_listing_posts to authenticated;
grant all on public.facebook_listing_posts to service_role;
create policy own_admin_facebook_reads on public.facebook_listing_posts for select to authenticated
using(owner_id=auth.uid() and public.is_marketplace_admin());

create function public.claim_facebook_listing_post(p_listing_id text,p_user_id uuid,p_page_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.products%rowtype; job public.facebook_listing_posts%rowtype;
begin
 if not exists(select 1 from public.marketplace_admins where user_id=p_user_id) then
  raise exception 'Administrator access required.';
 end if;
 if p_page_id is null or p_page_id !~ '^[0-9]+$' then raise exception 'Invalid Page ID.'; end if;
 select * into p from public.products where id::text=p_listing_id for update;
 if not found or p.seller_id is distinct from p_user_id or p.deleted_at is not null or p.status is distinct from 'active' then
  raise exception 'Only your own active listings can be posted.';
 end if;
 select * into job from public.facebook_listing_posts where listing_id=p_listing_id for update;
 if found then
  -- A server crash may happen after Meta publishes. Never silently reclaim that job.
  if job.status='processing' and job.updated_at < clock_timestamp()-interval '2 minutes' then
   update public.facebook_listing_posts set status='uncertain',message='Check Facebook before retrying; the post may already exist.',updated_at=clock_timestamp()
   where listing_id=p_listing_id returning * into job;
  end if;
  if job.status<>'failed' or job.updated_at>clock_timestamp()-interval '1 minute' then
   return jsonb_build_object('status',job.status,'post_id',job.post_id);
  end if;
 end if;
 insert into public.facebook_listing_posts(listing_id,owner_id,page_id,status)
 values(p_listing_id,p_user_id,p_page_id,'processing')
 on conflict(listing_id) do update set status='processing',claim_token=gen_random_uuid(),
  page_id=excluded.page_id,attempts=facebook_listing_posts.attempts+1,message='',updated_at=clock_timestamp()
 returning * into job;
 return jsonb_build_object('status','processing','claim_token',job.claim_token,'product',to_jsonb(p));
end; $$;

create function public.finish_facebook_listing_post(p_listing_id text,p_claim_token uuid,p_status text,p_post_id text,p_message text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_status is null or p_status not in ('published','failed','uncertain') then raise exception 'Invalid post result.'; end if;
 if p_status='published' and (p_post_id is null or p_post_id !~ '^[0-9]+(_[0-9]+)?$') then raise exception 'Post ID required.'; end if;
 update public.facebook_listing_posts set status=p_status,post_id=p_post_id,
  message=left(coalesce(p_message,''),500),updated_at=clock_timestamp()
 where listing_id=p_listing_id and claim_token=p_claim_token and status in ('processing','uncertain');
 return found;
end; $$;

revoke all on function public.claim_facebook_listing_post(text,uuid,text),public.finish_facebook_listing_post(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_facebook_listing_post(text,uuid,text),public.finish_facebook_listing_post(text,uuid,text,text,text) to service_role;
commit;
