begin;
create function public.brasa_valid_rut(p_rut text) returns boolean
language plpgsql immutable set search_path='' as $$
declare compact text;body text;digit text;total integer:=0;factor integer:=2;result integer;expected text;i integer;
begin
 compact:=upper(regexp_replace(coalesce(p_rut,''),'[.[:space:]-]','','g'));
 if compact !~ '^[0-9]{1,8}[0-9K]$' then return false; end if;
 body:=left(compact,length(compact)-1);digit:=right(compact,1);
 if body::bigint=0 then return false; end if;
 for i in reverse length(body)..1 loop total:=total+substr(body,i,1)::integer*factor;factor:=case when factor=7 then 2 else factor+1 end;end loop;
 result:=11-(total%11);expected:=case when result=11 then '0' when result=10 then 'K' else result::text end;
 return digit=expected;
end $$;
revoke all on function public.brasa_valid_rut(text) from public;
grant execute on function public.brasa_valid_rut(text) to authenticated,service_role;
create or replace function public.brasa_save_bank_details(p_branch text,p_details jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_bank text;v_type text;v_number text;v_holder text;v_rut text;v_email text;v_enabled boolean;
begin
 perform 1 from public.brasa_branches where id=p_branch for update;
 if not public.brasa_has_role(p_branch,array['admin']) then raise exception 'Solo el administrador puede cambiar los datos de transferencia.'; end if;
 if jsonb_typeof(p_details) is distinct from 'object' or jsonb_typeof(p_details->'enabled') is distinct from 'boolean' then raise exception 'Datos de transferencia inválidos.'; end if;
 v_bank:=trim(coalesce(p_details->>'bank',''));v_type:=trim(coalesce(p_details->>'account_type',''));v_number:=trim(coalesce(p_details->>'account_number',''));
 v_holder:=trim(coalesce(p_details->>'holder',''));v_rut:=upper(regexp_replace(coalesce(p_details->>'rut',''),'[.[:space:]-]','','g')); if length(v_rut)>1 then v_rut:=left(v_rut,length(v_rut)-1)||'-'||right(v_rut,1); end if;v_email:=lower(trim(coalesce(p_details->>'email','')));v_enabled:=(p_details->>'enabled')::boolean;
 if length(v_bank)>80 or (v_enabled and length(v_bank)<2) then raise exception 'Escribe un nombre de banco de entre 2 y 80 caracteres.' using detail='bank'; end if;
 if length(v_type)>40 or (v_enabled and v_type not in ('Cuenta corriente','Cuenta vista','Cuenta de ahorro','Cuenta RUT')) then raise exception 'Selecciona un tipo de cuenta válido.' using detail='account_type'; end if;
 if length(v_number)>30 or (v_enabled and v_number !~ '^[0-9]{1,30}$') then raise exception 'El número de cuenta debe contener solo dígitos, sin puntos ni espacios.' using detail='account_number'; end if;
 if length(v_holder)>120 or (v_enabled and length(v_holder)<2) then raise exception 'Escribe el nombre del titular, de entre 2 y 120 caracteres.' using detail='holder'; end if;
 if length(v_rut)>20 or (v_enabled and v_rut !~ '^[0-9]{1,8}-[0-9K]$') then raise exception 'Escribe el RUT completo, incluido su dígito verificador.' using detail='rut'; end if;
 if v_enabled and not public.brasa_valid_rut(v_rut) then raise exception 'El dígito verificador del RUT no corresponde. Revisa el RUT del titular.' using detail='rut'; end if;
 if length(v_email)>254 or (v_email<>'' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Escribe un correo de confirmación válido o deja este campo vacío.' using detail='email'; end if;
 insert into public.brasa_bank_details(branch_id,bank,account_type,account_number,holder,rut,email,enabled)
 values(p_branch,v_bank,v_type,v_number,v_holder,v_rut,v_email,v_enabled)
 on conflict(branch_id) do update set bank=excluded.bank,account_type=excluded.account_type,account_number=excluded.account_number,holder=excluded.holder,rut=excluded.rut,email=excluded.email,enabled=excluded.enabled,updated_at=now();
end $$;
commit;
