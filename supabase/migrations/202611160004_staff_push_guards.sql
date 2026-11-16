begin;
create or replace function public.brasa_save_staff_push(p_branch text,p_endpoint text,p_p256dh text,p_auth text) returns uuid
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
 if (select count(*) from public.brasa_staff_push_subscriptions where user_id=auth.uid() and endpoint<>p_endpoint)>=10 or (select count(*) from public.brasa_staff_push_subscriptions where branch_id=p_branch and endpoint<>p_endpoint)>=50 then raise exception 'Se alcanzó el límite de teléfonos con avisos.'; end if;
 insert into public.brasa_staff_push_subscriptions(user_id,session_id,branch_id,endpoint,p256dh,auth_key) values(auth.uid(),v_session,p_branch,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set user_id=excluded.user_id,session_id=excluded.session_id,branch_id=excluded.branch_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key
 where public.brasa_staff_push_subscriptions.user_id=auth.uid() or (public.brasa_staff_push_subscriptions.p256dh=p_p256dh and public.brasa_staff_push_subscriptions.auth_key=p_auth)
 returning id into v_id;
 if v_id is null then raise exception 'La suscripción pertenece a otro dispositivo.'; end if;
 return v_id;
end $$;
create or replace function public.brasa_queue_staff_push() returns trigger language plpgsql security definer set search_path='' as $$
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
commit;
