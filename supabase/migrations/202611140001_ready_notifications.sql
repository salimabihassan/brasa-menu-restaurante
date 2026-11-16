begin;
create table public.brasa_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth_key text not null, created_at timestamptz not null default now()
);
create table public.brasa_ready_push_jobs (
 order_id uuid primary key references public.brasa_orders(id) on delete cascade,
 branch_id text not null references public.brasa_branches(id), customer_id uuid not null references auth.users(id),
 state text not null default 'pending' check(state in ('pending','processing','sent','skipped','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), lease_until timestamptz, lease_id uuid,
 last_error text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index brasa_ready_push_pending on public.brasa_ready_push_jobs(state,available_at);
create table public.brasa_push_deliveries (
 order_id uuid not null references public.brasa_orders(id) on delete cascade,
 subscription_id uuid not null references public.brasa_push_subscriptions(id) on delete cascade,
 state text not null check(state in ('sent','failed')), status_code integer, updated_at timestamptz not null default now(),
 primary key(order_id,subscription_id)
);
alter table public.brasa_push_subscriptions enable row level security;
alter table public.brasa_ready_push_jobs enable row level security;
alter table public.brasa_push_deliveries enable row level security;
revoke all on public.brasa_push_subscriptions,public.brasa_ready_push_jobs,public.brasa_push_deliveries from anon,authenticated;
grant select,delete on public.brasa_push_subscriptions to authenticated;
grant select on public.brasa_ready_push_jobs to authenticated;
grant all on public.brasa_push_subscriptions,public.brasa_ready_push_jobs,public.brasa_push_deliveries to service_role;
create policy subscriptions_own on public.brasa_push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy subscriptions_remove_own on public.brasa_push_subscriptions for delete to authenticated using(user_id=auth.uid());
create policy ready_jobs_staff on public.brasa_ready_push_jobs for select to authenticated using(public.brasa_is_staff(branch_id));

create function public.brasa_save_push_subscription(p_endpoint text,p_p256dh text,p_auth text)
returns uuid language plpgsql security definer set search_path='' as $$
declare subscription_id uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión antes de activar los avisos.'; end if;
 if p_endpoint is null or length(p_endpoint)>4096
 or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$'
 or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$'
 or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'La suscripción de notificaciones no es válida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if not exists(select 1 from public.brasa_push_subscriptions where endpoint=p_endpoint)
 and (select count(*) from public.brasa_push_subscriptions where user_id=auth.uid())>=10 then
  raise exception 'Se alcanzó el límite de dispositivos.';
 end if;
 insert into public.brasa_push_subscriptions(user_id,endpoint,p256dh,auth_key) values(auth.uid(),p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth_key=excluded.auth_key
 where public.brasa_push_subscriptions.user_id=auth.uid()
 or (public.brasa_push_subscriptions.p256dh=p_p256dh and public.brasa_push_subscriptions.auth_key=p_auth)
 returning id into subscription_id;
 if subscription_id is null then raise exception 'La suscripción pertenece a otro dispositivo.'; end if;
 return subscription_id;
end $$;
revoke all on function public.brasa_save_push_subscription(text,text,text) from public,anon;
grant execute on function public.brasa_save_push_subscription(text,text,text) to authenticated;

create function public.brasa_queue_ready_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.payload->>'status'='ready' and old.payload->>'status' is distinct from 'ready' then
  insert into public.brasa_ready_push_jobs(order_id,branch_id,customer_id) values(new.id,new.branch_id,new.customer_id) on conflict(order_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.brasa_queue_ready_push() from public,anon,authenticated;
create trigger brasa_order_ready_push after update of payload on public.brasa_orders for each row execute function public.brasa_queue_ready_push();

create function public.brasa_claim_ready_push(p_id uuid) returns setof public.brasa_ready_push_jobs
language sql security definer set search_path='' as $$
 update public.brasa_ready_push_jobs set state='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 where order_id=p_id and state in ('pending','failed','processing') and attempts<8 and available_at<=now()
 and (lease_until is null or lease_until<now()) returning *
$$;
revoke all on function public.brasa_claim_ready_push(uuid) from public,anon,authenticated;
grant execute on function public.brasa_claim_ready_push(uuid) to service_role;
commit;
