begin;

-- Public totals only. Browser tokens are hashed separately for each item/day;
-- no account IDs, IP addresses, or viewing histories are exposed.
create table public.marketplace_listing_view_totals (
 listing_id bigint primary key references public.products(id) on delete cascade,
 view_count bigint not null default 0 check(view_count>=0)
);
create table public.marketplace_listing_view_days (
 listing_id bigint not null references public.products(id) on delete cascade,
 day date not null,
 visitor_hash text not null,
 primary key(listing_id,day,visitor_hash)
);
alter table public.marketplace_listing_view_totals enable row level security;
alter table public.marketplace_listing_view_days enable row level security;
revoke all on public.marketplace_listing_view_totals,public.marketplace_listing_view_days from public,anon,authenticated;

create function public.marketplace_listing_view_counts(p_listing_ids bigint[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_listing_ids is null or cardinality(p_listing_ids)>100
 or exists(select 1 from unnest(p_listing_ids) x where x is null or x<=0)
 then raise exception 'Invalid listing selection.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.listing_id) from (
  select p.id::text as listing_id,coalesce(v.view_count,0)::text as view_count
  from public.products p left join public.marketplace_listing_view_totals v on v.listing_id=p.id
  where p.id=any(p_listing_ids) and p.status in ('active','sold') and p.deleted_at is null
 ) r),'[]'::jsonb);
end; $$;

create function public.record_marketplace_listing_view(p_listing_id bigint,p_visitor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Manila')::date; inserted integer; total bigint;
begin
 if p_listing_id is null or p_listing_id<=0 or p_visitor is null then raise exception 'Invalid listing view.'; end if;
 -- Hold visibility stable while recording. Closed public listings can still be viewed.
 perform 1 from public.products p where p.id=p_listing_id and p.status in ('active','sold') and p.deleted_at is null for share;
 if not found then raise exception 'This listing is unavailable.'; end if;
 insert into public.marketplace_listing_view_days(listing_id,day,visitor_hash)
 values(p_listing_id,today,md5(p_visitor::text||':'||p_listing_id::text||':'||today::text)) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted>0 then
  insert into public.marketplace_listing_view_totals(listing_id,view_count) values(p_listing_id,1)
  on conflict(listing_id) do update set view_count=public.marketplace_listing_view_totals.view_count+1
  returning view_count into total;
  -- Keep only recent deduplication records for this item. Lifetime totals remain.
  delete from public.marketplace_listing_view_days where listing_id=p_listing_id and day<today-30;
 else
  select view_count into total from public.marketplace_listing_view_totals where listing_id=p_listing_id;
 end if;
 return jsonb_build_object('listing_id',p_listing_id::text,'view_count',coalesce(total,0)::text);
end; $$;

revoke all on function public.marketplace_listing_view_counts(bigint[]),public.record_marketplace_listing_view(bigint,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_listing_view_counts(bigint[]),public.record_marketplace_listing_view(bigint,uuid) to anon,authenticated;

commit;
