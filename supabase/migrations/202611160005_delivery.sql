begin;
create table public.brasa_delivery_settings(
 branch_id text primary key references public.brasa_branches(id),enabled boolean not null default false,
 origin_address text not null default '',price_per_km integer not null default 0 check(price_per_km between 0 and 1000000),
 maximum_km numeric(8,3) not null default 5 check(maximum_km>0 and maximum_km<=200),version integer not null default 1,
 updated_at timestamptz not null default now(),check(length(origin_address)<=250)
);
create table public.brasa_delivery_quotes(
 id uuid primary key default gen_random_uuid(),branch_id text not null references public.brasa_branches(id),customer_id uuid not null references auth.users(id) on delete cascade,
 settings_version integer not null,address text not null,commune text not null,distance_meters integer not null check(distance_meters>=0),duration_seconds integer not null check(duration_seconds>=0),
 fee integer not null check(fee>=0),price_per_km integer not null,maximum_km numeric(8,3) not null,origin_address text not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes',used_order_id uuid references public.brasa_orders(id) on delete set null
);
create index brasa_delivery_quote_owner on public.brasa_delivery_quotes(customer_id,branch_id,expires_at);
create table public.brasa_delivery_quote_requests(id uuid primary key default gen_random_uuid(),customer_id uuid not null references auth.users(id) on delete cascade,branch_id text not null references public.brasa_branches(id),created_at timestamptz not null default now());
create index brasa_delivery_request_limits on public.brasa_delivery_quote_requests(branch_id,created_at);
alter table public.brasa_delivery_settings enable row level security;
alter table public.brasa_delivery_quotes enable row level security;
alter table public.brasa_delivery_quote_requests enable row level security;
revoke all on public.brasa_delivery_settings,public.brasa_delivery_quotes,public.brasa_delivery_quote_requests from anon,authenticated;
grant select on public.brasa_delivery_settings to anon,authenticated;
grant select on public.brasa_delivery_quotes to authenticated;
grant all on public.brasa_delivery_settings,public.brasa_delivery_quotes,public.brasa_delivery_quote_requests to service_role;
create policy delivery_settings_read on public.brasa_delivery_settings for select using(enabled or public.brasa_has_role(branch_id,array['admin']));
create policy delivery_quotes_own on public.brasa_delivery_quotes for select to authenticated using(customer_id=auth.uid());
create function public.brasa_save_delivery_settings(p_branch text,p_settings jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_address text;v_price integer;v_max numeric;v_enabled boolean;
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin']) then raise exception 'Solo el administrador puede configurar el delivery.'; end if;
 if jsonb_typeof(p_settings) is distinct from 'object' or jsonb_typeof(p_settings->'enabled') is distinct from 'boolean' then raise exception 'Configuración de delivery inválida.'; end if;
 v_address:=trim(coalesce(p_settings->>'origin_address',''));v_enabled:=(p_settings->>'enabled')::boolean;
 if length(v_address)>250 or (v_enabled and length(v_address)<8) then raise exception 'Escribe la dirección de origen del local, incluyendo comuna y ciudad.'; end if;
 if coalesce(p_settings->>'price_per_km','') !~ '^[0-9]{1,7}$' then raise exception 'El precio por kilómetro debe estar en pesos enteros.'; end if;
 v_price:=(p_settings->>'price_per_km')::integer;
 if v_price>1000000 then raise exception 'El precio por kilómetro supera el máximo permitido.'; end if;
 if coalesce(p_settings->>'maximum_km','') !~ '^[0-9]{1,3}(\.[0-9]{1,3})?$' then raise exception 'Revisa el alcance máximo en kilómetros.'; end if;
 v_max:=(p_settings->>'maximum_km')::numeric;
 if v_max<=0 or v_max>200 then raise exception 'El alcance debe ser mayor que cero y de hasta 200 km.'; end if;
 insert into public.brasa_delivery_settings(branch_id,enabled,origin_address,price_per_km,maximum_km) values(p_branch,v_enabled,v_address,v_price,v_max)
 on conflict(branch_id) do update set enabled=excluded.enabled,origin_address=excluded.origin_address,price_per_km=excluded.price_per_km,maximum_km=excluded.maximum_km,version=public.brasa_delivery_settings.version+1,updated_at=now();
end $$;
revoke all on function public.brasa_save_delivery_settings(text,jsonb) from public,anon;
grant execute on function public.brasa_save_delivery_settings(text,jsonb) to authenticated;
create function public.brasa_reserve_delivery_request(p_user uuid,p_branch text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_branch||':delivery-quotes',0));
 delete from public.brasa_delivery_quote_requests where branch_id=p_branch and created_at<now()-interval '1 day';
 if (select count(*) from public.brasa_delivery_quote_requests where customer_id=p_user and created_at>now()-interval '1 minute')>=6 or
 (select count(*) from public.brasa_delivery_quote_requests where branch_id=p_branch and created_at>now()-interval '1 minute')>=30 then raise exception 'Espera un minuto antes de volver a calcular el delivery.'; end if;
 insert into public.brasa_delivery_quote_requests(customer_id,branch_id) values(p_user,p_branch);
end $$;
revoke all on function public.brasa_reserve_delivery_request(uuid,text) from public,anon,authenticated;
grant execute on function public.brasa_reserve_delivery_request(uuid,text) to service_role;
create function public.brasa_store_delivery_quote(p_user uuid,p_branch text,p_version integer,p_address text,p_commune text,p_meters integer,p_seconds integer) returns public.brasa_delivery_quotes language plpgsql security definer set search_path='' as $$
declare config public.brasa_delivery_settings%rowtype;quote public.brasa_delivery_quotes%rowtype;
begin
 select * into config from public.brasa_delivery_settings where branch_id=p_branch for share;
 if not found or not config.enabled then raise exception 'El local no tiene delivery habilitado.'; end if;
 if config.version<>p_version then raise exception 'La tarifa de delivery cambió. Vuelve a calcular.'; end if;
 if p_address is null or length(trim(p_address)) not between 5 and 200 or p_commune is null or length(trim(p_commune)) not between 2 and 80 then raise exception 'Revisa la dirección y la comuna de entrega.'; end if;
 if p_meters is null or p_meters<0 or p_seconds is null or p_seconds<0 then raise exception 'No se pudo validar la ruta de entrega.'; end if;
 if p_meters::numeric>config.maximum_km*1000 then raise exception 'La dirección está fuera de la zona de delivery del local.'; end if;
 insert into public.brasa_delivery_quotes(branch_id,customer_id,settings_version,address,commune,distance_meters,duration_seconds,fee,price_per_km,maximum_km,origin_address)
 values(p_branch,p_user,config.version,trim(p_address),trim(p_commune),p_meters,p_seconds,round(p_meters::numeric/1000*config.price_per_km)::integer,config.price_per_km,config.maximum_km,config.origin_address) returning * into quote;
 return quote;
end $$;
revoke all on function public.brasa_store_delivery_quote(uuid,text,integer,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.brasa_store_delivery_quote(uuid,text,integer,text,text,integer,integer) to service_role;
create function public.brasa_place_order(p_id uuid,p_branch text,p_name text,p_phone text,p_note text,p_method text,p_items jsonb,p_receipt text,p_receipt_name text,p_expected_total integer,p_fulfillment text,p_quote uuid,p_delivery_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.brasa_orders%rowtype;quote public.brasa_delivery_quotes%rowtype;config public.brasa_delivery_settings%rowtype;doc jsonb;fee integer:=0;subtotal integer;
begin
 if auth.uid() is null then raise exception 'Inicia una sesión para realizar el pedido.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.brasa_orders where id=p_id;
 if found then if old.customer_id<>auth.uid() then raise exception 'Pedido no disponible.';end if;return old.payload||jsonb_build_object('version',old.version);end if;
 if p_fulfillment is null or p_fulfillment not in ('pickup','delivery') then raise exception 'Selecciona retiro o delivery.'; end if;
 if length(coalesce(p_delivery_note,''))>300 then raise exception 'Las indicaciones de entrega superan 300 caracteres.'; end if;
 if p_fulfillment='delivery' then
  select * into config from public.brasa_delivery_settings where branch_id=p_branch for share;
  if not found or not config.enabled then raise exception 'El local no tiene delivery habilitado.'; end if;
  select * into quote from public.brasa_delivery_quotes where id=p_quote for update;
  if not found or quote.customer_id<>auth.uid() or quote.branch_id<>p_branch then raise exception 'Calcula el delivery para tu dirección antes de pagar.'; end if;
  if quote.expires_at<=now() or quote.used_order_id is not null or quote.settings_version<>config.version then raise exception 'El cálculo de delivery venció o cambió la tarifa. Vuelve a calcular antes de pagar.'; end if;
  fee:=quote.fee;
 elsif p_quote is not null then raise exception 'El retiro no debe incluir un cálculo de delivery.';
 end if;
 if p_expected_total is null or p_expected_total<fee then raise exception 'El total del pedido no es válido.'; end if;
 subtotal:=p_expected_total-fee;
 doc:=public.brasa_create_order(p_id,p_branch,p_name,p_phone,p_note,p_method,p_items,p_receipt,p_receipt_name,subtotal);
 doc:=doc||jsonb_build_object('fulfillment',p_fulfillment,'subtotal',subtotal,'deliveryFee',fee,'total',subtotal+fee);
 if p_fulfillment='delivery' then
  doc:=doc||jsonb_build_object('delivery',jsonb_build_object('address',quote.address,'commune',quote.commune,'instructions',trim(coalesce(p_delivery_note,'')),'distanceMeters',quote.distance_meters,'distanceKm',quote.distance_meters::numeric/1000,'durationSeconds',quote.duration_seconds,'fee',fee,'pricePerKm',quote.price_per_km,'originAddress',quote.origin_address));
  update public.brasa_delivery_quotes set used_order_id=p_id where id=p_quote;
 end if;
 update public.brasa_orders set payload=doc-'version' where id=p_id;
 return doc;
end $$;
revoke all on function public.brasa_place_order(uuid,text,text,text,text,text,jsonb,text,text,integer,text,uuid,text) from public,anon;
grant execute on function public.brasa_place_order(uuid,text,text,text,text,text,jsonb,text,text,integer,text,uuid,text) to authenticated;

create or replace function public.brasa_staff_action(p_id uuid,p_version integer,p_action text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.brasa_orders%rowtype; doc jsonb; message text;
begin
 select * into o from public.brasa_orders where id=p_id for update;
 if not found or not public.brasa_has_role(o.branch_id,array['admin','local']) then raise exception 'Sin permiso para gestionar este pedido.'; end if;
 if o.version is distinct from p_version then raise exception 'El pedido cambió. Actualiza el panel y vuelve a intentarlo.'; end if;
 doc:=o.payload;
 if doc->>'status' in ('delivered','cancelled') then raise exception 'El pedido ya está cerrado.'; end if;
 if p_action='approve' and doc->>'payment'='review' then
  doc:=doc||'{"payment":"paid"}';message:='Transferencia aprobada por el local.';
 elsif p_action='reject' and doc->>'payment'='review' and length(trim(p_reason)) between 2 and 300 then
  doc:=doc||jsonb_build_object('payment','rejected','reason',trim(p_reason));message:='Comprobante rechazado: '||trim(p_reason);
 elsif p_action='cancelled' and length(trim(p_reason)) between 2 and 300 then
  doc:=doc||jsonb_build_object('status','cancelled','reason',trim(p_reason));message:='Pedido cancelado: '||trim(p_reason)||case when doc->>'payment'='paid' then '. Requiere devolución manual.' else '' end;
 elsif doc->>'payment'='paid' and (
  (p_action='preparing' and doc->>'status'='pending') or
  (p_action='ready' and doc->>'status'='preparing') or
  (p_action='out_for_delivery' and doc->>'status'='ready' and doc->>'fulfillment'='delivery') or
  (p_action='delivered' and ((doc->>'status'='ready' and coalesce(doc->>'fulfillment','pickup')='pickup') or (doc->>'status'='out_for_delivery' and doc->>'fulfillment'='delivery')))) then
  doc:=doc||jsonb_build_object('status',p_action);
  message:=case p_action when 'preparing' then 'En preparación' when 'ready' then case when doc->>'fulfillment'='delivery' then 'Listo para despacho' else 'Listo para retirar' end when 'out_for_delivery' then 'En reparto' else 'Entregado' end;
 else raise exception 'Acción no permitida para el estado actual.';
 end if;
 doc:=doc||jsonb_build_object('history',(doc->'history')||jsonb_build_array(jsonb_build_object('at',now(),'text',message,'actor',auth.uid())));
 update public.brasa_orders set payload=doc,version=version+1 where id=p_id;
 return doc||jsonb_build_object('version',o.version+1);
end $$;



create or replace function public.brasa_queue_ready_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if ((new.payload->>'status'='ready' and coalesce(new.payload->>'fulfillment','pickup')='pickup') or (new.payload->>'status'='out_for_delivery' and new.payload->>'fulfillment'='delivery')) and old.payload->>'status' is distinct from new.payload->>'status' then
  insert into public.brasa_ready_push_jobs(order_id,branch_id,customer_id) values(new.id,new.branch_id,new.customer_id) on conflict(order_id) do nothing;
 end if;
 return new;
end $$;
commit;
