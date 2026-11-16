-- Use branch-scoped extras when checking current order prices.
begin;
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
