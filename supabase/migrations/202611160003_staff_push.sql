begin;
create table public.brasa_staff_push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 branch_id text not null references public.brasa_branches(id),endpoint text not null unique,p256dh text not null,auth_key text not null,
 created_at timestamptz not null default now()
);
create table public.brasa_staff_push_jobs(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.brasa_orders(id) on delete cascade,
 branch_id text not null references public.brasa_branches(id),event text not null check(event in ('new_order','receipt_resubmitted')),
 event_key text not null,order_version integer not null,
 state text not null default 'pending' check(state in ('pending','processing','sent','skipped','failed')),
 attempts integer not null default 0,available_at timestamptz not null default now(),lease_until timestamptz,lease_id uuid,
 last_error text,created_at timestamptz not null default now(),completed_at timestamptz,unique(order_id,event_key)
);
create index brasa_staff_push_pending on public.brasa_staff_push_jobs(state,available_at);
create table public.brasa_staff_push_deliveries(
 job_id uuid not null references public.brasa_staff_push_jobs(id) on delete cascade,
 subscription_id uuid not null references public.brasa_staff_push_subscriptions(id) on delete cascade,
 state text not null check(state in ('sent','failed')),status_code integer,updated_at timestamptz not null default now(),primary key(job_id,subscription_id)
);
alter table public.brasa_staff_push_subscriptions enable row level security;
alter table public.brasa_staff_push_jobs enable row level security;
alter table public.brasa_staff_push_deliveries enable row level security;
revoke all on public.brasa_staff_push_subscriptions,public.brasa_staff_push_jobs,public.brasa_staff_push_deliveries from anon,authenticated;
grant all on public.brasa_staff_push_subscriptions,public.brasa_staff_push_jobs,public.brasa_staff_push_deliveries to service_role;
grant select,delete on public.brasa_staff_push_subscriptions to authenticated;
grant select on public.brasa_staff_push_jobs to authenticated;
create policy staff_push_own on public.brasa_staff_push_subscriptions for select to authenticated using(user_id=auth.uid() and public.brasa_has_role(branch_id,array['admin','local']));
create policy staff_push_remove_own on public.brasa_staff_push_subscriptions for delete to authenticated using(user_id=auth.uid());
create policy staff_push_jobs_read on public.brasa_staff_push_jobs for select to authenticated using(public.brasa_has_role(branch_id,array['admin','local']));
create function public.brasa_save_staff_push(p_branch text,p_endpoint text,p_p256dh text,p_auth text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_session uuid;
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin','local']) then raise exception 'Solo el personal que gestiona pedidos puede activar estos avisos.'; end if;
 v_session:=nullif(auth.jwt()->>'session_id','')::uuid;
 if v_session is null or not exists(select 1 from auth.sessions where id=v_session and user_id=auth.uid()) then raise exception 'Vuelve a iniciar sesión para activar los avisos.'; end if;
 if p_endpoint is null or length(p_endpoint)>4096 or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$'
 or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'La suscripción del teléfono no es válida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2));
 if not exists(select 1 from public.brasa_staff_push_subscriptions where endpoint=p_endpoint)
 and ((select count(*) from public.brasa_staff_push_subscriptions where user_id=auth.uid())>=10 or (select count(*) from public.brasa_staff_push_subscriptions where branch_id=p_branch)>=50) then raise exception 'Se alcanzó el límite de teléfonos con avisos.'; end if;
 insert into public.brasa_staff_push_subscriptions(user_id,session_id,branch_id,endpoint,p256dh,auth_key) values(auth.uid(),v_session,p_branch,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set user_id=excluded.user_id,session_id=excluded.session_id,branch_id=excluded.branch_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key
 where public.brasa_staff_push_subscriptions.user_id=auth.uid() or (public.brasa_staff_push_subscriptions.p256dh=p_p256dh and public.brasa_staff_push_subscriptions.auth_key=p_auth)
 returning id into v_id;
 if v_id is null then raise exception 'La suscripción pertenece a otro dispositivo.'; end if;
 return v_id;
end $$;
revoke all on function public.brasa_save_staff_push(text,text,text,text) from public,anon;
grant execute on function public.brasa_save_staff_push(text,text,text,text) to authenticated;

create function public.brasa_queue_staff_push() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event text;v_key text;
begin
 if new.payload->>'status' is distinct from 'pending' then return new; end if;
 if ((new.payload->>'method'='card' and new.payload->>'payment'='paid') or
 (new.payload->>'method'='transfer' and new.payload->>'payment'='review' and exists(select 1 from storage.objects where bucket_id='brasa-receipts' and name=new.payload->>'receipt'))) is not true then return new; end if;
 if tg_op='INSERT' then v_event:='new_order';v_key:='new_order';
 elsif new.payload->>'method'='transfer' and new.payload->>'payment'='review' and (old.payload->>'payment' is distinct from 'review' or old.payload->>'receipt' is distinct from new.payload->>'receipt') then v_event:='receipt_resubmitted';v_key:='receipt:'||new.version::text;
 else return new; end if;
 insert into public.brasa_staff_push_jobs(order_id,branch_id,event,event_key,order_version) values(new.id,new.branch_id,v_event,v_key,new.version) on conflict(order_id,event_key) do nothing;
 return new;
end $$;
revoke all on function public.brasa_queue_staff_push() from public,anon,authenticated;
create trigger brasa_order_staff_push after insert or update of payload on public.brasa_orders for each row execute function public.brasa_queue_staff_push();
create function public.brasa_claim_staff_push(p_id uuid) returns setof public.brasa_staff_push_jobs language sql security definer set search_path='' as $$
 update public.brasa_staff_push_jobs set state='processing',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 where id=p_id and state in ('pending','failed','processing') and attempts<8 and available_at<=now() and (lease_until is null or lease_until<now()) returning *
$$;
revoke all on function public.brasa_claim_staff_push(uuid) from public,anon,authenticated;
grant execute on function public.brasa_claim_staff_push(uuid) to service_role;
create function public.brasa_staff_push_recipients(p_branch text) returns table(id uuid,endpoint text,p256dh text,auth_key text)
language sql stable security definer set search_path='' as $$
 select s.id,s.endpoint,s.p256dh,s.auth_key from public.brasa_staff_push_subscriptions s
 join public.brasa_memberships m on m.user_id=s.user_id and m.branch_id=s.branch_id
 join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 where s.branch_id=p_branch and m.active and m.role in ('admin','local')
$$;
revoke all on function public.brasa_staff_push_recipients(text) from public,anon,authenticated;
grant execute on function public.brasa_staff_push_recipients(text) to service_role;
commit;
