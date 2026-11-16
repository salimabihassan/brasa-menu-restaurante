-- Optional HTTPS deployment setup. Do not run for the LAN HTTP demo.
-- Deploy send-staff-notification and first create these two secrets in Vault:
-- brasa_staff_push_function_url: https://PROJECT.supabase.co/functions/v1/send-staff-notification
-- brasa_push_worker_token: the server-only BRASA_PUSH_WORKER_TOKEN (at least 32 chars).
-- Never paste the token into this file or frontend variables.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
declare target text;token text;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='brasa_staff_push_function_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='brasa_push_worker_token';
 if target is null or target !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/send-staff-notification$' or token is null or length(token)<32 then raise exception 'Configura URL y token de avisos del restaurante en Vault antes de continuar.'; end if;
end $$;

create or replace function public.brasa_wake_staff_push() returns trigger language plpgsql security definer set search_path='' as $$
declare target text;token text;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='brasa_staff_push_function_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='brasa_push_worker_token';
 if target is null or target !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/send-staff-notification$' or token is null or length(token)<32 then return new; end if;
 perform net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:=jsonb_build_object('jobId',new.id),timeout_milliseconds:=50000);
 return new;
exception when others then
 -- Preserve the order and job; the independent worker will retry.
 raise warning 'El aviso del restaurante quedó pendiente de reintento.';
 return new;
end $$;
revoke all on function public.brasa_wake_staff_push() from public,anon,authenticated;
drop trigger if exists brasa_staff_push_wake on public.brasa_staff_push_jobs;
create trigger brasa_staff_push_wake after insert on public.brasa_staff_push_jobs for each row execute function public.brasa_wake_staff_push();
do $$ begin if exists(select 1 from cron.job where jobname='brasa-staff-push-retry') then perform cron.unschedule('brasa-staff-push-retry'); end if; end $$;
select cron.schedule('brasa-staff-push-retry','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='brasa_staff_push_function_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='brasa_push_worker_token')),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$$);
