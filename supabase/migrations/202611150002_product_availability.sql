begin;
create function public.brasa_set_product_available(p_branch text,p_product text,p_available boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin','menu']) then raise exception 'Sin permisos para editar el menú de este local.'; end if;
 if p_available is null then raise exception 'Disponibilidad inválida.'; end if;
 update public.brasa_catalog set product=jsonb_set(product,'{available}',to_jsonb(p_available)) where branch_id=p_branch and id=p_product;
 if not found then raise exception 'El producto ya no existe en este local.'; end if;
 update public.brasa_branches set unavailable=array_remove(unavailable,p_product) where id=p_branch;
end $$;
revoke all on function public.brasa_set_product_available(text,text,boolean) from public,anon;
grant execute on function public.brasa_set_product_available(text,text,boolean) to authenticated;
commit;
