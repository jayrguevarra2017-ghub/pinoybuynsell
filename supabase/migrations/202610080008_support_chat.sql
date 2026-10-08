begin;
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 contact_name text not null check(length(trim(contact_name)) between 1 and 150),
 contact_email text not null check(length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 status text not null default 'open' check(status in ('open','closed')),created_at timestamptz not null default now()
);
create table public.support_messages(
 id bigint generated always as identity primary key,ticket_id uuid not null references public.support_tickets(id),
 sender_id uuid not null references auth.users(id),sender_role text not null check(sender_role in ('customer','support')),
 body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now()
);
create index support_ticket_owner on public.support_tickets(user_id,created_at);
create index support_message_thread on public.support_messages(ticket_id,id);
create index support_message_rate on public.support_messages(sender_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets,public.support_messages from public,anon,authenticated;
grant select on public.support_tickets,public.support_messages to authenticated;
grant update(status) on public.support_tickets to authenticated;
create policy support_ticket_reads on public.support_tickets for select to authenticated using(user_id=auth.uid() or public.is_marketplace_admin());
create policy support_message_reads on public.support_messages for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_marketplace_admin())));
create policy support_admin_status on public.support_tickets for update to authenticated using(public.is_marketplace_admin()) with check(public.is_marketplace_admin());
create function public.start_support_chat(p_name text,p_email text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to contact support.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
 if (select count(*) from public.support_tickets where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then raise exception 'Please wait before starting another conversation.'; end if;
 insert into public.support_tickets(user_id,contact_name,contact_email) values(auth.uid(),trim(p_name),trim(p_email)) returning id into new_id;
 insert into public.support_messages(ticket_id,sender_id,sender_role,body) values(new_id,auth.uid(),'customer',trim(p_body));
 return new_id;
end; $$;
create function public.send_support_message(p_ticket_id uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare t public.support_tickets%rowtype; admin boolean:=public.is_marketplace_admin();
begin
 if auth.uid() is null then raise exception 'Sign in to send a message.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
 select * into t from public.support_tickets where id=p_ticket_id for update;
 if not found or (t.user_id<>auth.uid() and not admin) then raise exception 'Conversation unavailable.'; end if;
 if t.status<>'open' then raise exception 'This conversation has been closed.'; end if;
 if (select count(*) from public.support_messages where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before sending more messages.'; end if;
 insert into public.support_messages(ticket_id,sender_id,sender_role,body)
 values(t.id,auth.uid(),case when admin and t.user_id<>auth.uid() then 'support' else 'customer' end,trim(p_body));
end; $$;
revoke all on function public.start_support_chat(text,text,text),public.send_support_message(uuid,text) from public,anon;
grant execute on function public.start_support_chat(text,text,text),public.send_support_message(uuid,text) to authenticated;
commit;
