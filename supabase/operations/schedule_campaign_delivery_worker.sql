-- First store CAMPAIGN_WORKER_SECRET in Supabase Vault:
-- select vault.create_secret('same-value-as-Vercel-CAMPAIGN_WORKER_SECRET', 'campaign_worker_secret');

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
    from cron.job
   where jobname = 'orbit-origin-campaign-delivery-worker';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'orbit-origin-campaign-delivery-worker',
    '* * * * *',
    $worker$
      select net.http_post(
        url := 'https://orbit-and-origin-international-scie.vercel.app/api/cron/campaign-deliveries',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(
            (select decrypted_secret
               from vault.decrypted_secrets
              where name = 'campaign_worker_secret'
              limit 1),
            ''
          )
        ),
        body := jsonb_build_object('source', 'supabase-cron')
      ) as request_id;
    $worker$
  );
end $$;
