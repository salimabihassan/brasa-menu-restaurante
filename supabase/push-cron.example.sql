-- OPTIONAL production setup, after deploying send-ready-notification.
-- Store its exact URL and BRASA_PUSH_WORKER_TOKEN in Supabase Vault as:
-- brasa_push_function_url and brasa_push_worker_token. Do not paste secrets here.
-- Requires enabled pg_cron, pg_net and Vault. Schedule only once.
select cron.schedule('brasa-ready-push-retry','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='brasa_push_function_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='brasa_push_worker_token')),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$$);
