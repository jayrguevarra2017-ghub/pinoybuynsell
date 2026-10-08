begin;
create table public.usa_shopping_requests(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 contact_name text not null check(length(trim(contact_name)) between 1 and 150),
 contact_email text not null check(length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 contact_phone text not null check(length(trim(contact_phone)) between 1 and 40),
 destination text not null check(length(trim(destination)) between 1 and 200),
 item_name text not null check(length(trim(item_name)) between 1 and 200),
 item_url text not null check(length(item_url)<=2000 and item_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/:?#][^[:space:]]*)?$'),
 quantity integer not null check(quantity between 1 and 100),
 item_details text not null check(length(trim(item_details)) between 1 and 3000),
 status text not null default 'new' check(status in ('new','contacted','closed')),
 created_at timestamptz not null default now()
);
create index usa_requests_owner_time on public.usa_shopping_requests(user_id,created_at);
alter table public.usa_shopping_requests enable row level security;
revoke all on public.usa_shopping_requests from public,anon,authenticated;
grant select on public.usa_shopping_requests to authenticated;
grant update(status) on public.usa_shopping_requests to authenticated;
create policy usa_request_reads on public.usa_shopping_requests for select to authenticated
using(user_id=auth.uid() or public.is_marketplace_admin());
create policy usa_request_admin_updates on public.usa_shopping_requests for update to authenticated
using(public.is_marketplace_admin()) with check(public.is_marketplace_admin());
create function public.submit_usa_shopping_request(p_contact_name text,p_contact_email text,p_contact_phone text,p_destination text,p_item_name text,p_item_url text,p_quantity integer,p_item_details text)
returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a request.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.usa_shopping_requests where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then
 raise exception 'You can send up to five requests per day. Please wait before sending another.'; end if;
 insert into public.usa_shopping_requests(user_id,contact_name,contact_email,contact_phone,destination,item_name,item_url,quantity,item_details)
 values(auth.uid(),trim(p_contact_name),trim(p_contact_email),trim(p_contact_phone),trim(p_destination),trim(p_item_name),trim(p_item_url),p_quantity,trim(p_item_details)) returning id into request_id;
 return request_id;
end; $$;
revoke all on function public.submit_usa_shopping_request(text,text,text,text,text,text,integer,text) from public,anon;
grant execute on function public.submit_usa_shopping_request(text,text,text,text,text,text,integer,text) to authenticated;
commit;
