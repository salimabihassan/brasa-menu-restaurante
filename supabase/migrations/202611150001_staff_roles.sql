begin;
alter table public.brasa_memberships add column role text not null default 'local' check(role in ('admin','menu','local'));
alter table public.brasa_memberships add column active boolean not null default true;
alter table public.brasa_memberships add column display_name text not null default '' check(length(display_name)<=80);
-- Existing accounts retain access; the current local account becomes administrator.
update public.brasa_memberships set role='admin';
create or replace function public.brasa_is_staff(p_branch text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.brasa_memberships where user_id=auth.uid() and branch_id=p_branch and active)
$$;
create function public.brasa_has_role(p_branch text,p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.brasa_memberships where user_id=auth.uid() and branch_id=p_branch and active and role=any(p_roles))
$$;
revoke all on function public.brasa_has_role(text,text[]) from public;
grant execute on function public.brasa_has_role(text,text[]) to anon,authenticated;
drop policy orders_read on public.brasa_orders;
create policy orders_read on public.brasa_orders for select to authenticated using(customer_id=auth.uid() or public.brasa_has_role(branch_id,array['admin','local']));
drop policy brasa_receipts_read on storage.objects;
create policy brasa_receipts_read on storage.objects for select to authenticated using(bucket_id='brasa-receipts' and (
 (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.brasa_orders o where o.payload->>'receipt'=name and public.brasa_has_role(o.branch_id,array['admin','local']))));
drop policy menu_photos_upload on storage.objects;
drop policy menu_photos_delete on storage.objects;
create policy menu_photos_upload on storage.objects for insert to authenticated with check(bucket_id='brasa-menu' and public.brasa_has_role((storage.foldername(name))[1],array['admin','menu']));
create policy menu_photos_delete on storage.objects for delete to authenticated using(bucket_id='brasa-menu' and public.brasa_has_role((storage.foldername(name))[1],array['admin','menu']));
drop policy ready_jobs_staff on public.brasa_ready_push_jobs;
create policy ready_jobs_staff on public.brasa_ready_push_jobs for select to authenticated using(public.brasa_has_role(branch_id,array['admin','local']));

create function public.brasa_list_staff(p_branch text) returns table(user_id uuid,email text,display_name text,role text,active boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not public.brasa_has_role(p_branch,array['admin']) then raise exception 'Solo el administrador puede consultar usuarios.'; end if;
 return query select m.user_id,u.email::text,m.display_name,m.role,m.active from public.brasa_memberships m join auth.users u on u.id=m.user_id where m.branch_id=p_branch order by m.display_name,u.email;
end $$;
revoke all on function public.brasa_list_staff(text) from public,anon;
grant execute on function public.brasa_list_staff(text) to authenticated;

create function public.brasa_update_staff(p_branch text,p_user uuid,p_role text,p_active boolean,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.brasa_memberships%rowtype;
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin']) then raise exception 'Solo el administrador puede cambiar permisos.'; end if;
 if p_role is null or p_role not in ('admin','menu','local') or p_active is null or length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Revisa el nombre y el nivel de acceso.'; end if;
 select * into previous from public.brasa_memberships where branch_id=p_branch and user_id=p_user;
 if not found then raise exception 'El usuario no pertenece a esta sucursal.'; end if;
 if p_user=auth.uid() and (p_role<>'admin' or not p_active) then raise exception 'No puedes quitarte el acceso de administrador ni desactivar tu propia cuenta.'; end if;
 if previous.role='admin' and previous.active and (p_role<>'admin' or not p_active)
 and (select count(*) from public.brasa_memberships where branch_id=p_branch and role='admin' and active)<=1 then raise exception 'Debe quedar al menos un administrador activo.'; end if;
 update public.brasa_memberships set role=p_role,active=p_active,display_name=trim(p_name) where branch_id=p_branch and user_id=p_user;
end $$;
revoke all on function public.brasa_update_staff(text,uuid,text,boolean,text) from public,anon;
grant execute on function public.brasa_update_staff(text,uuid,text,boolean,text) to authenticated;

-- Only the server can link a freshly created Auth account to a branch.
create function public.brasa_add_staff(p_requester uuid,p_branch text,p_user uuid,p_role text,p_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not exists(select 1 from public.brasa_memberships where user_id=p_requester and branch_id=p_branch and role='admin' and active) then raise exception 'Solo el administrador puede crear usuarios.'; end if;
 if p_user is null or p_user=p_requester or p_role is null or p_role not in ('admin','menu','local') or length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Datos de usuario inválidos.'; end if;
 if exists(select 1 from public.brasa_memberships where user_id=p_user) then raise exception 'La cuenta ya tiene acceso asignado.'; end if;
 if (select count(*) from public.brasa_memberships where branch_id=p_branch)>=50 then raise exception 'Se alcanzó el límite de 50 usuarios de esta sucursal.'; end if;
 insert into public.brasa_memberships(user_id,branch_id,role,active,display_name) values(p_user,p_branch,p_role,true,trim(p_name));
end $$;
revoke all on function public.brasa_add_staff(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.brasa_add_staff(uuid,text,uuid,text,text) to service_role;

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
  (p_action='delivered' and doc->>'status'='ready')) then
  doc:=doc||jsonb_build_object('status',p_action);
  message:=case p_action when 'preparing' then 'En preparación' when 'ready' then 'Listo para retirar' else 'Entregado' end;
 else raise exception 'Acción no permitida para el estado actual.';
 end if;
 doc:=doc||jsonb_build_object('history',(doc->'history')||jsonb_build_array(jsonb_build_object('at',now(),'text',message,'actor',auth.uid())));
 update public.brasa_orders set payload=doc,version=version+1 where id=p_id;
 return doc||jsonb_build_object('version',o.version+1);
end $$;


create or replace function public.brasa_set_settings(p_branch text,p_paused boolean,p_unavailable text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.brasa_has_role(p_branch,array['admin','local']) then raise exception 'Sin permisos para este local.'; end if;
 if p_paused is null or p_unavailable is null then raise exception 'Configuración inválida.'; end if;
 if exists(select 1 from unnest(p_unavailable) as u(product_id) where not exists(select 1 from public.brasa_catalog c where c.branch_id=p_branch and c.id=u.product_id)) then
  raise exception 'Producto inválido.';
 end if;
 update public.brasa_branches set paused=p_paused,unavailable=p_unavailable where id=p_branch;
end $$;


create or replace function public.brasa_manage_menu(p_branch text,p_kind text,p_doc jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_id text; v_name text; v_price integer; v_image text; v_extras jsonb; v_product jsonb;
begin
 if not public.brasa_has_role(p_branch,array['admin','menu']) then raise exception 'Sin permisos para administrar este local.'; end if;
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

commit;
