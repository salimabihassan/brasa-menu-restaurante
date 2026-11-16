begin;
create table public.brasa_bank_details(
 branch_id text primary key references public.brasa_branches(id),
 bank text not null default '',account_type text not null default '',account_number text not null default '',
 holder text not null default '',rut text not null default '',email text not null default '',
 enabled boolean not null default false,updated_at timestamptz not null default now(),
 check(length(bank)<=80 and length(account_type)<=40 and length(account_number)<=30 and length(holder)<=120 and length(rut)<=20 and length(email)<=254)
);
alter table public.brasa_bank_details enable row level security;
revoke all on public.brasa_bank_details from anon,authenticated;
grant select on public.brasa_bank_details to anon,authenticated;
grant all on public.brasa_bank_details to service_role;
create policy bank_details_read on public.brasa_bank_details for select using(enabled or public.brasa_has_role(branch_id,array['admin']));
create function public.brasa_save_bank_details(p_branch text,p_details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_bank text;v_type text;v_number text;v_holder text;v_rut text;v_email text;v_enabled boolean;
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin']) then raise exception 'Solo el administrador puede cambiar los datos de transferencia.'; end if;
 if jsonb_typeof(p_details) is distinct from 'object' or jsonb_typeof(p_details->'enabled') is distinct from 'boolean' then raise exception 'Datos de transferencia inválidos.'; end if;
 v_bank:=trim(coalesce(p_details->>'bank',''));v_type:=trim(coalesce(p_details->>'account_type',''));v_number:=trim(coalesce(p_details->>'account_number',''));
 v_holder:=trim(coalesce(p_details->>'holder',''));v_rut:=upper(regexp_replace(coalesce(p_details->>'rut',''),'[.[:space:]]','','g'));v_email:=lower(trim(coalesce(p_details->>'email','')));v_enabled:=(p_details->>'enabled')::boolean;
 if length(v_bank)>80 or length(v_type)>40 or length(v_number)>30 or length(v_holder)>120 or length(v_rut)>20 or length(v_email)>254 then raise exception 'Uno de los datos de transferencia es demasiado largo.'; end if;
 if v_enabled and (length(v_bank)<2 or v_type not in ('Cuenta corriente','Cuenta vista','Cuenta de ahorro','Cuenta RUT') or v_number !~ '^[0-9]{1,30}$' or length(v_holder)<2 or v_rut !~ '^[0-9]{1,8}-[0-9K]$') then raise exception 'Revisa banco, tipo de cuenta, número, titular y formato del RUT.'; end if;
 if v_email<>'' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisa el correo de confirmación.'; end if;
 insert into public.brasa_bank_details(branch_id,bank,account_type,account_number,holder,rut,email,enabled)
 values(p_branch,v_bank,v_type,v_number,v_holder,v_rut,v_email,v_enabled)
 on conflict(branch_id) do update set bank=excluded.bank,account_type=excluded.account_type,account_number=excluded.account_number,holder=excluded.holder,rut=excluded.rut,email=excluded.email,enabled=excluded.enabled,updated_at=now();
end $$;
revoke all on function public.brasa_save_bank_details(text,jsonb) from public,anon;
grant execute on function public.brasa_save_bank_details(text,jsonb) to authenticated;
commit;
