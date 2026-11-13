-- BRASA demo backend. Run once in a NEW Supabase project.
begin;
create table public.brasa_branches (
 id text primary key, name text not null, paused boolean not null default false,
 unavailable text[] not null default '{}', demo_payments boolean not null default true
);
create table public.brasa_memberships (
 user_id uuid not null references auth.users(id) on delete cascade,
 branch_id text not null references public.brasa_branches(id),
 primary key(user_id,branch_id)
);
create table public.brasa_catalog (
 branch_id text not null references public.brasa_branches(id),
 id text not null, product jsonb not null,
 primary key(branch_id,id), check ((product->>'price')::integer >= 0)
);
create table public.brasa_extras (
 id text primary key, name text not null, price integer not null check(price >= 0)
);
create table public.brasa_orders (
 id uuid primary key, branch_id text not null references public.brasa_branches(id),
 customer_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 version integer not null default 1, payload jsonb not null
);
create index brasa_orders_branch_date on public.brasa_orders(branch_id,created_at desc);
create index brasa_orders_customer on public.brasa_orders(customer_id);

create function public.brasa_is_staff(p_branch text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.brasa_memberships where user_id=auth.uid() and branch_id=p_branch)
$$;
revoke all on function public.brasa_is_staff(text) from public;
grant execute on function public.brasa_is_staff(text) to anon, authenticated;

alter table public.brasa_branches enable row level security;
alter table public.brasa_memberships enable row level security;
alter table public.brasa_catalog enable row level security;
alter table public.brasa_extras enable row level security;
alter table public.brasa_orders enable row level security;
revoke all on public.brasa_branches,public.brasa_memberships,public.brasa_catalog,public.brasa_extras,public.brasa_orders from anon,authenticated;
grant select on public.brasa_branches,public.brasa_catalog,public.brasa_extras to anon,authenticated;
grant select on public.brasa_memberships,public.brasa_orders to authenticated;
create policy branches_read on public.brasa_branches for select using(true);
create policy catalog_read on public.brasa_catalog for select using(true);
create policy extras_read on public.brasa_extras for select using(true);
create policy membership_read on public.brasa_memberships for select to authenticated using(user_id=auth.uid());
create policy orders_read on public.brasa_orders for select to authenticated
 using(customer_id=auth.uid() or public.brasa_is_staff(branch_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('brasa-receipts','brasa-receipts',false,1048576,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy brasa_receipts_upload on storage.objects for insert to authenticated
 with check(bucket_id='brasa-receipts' and (storage.foldername(name))[1]=auth.uid()::text);
create policy brasa_receipts_read on storage.objects for select to authenticated
 using(bucket_id='brasa-receipts' and (
  (storage.foldername(name))[1]=auth.uid()::text or exists(
   select 1 from public.brasa_orders o where o.payload->>'receipt'=name and public.brasa_is_staff(o.branch_id)
  )
 ));

create function public.brasa_check_receipt(p_id uuid,p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>p_id::text
 or not exists(select 1 from storage.objects where bucket_id='brasa-receipts' and name=p_path) then
  raise exception 'Adjunta un comprobante válido antes de enviar el pedido.';
 end if;
end $$;
revoke all on function public.brasa_check_receipt(uuid,text) from public,anon,authenticated;

create function public.brasa_create_order(
 p_id uuid,p_branch text,p_name text,p_phone text,p_note text,p_method text,
 p_items jsonb,p_receipt text,p_receipt_name text,p_expected_total integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 b public.brasa_branches%rowtype; old public.brasa_orders%rowtype;
 line jsonb; prod jsonb; option_id text; option_row public.brasa_extras%rowtype;
 count integer; amount integer; total integer:=0; items jsonb:='[]'; options jsonb; extra_details jsonb;
 doc jsonb; now_text text:=to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if auth.uid() is null then raise exception 'Inicia una sesión para realizar el pedido.'; end if;
 -- Lock by id even when no row exists, for simultaneous idempotent retries.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.brasa_orders where id=p_id;
 if found then
  if old.customer_id<>auth.uid() then raise exception 'Pedido no disponible.'; end if;
  return old.payload || jsonb_build_object('version',old.version);
 end if;
 select * into b from public.brasa_branches where id=p_branch for share;
 if not found or b.paused then raise exception 'El local no está recibiendo pedidos.'; end if;
 if length(trim(p_name)) not between 2 and 80 or p_name is null
 or p_phone is null or p_phone !~ '^[+0-9 ()-]{8,20}$' or length(coalesce(p_note,''))>300 then
  raise exception 'Revisa el nombre, teléfono y observación.';
 end if;
 if p_method is null or p_method not in ('transfer','card') then raise exception 'Medio de pago inválido.'; end if;
 if p_method='card' and not b.demo_payments then raise exception 'El pago de prueba está deshabilitado.'; end if;
 if p_method='transfer' then perform public.brasa_check_receipt(p_id,p_receipt); end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
  raise exception 'El carrito está vacío o excede el límite.';
 end if;
 for line in select value from jsonb_array_elements(p_items) loop
  select product into prod from public.brasa_catalog where branch_id=p_branch and id=line->>'productId' for share;
  if not found or coalesce((prod->>'available')::boolean,false)=false or (line->>'productId')=any(b.unavailable) then
   raise exception 'Un producto se agotó. Revisa el carrito.';
  end if;
  if coalesce(line->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Cantidad inválida.'; end if;
  count:=(line->>'quantity')::integer;
  if count not between 1 and 20 then raise exception 'Cantidad inválida.'; end if;
  options:=coalesce(line->'extras','[]');
  if jsonb_typeof(options)<>'array' or jsonb_array_length(options)>3 then raise exception 'Extras inválidos.'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(options))<>jsonb_array_length(options) then raise exception 'Extras duplicados.'; end if;
  if jsonb_array_length(options)>0 and prod->>'category' not in ('Hamburguesas','Combos') then raise exception 'Este producto no admite extras.'; end if;
  amount:=(prod->>'price')::integer; extra_details:='[]';
  for option_id in select jsonb_array_elements_text(options) loop
   select * into option_row from public.brasa_extras where id=option_id for share;
   if not found then raise exception 'Extra inválido.'; end if;
   amount:=amount+option_row.price;
   extra_details:=extra_details||jsonb_build_array(jsonb_build_object('id',option_row.id,'name',option_row.name,'price',option_row.price));
  end loop;
  total:=total+amount*count;
  items:=items || jsonb_build_array(jsonb_build_object('key',line->>'productId'||options::text,'product',prod,'quantity',count,'extras',options,'unitPrice',amount,'extraDetails',extra_details));
 end loop;
 if total is distinct from p_expected_total then raise exception 'Los precios cambiaron. Revisa el menú antes de confirmar.'; end if;
 doc:=jsonb_build_object('id',p_id,'branchId',p_branch,'createdAt',now_text,'name',trim(p_name),'phone',p_phone,'note',coalesce(p_note,''),'items',items,'total',total,'method',p_method,
  'payment',case when p_method='transfer' then 'review' else 'paid' end,'status','pending',
  'history',jsonb_build_array(jsonb_build_object('at',now_text,'text',case when p_method='transfer' then 'Comprobante recibido. Esperando revisión del local.' else 'Pago de prueba confirmado.' end)));
 if p_method='transfer' then doc:=doc||jsonb_build_object('receipt',p_receipt,'receiptName',left(p_receipt_name,200)); end if;
 insert into public.brasa_orders(id,branch_id,customer_id,payload) values(p_id,p_branch,auth.uid(),doc);
 return doc||jsonb_build_object('version',1);
end $$;

create function public.brasa_staff_action(p_id uuid,p_version integer,p_action text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.brasa_orders%rowtype; doc jsonb; message text;
begin
 select * into o from public.brasa_orders where id=p_id for update;
 if not found or not public.brasa_is_staff(o.branch_id) then raise exception 'Sin permiso para gestionar este pedido.'; end if;
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
  (p_action='delivered' and doc->>'status'='ready')) then
  doc:=doc||jsonb_build_object('status',p_action);
  message:=case p_action when 'preparing' then 'En preparación' when 'ready' then 'Listo para retirar' else 'Entregado' end;
 else raise exception 'Acción no permitida para el estado actual.';
 end if;
 doc:=doc||jsonb_build_object('history',(doc->'history')||jsonb_build_array(jsonb_build_object('at',now(),'text',message,'actor',auth.uid())));
 update public.brasa_orders set payload=doc,version=version+1 where id=p_id;
 return doc||jsonb_build_object('version',o.version+1);
end $$;

create function public.brasa_resubmit_receipt(p_id uuid,p_version integer,p_path text,p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.brasa_orders%rowtype; doc jsonb;
begin
 select * into o from public.brasa_orders where id=p_id for update;
 if not found or o.customer_id is distinct from auth.uid() then raise exception 'Sin acceso al pedido.'; end if;
 if o.version is distinct from p_version or o.payload->>'payment'<>'rejected' or o.payload->>'status'<>'pending' then
  raise exception 'El pedido cambió o no permite otro comprobante.';
 end if;
 perform public.brasa_check_receipt(p_id,p_path);
 doc:=o.payload||jsonb_build_object('receipt',p_path,'receiptName',left(p_name,200),'payment','review','reason','',
  'history',(o.payload->'history')||jsonb_build_array(jsonb_build_object('at',now(),'text','Nuevo comprobante recibido. Pendiente de revisión.')));
 update public.brasa_orders set payload=doc,version=version+1 where id=p_id;
 return doc||jsonb_build_object('version',o.version+1);
end $$;

create function public.brasa_set_settings(p_branch text,p_paused boolean,p_unavailable text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.brasa_is_staff(p_branch) then raise exception 'Sin permisos para este local.'; end if;
 if p_paused is null or p_unavailable is null then raise exception 'Configuración inválida.'; end if;
 if exists(select 1 from unnest(p_unavailable) as u(product_id) where not exists(select 1 from public.brasa_catalog c where c.branch_id=p_branch and c.id=u.product_id)) then
  raise exception 'Producto inválido.';
 end if;
 update public.brasa_branches set paused=p_paused,unavailable=p_unavailable where id=p_branch;
end $$;

revoke all on function public.brasa_create_order(uuid,text,text,text,text,text,jsonb,text,text,integer) from public,anon;
revoke all on function public.brasa_staff_action(uuid,integer,text,text) from public,anon;
revoke all on function public.brasa_resubmit_receipt(uuid,integer,text,text) from public,anon;
revoke all on function public.brasa_set_settings(text,boolean,text[]) from public,anon;
grant execute on function public.brasa_create_order(uuid,text,text,text,text,text,jsonb,text,text,integer) to authenticated;
grant execute on function public.brasa_staff_action(uuid,integer,text,text) to authenticated;
grant execute on function public.brasa_resubmit_receipt(uuid,integer,text,text) to authenticated;
grant execute on function public.brasa_set_settings(text,boolean,text[]) to authenticated;
commit;
