begin;
create table public.brasa_categories(
 branch_id text not null references public.brasa_branches(id), name text not null check(length(trim(name)) between 1 and 60), primary key(branch_id,name)
);
create table public.brasa_menu_extras(
 branch_id text not null references public.brasa_branches(id), id text not null, name text not null check(length(trim(name)) between 1 and 80),
 price integer not null check(price between 0 and 1000000), active boolean not null default true, primary key(branch_id,id)
);
insert into public.brasa_categories select distinct branch_id,product->>'category' from public.brasa_catalog;
insert into public.brasa_menu_extras(branch_id,id,name,price) select b.id,e.id,e.name,e.price from public.brasa_branches b cross join public.brasa_extras e;
update public.brasa_catalog c set product=product||jsonb_build_object('hidden',false,'extraIds',case when product->>'category' in ('Hamburguesas','Combos') then coalesce((select jsonb_agg(e.id order by e.id) from public.brasa_menu_extras e where e.branch_id=c.branch_id),'[]') else '[]'::jsonb end);
alter table public.brasa_categories enable row level security;
alter table public.brasa_menu_extras enable row level security;
revoke all on public.brasa_categories,public.brasa_menu_extras from anon,authenticated;
grant select on public.brasa_categories,public.brasa_menu_extras to anon,authenticated;
grant all on public.brasa_categories,public.brasa_menu_extras to service_role;
create policy categories_read on public.brasa_categories for select using(true);
create policy menu_extras_read on public.brasa_menu_extras for select using(true);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('brasa-menu','brasa-menu',true,1048576,array['image/jpeg','image/png','image/webp']);
create policy menu_photos_read on storage.objects for select using(bucket_id='brasa-menu');
create policy menu_photos_upload on storage.objects for insert to authenticated with check(bucket_id='brasa-menu' and public.brasa_is_staff((storage.foldername(name))[1]));
create policy menu_photos_delete on storage.objects for delete to authenticated using(bucket_id='brasa-menu' and public.brasa_is_staff((storage.foldername(name))[1]));

create function public.brasa_manage_menu(p_branch text,p_kind text,p_doc jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_id text; v_name text; v_price integer; v_image text; v_extras jsonb; v_product jsonb;
begin
 if not public.brasa_is_staff(p_branch) then raise exception 'Sin permisos para administrar este local.'; end if;
 perform 1 from public.brasa_branches where id=p_branch for update;
 if jsonb_typeof(p_doc) is distinct from 'object' then raise exception 'Datos del menú inválidos.'; end if;
 v_id:=p_doc->>'id'; v_name:=trim(p_doc->>'name');
 if p_kind='category' then
  if v_name is null or length(v_name) not between 1 and 60 then raise exception 'La categoría debe tener entre 1 y 60 caracteres.'; end if;
  if p_doc->>'action'='delete' then
   if exists(select 1 from public.brasa_catalog where branch_id=p_branch and product->>'category'=v_name) then raise exception 'Mueve los productos a otra categoría antes de eliminarla.'; end if;
   delete from public.brasa_categories where branch_id=p_branch and name=v_name;
  elsif coalesce(p_doc->>'oldName','')<>'' and p_doc->>'oldName'<>v_name then
   update public.brasa_categories set name=v_name where branch_id=p_branch and name=p_doc->>'oldName';
   if not found then raise exception 'La categoría ya no existe.'; end if;
   update public.brasa_catalog set product=jsonb_set(product,'{category}',to_jsonb(v_name)) where branch_id=p_branch and product->>'category'=p_doc->>'oldName';
  else insert into public.brasa_categories values(p_branch,v_name) on conflict do nothing;
  end if;
 elsif p_kind='extra' then
  if v_id is null or v_id !~ '^[a-zA-Z0-9_-]{1,80}$' or v_name is null or length(v_name) not between 1 and 80
  or coalesce(p_doc->>'price','') !~ '^[0-9]{1,7}$' or jsonb_typeof(p_doc->'active') is distinct from 'boolean' then raise exception 'Revisa el nombre y el precio del extra.'; end if;
  v_price:=(p_doc->>'price')::integer;
  if v_price>1000000 then raise exception 'El precio del extra supera el máximo.'; end if;
  insert into public.brasa_menu_extras(branch_id,id,name,price,active) values(p_branch,v_id,v_name,v_price,(p_doc->>'active')::boolean)
  on conflict(branch_id,id) do update set name=excluded.name,price=excluded.price,active=excluded.active;
 elsif p_kind='product' then
  if v_id is null or v_id !~ '^[a-zA-Z0-9_-]{1,80}$' or v_name is null or length(v_name) not between 1 and 80
  or coalesce(p_doc->>'price','') !~ '^[0-9]{1,7}$' or length(coalesce(p_doc->>'description',''))>500 or length(coalesce(p_doc->>'badge',''))>30
  or jsonb_typeof(p_doc->'available') is distinct from 'boolean' or jsonb_typeof(p_doc->'hidden') is distinct from 'boolean' then raise exception 'Revisa los datos y el precio del producto.'; end if;
  v_price:=(p_doc->>'price')::integer;
  if v_price>1000000 then raise exception 'El precio del producto supera el máximo.'; end if;
  if not exists(select 1 from public.brasa_categories where branch_id=p_branch and name=p_doc->>'category') then raise exception 'Selecciona una categoría del local.'; end if;
  v_extras:=coalesce(p_doc->'extraIds','[]'::jsonb);
  if jsonb_typeof(v_extras) is distinct from 'array' or jsonb_array_length(v_extras)>20 then raise exception 'Selecciona hasta 20 extras.'; end if;
  if exists(select 1 from jsonb_array_elements_text(v_extras) e where not exists(select 1 from public.brasa_menu_extras where branch_id=p_branch and id=e)) then raise exception 'Un extra no pertenece a este local.'; end if;
  v_image:=coalesce(p_doc->>'image','');
  if v_image<>'' and v_image !~ '^photo-[a-zA-Z0-9-]+$' then
   if left(v_image,5)<>'menu:' or split_part(substr(v_image,6),'/',1)<>p_branch or not exists(select 1 from storage.objects where bucket_id='brasa-menu' and name=substr(v_image,6)) then raise exception 'La foto no pertenece a este local.'; end if;
  end if;
  v_product:=jsonb_build_object('id',v_id,'name',v_name,'price',v_price,'category',p_doc->>'category','description',trim(coalesce(p_doc->>'description','')),'badge',trim(coalesce(p_doc->>'badge','')),'image',v_image,'extraIds',v_extras,'available',(p_doc->>'available')::boolean,'hidden',(p_doc->>'hidden')::boolean);
  insert into public.brasa_catalog(branch_id,id,product) values(p_branch,v_id,v_product) on conflict(branch_id,id) do update set product=excluded.product;
  update public.brasa_branches set unavailable=array_remove(unavailable,v_id) where id=p_branch;
 else raise exception 'Operación de menú no válida.';
 end if;
end $$;
revoke all on function public.brasa_manage_menu(text,text,jsonb) from public,anon;
grant execute on function public.brasa_manage_menu(text,text,jsonb) to authenticated;
create or replace function public.brasa_create_order(
 p_id uuid,p_branch text,p_name text,p_phone text,p_note text,p_method text,
 p_items jsonb,p_receipt text,p_receipt_name text,p_expected_total integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 b public.brasa_branches%rowtype; old public.brasa_orders%rowtype;
 line jsonb; prod jsonb; option_id text; option_row public.brasa_menu_extras%rowtype;
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
  if not found or coalesce((prod->>'available')::boolean,false)=false or coalesce((prod->>'hidden')::boolean,false) or (line->>'productId')=any(b.unavailable) then
   raise exception 'Un producto se agotó. Revisa el carrito.';
  end if;
  if coalesce(line->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Cantidad inválida.'; end if;
  if line ? 'note' and (jsonb_typeof(line->'note')<>'string' or length(line->>'note')>300) then raise exception 'Las indicaciones del producto deben ser texto de hasta 300 caracteres.'; end if;
  count:=(line->>'quantity')::integer;
  if count not between 1 and 20 then raise exception 'Cantidad inválida.'; end if;
  options:=coalesce(line->'extras','[]');
  if jsonb_typeof(options)<>'array' or jsonb_array_length(options)>20 then raise exception 'Extras inválidos.'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(options))<>jsonb_array_length(options) then raise exception 'Extras duplicados.'; end if;
  if exists(select 1 from jsonb_array_elements_text(options) opt where not coalesce(prod->'extraIds','[]'::jsonb) ? opt) then raise exception 'Este producto no admite esos extras.'; end if;
  amount:=(prod->>'price')::integer; extra_details:='[]';
  for option_id in select jsonb_array_elements_text(options) loop
   select * into option_row from public.brasa_menu_extras where id=option_id and branch_id=p_branch and active for share;
   if not found then raise exception 'Extra inválido.'; end if;
   amount:=amount+option_row.price;
   extra_details:=extra_details||jsonb_build_array(jsonb_build_object('id',option_row.id,'name',option_row.name,'price',option_row.price));
  end loop;
  total:=total+amount*count;
  items:=items || jsonb_build_array(jsonb_build_object('key',concat(line->>'productId',options::text,':',trim(coalesce(line->>'note',''))),'note',trim(coalesce(line->>'note','')),'product',prod,'quantity',count,'extras',options,'unitPrice',amount,'extraDetails',extra_details));
 end loop;
 if total is distinct from p_expected_total then raise exception 'Los precios cambiaron. Revisa el menú antes de confirmar.'; end if;
 doc:=jsonb_build_object('id',p_id,'branchId',p_branch,'createdAt',now_text,'name',trim(p_name),'phone',p_phone,'note',coalesce(p_note,''),'items',items,'total',total,'method',p_method,
  'payment',case when p_method='transfer' then 'review' else 'paid' end,'status','pending',
  'history',jsonb_build_array(jsonb_build_object('at',now_text,'text',case when p_method='transfer' then 'Comprobante recibido. Esperando revisión del local.' else 'Pago de prueba confirmado.' end)));
 if p_method='transfer' then doc:=doc||jsonb_build_object('receipt',p_receipt,'receiptName',left(p_receipt_name,200)); end if;
 insert into public.brasa_orders(id,branch_id,customer_id,payload) values(p_id,p_branch,auth.uid(),doc);
 return doc||jsonb_build_object('version',1);
end $$;


commit;
