-- 007: Subscriber controls, durable campaign delivery and Resend events.

-- Create the campaign ledger and per-recipient queue on fresh installs as well.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete restrict,
  subject text not null,
  status text not null default 'draft',
  queued_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  subscriber_id uuid references public.subscribers(id) on delete set null,
  provider_message_id text,
  delivery_status text not null default 'queued',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

alter table public.campaigns
  add column if not exists issue_id uuid references public.issues(id) on delete restrict,
  add column if not exists subject text,
  add column if not exists status text not null default 'draft',
  add column if not exists queued_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.email_deliveries
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists subscriber_id uuid references public.subscribers(id),
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text not null default 'queued',
  add column if not exists error_message text,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.campaigns drop constraint if exists campaigns_status_check;
update public.campaigns set status = 'completed' where status = 'sent';
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'queued', 'sending', 'completed', 'failed'));

create unique index if not exists email_deliveries_campaign_subscriber_unique
  on public.email_deliveries(campaign_id, subscriber_id);

-- No browser role can read subscriber addresses through these operational tables.
alter table public.campaigns enable row level security;
alter table public.email_deliveries enable row level security;
revoke all on public.campaigns, public.email_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.campaigns, public.email_deliveries to service_role;
alter table public.email_deliveries alter column id set default gen_random_uuid();


-- Private operational tables remain RLS-protected and accessible only to service_role.

alter table public.campaigns
  add column if not exists preheader text not null default '',
  add column if not exists message_text text not null default '',
  add column if not exists test_sent_at timestamptz,
  add column if not exists test_recipient_hash text,
  add column if not exists send_started_at timestamptz,
  add column if not exists last_error text;

alter table public.campaigns
  add constraint campaigns_preheader_length_check check (char_length(preheader) <= 180),
  add constraint campaigns_message_text_length_check check (char_length(message_text) <= 8000),
  add constraint campaigns_test_recipient_hash_check
    check (test_recipient_hash is null or test_recipient_hash ~ '^[a-f0-9]{64}$');

alter table public.email_deliveries drop constraint if exists email_deliveries_subscriber_id_fkey;
alter table public.email_deliveries alter column subscriber_id drop not null;
alter table public.email_deliveries
  add constraint email_deliveries_subscriber_id_fkey
  foreign key (subscriber_id) references public.subscribers(id) on delete set null;

alter table public.email_deliveries
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists lock_token uuid,
  add column if not exists locked_until timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_provider_event text,
  add column if not exists last_provider_event_at timestamptz;

alter table public.email_deliveries add constraint email_deliveries_attempt_count_check check (attempt_count >= 0);
alter table public.email_deliveries drop constraint if exists email_deliveries_delivery_status_check;
alter table public.email_deliveries
  add constraint email_deliveries_delivery_status_check
  check (delivery_status = any (array[
    'queued'::text, 'sending'::text, 'sent'::text, 'delivered'::text,
    'bounced'::text, 'complained'::text, 'failed'::text, 'suppressed'::text
  ]));

create index if not exists email_deliveries_worker_queue_idx
  on public.email_deliveries(delivery_status, next_attempt_at, locked_until, created_at)
  where delivery_status in ('queued', 'sending');
create unique index if not exists email_deliveries_provider_message_id_unique
  on public.email_deliveries(provider_message_id)
  where provider_message_id is not null;

create table if not exists public.email_webhook_events (
  event_id text primary key check (char_length(event_id) <= 255),
  event_type text not null check (char_length(event_type) <= 128),
  provider_message_id text,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'error')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);
alter table public.email_webhook_events enable row level security;
revoke all on public.email_webhook_events from public, anon, authenticated;
grant select, insert, update on public.email_webhook_events to service_role;
create index if not exists email_webhook_events_provider_message_idx
  on public.email_webhook_events(provider_message_id)
  where provider_message_id is not null;
create index if not exists email_webhook_events_pending_idx
  on public.email_webhook_events(processing_status, received_at)
  where processing_status in ('received', 'error');

create or replace function public.suppress_campaign_deliveries_for_inactive_subscriber()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.subscription_status in ('unsubscribed', 'bounced')
     and old.subscription_status is distinct from new.subscription_status then
    update public.email_deliveries
       set delivery_status = 'suppressed',
           lock_token = null,
           locked_until = null,
           error_message = 'Subscriber is no longer eligible for campaign delivery'
     where subscriber_id = new.id
       and delivery_status in ('queued', 'sending');
  end if;
  return new;
end;
$$;

drop trigger if exists subscribers_suppress_campaign_deliveries on public.subscribers;
create trigger subscribers_suppress_campaign_deliveries
after update of subscription_status on public.subscribers
for each row
when (
  new.subscription_status in ('unsubscribed', 'bounced')
  and old.subscription_status is distinct from new.subscription_status
)
execute function public.suppress_campaign_deliveries_for_inactive_subscriber();

create or replace function public.suppress_campaign_deliveries_before_subscriber_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.email_deliveries
     set delivery_status = 'suppressed',
         lock_token = null,
         locked_until = null,
         error_message = 'Subscriber record deleted'
   where subscriber_id = old.id
     and delivery_status in ('queued', 'sending');
  return old;
end;
$$;

drop trigger if exists subscribers_suppress_deliveries_before_delete on public.subscribers;
create trigger subscribers_suppress_deliveries_before_delete
before delete on public.subscribers
for each row execute function public.suppress_campaign_deliveries_before_subscriber_delete();

create or replace function public.refresh_campaign_delivery_status(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pending integer;
  v_sending integer;
  v_finished integer;
  v_failed integer;
begin
  select
    count(*) filter (where delivery_status in ('queued', 'sending'))::integer,
    count(*) filter (where delivery_status = 'sending')::integer,
    count(*) filter (where delivery_status in ('sent', 'delivered', 'bounced', 'complained', 'suppressed'))::integer,
    count(*) filter (where delivery_status = 'failed')::integer
  into v_pending, v_sending, v_finished, v_failed
  from public.email_deliveries
  where campaign_id = p_campaign_id;

  update public.campaigns
     set status = case
           when v_pending > 0 and v_sending > 0 then 'sending'
           when v_pending > 0 then 'queued'
           when v_finished > 0 then 'completed'
           else 'failed'
         end,
         completed_at = case when v_pending = 0 then coalesce(completed_at, now()) else null end,
         last_error = case
           when v_pending = 0 and v_failed > 0 then 'One or more recipient deliveries did not complete'
           when v_pending = 0 then null
           else last_error
         end
   where id = p_campaign_id and status <> 'draft';
end;
$$;

create or replace function public.queue_campaign_deliveries(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_campaign public.campaigns%rowtype;
  v_issue_status text;
  v_queued integer;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'campaign_not_found', 'queued_count', 0); end if;
  if v_campaign.status <> 'draft' then return jsonb_build_object('ok', false, 'reason', 'campaign_not_draft', 'queued_count', 0); end if;
  if v_campaign.test_sent_at is null then return jsonb_build_object('ok', false, 'reason', 'test_send_required', 'queued_count', 0); end if;
  if char_length(trim(v_campaign.subject)) < 3 or char_length(trim(v_campaign.message_text)) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'campaign_content_invalid', 'queued_count', 0);
  end if;

  select status into v_issue_status from public.issues where id = v_campaign.issue_id for share;
  if v_issue_status is distinct from 'published' then
    return jsonb_build_object('ok', false, 'reason', 'issue_not_published', 'queued_count', 0);
  end if;

  insert into public.email_deliveries (campaign_id, subscriber_id, delivery_status, next_attempt_at)
  select p_campaign_id, s.id, 'queued', now()
    from public.subscribers s
   where s.subscription_status = 'active'
  on conflict (campaign_id, subscriber_id) do nothing;

  get diagnostics v_queued = row_count;
  if v_queued = 0 then return jsonb_build_object('ok', false, 'reason', 'no_active_subscribers', 'queued_count', 0); end if;

  update public.campaigns
     set status = 'queued', queued_at = now(), completed_at = null,
         send_started_at = null, last_error = null
   where id = p_campaign_id;
  return jsonb_build_object('ok', true, 'queued_count', v_queued);
end;
$$;

create or replace function public.claim_campaign_deliveries(
  p_claim_token uuid,
  p_limit integer default 3,
  p_lease_seconds integer default 180
)
returns table(delivery_id uuid, campaign_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_campaign_id uuid;
begin
  if p_claim_token is null or p_limit < 1 or p_limit > 20 or p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'Invalid campaign delivery claim parameters';
  end if;

  update public.email_deliveries d
     set delivery_status = 'suppressed', lock_token = null, locked_until = null,
         error_message = 'Recipient or linked issue is no longer eligible'
   where d.delivery_status in ('queued', 'sending')
     and (
       d.subscriber_id is null
       or not exists (select 1 from public.subscribers s where s.id = d.subscriber_id and s.subscription_status = 'active')
       or not exists (
         select 1 from public.campaigns c join public.issues i on i.id = c.issue_id
          where c.id = d.campaign_id and i.status = 'published'
       )
     );

  update public.email_deliveries
     set delivery_status = 'failed', lock_token = null, locked_until = null,
         error_message = coalesce(error_message, 'Worker lease expired after the retry limit')
   where delivery_status = 'sending'
     and (locked_until is null or locked_until <= now())
     and attempt_count >= 5;

  for v_campaign_id in
    select c.id from public.campaigns c
     where c.status in ('queued', 'sending')
       and not exists (
         select 1 from public.email_deliveries d
          where d.campaign_id = c.id and d.delivery_status in ('queued', 'sending')
       )
  loop
    perform public.refresh_campaign_delivery_status(v_campaign_id);
  end loop;

  return query
  with candidates as (
    select d.id, d.campaign_id
      from public.email_deliveries d
      join public.campaigns c on c.id = d.campaign_id
      join public.subscribers s on s.id = d.subscriber_id
      join public.issues i on i.id = c.issue_id
     where c.status in ('queued', 'sending')
       and i.status = 'published'
       and s.subscription_status = 'active'
       and d.attempt_count < 5
       and (
         (d.delivery_status = 'queued' and d.next_attempt_at <= now())
         or (d.delivery_status = 'sending' and (d.locked_until is null or d.locked_until <= now()))
       )
     order by d.next_attempt_at, d.created_at
     for update of d skip locked
     limit p_limit
  ),
  claimed as (
    update public.email_deliveries d
       set delivery_status = 'sending',
           attempt_count = d.attempt_count + 1,
           lock_token = p_claim_token,
           locked_until = now() + make_interval(secs => p_lease_seconds),
           last_attempt_at = now()
      from candidates c
     where d.id = c.id
    returning d.id, d.campaign_id
  )
  select claimed.id, claimed.campaign_id from claimed;

  update public.campaigns c
     set status = 'sending', send_started_at = coalesce(send_started_at, now())
   where exists (
     select 1 from public.email_deliveries d
      where d.campaign_id = c.id and d.lock_token = p_claim_token and d.delivery_status = 'sending'
   );
end;
$$;

create or replace function public.get_campaign_delivery_for_send(p_delivery_id uuid, p_claim_token uuid)
returns table(
  delivery_id uuid, campaign_id uuid, subscriber_id uuid, recipient_email text,
  first_name text, campaign_subject text, campaign_preheader text, campaign_message text,
  issue_title text, issue_description text, issue_number integer
)
language plpgsql security definer set search_path = public as $$
declare v_suppressed_campaign_id uuid;
begin
  update public.email_deliveries d
     set delivery_status = 'suppressed', lock_token = null, locked_until = null,
         error_message = 'Recipient or linked issue is no longer eligible'
   where d.id = p_delivery_id and d.lock_token = p_claim_token and d.delivery_status = 'sending'
     and (
       d.subscriber_id is null
       or not exists (select 1 from public.subscribers s where s.id = d.subscriber_id and s.subscription_status = 'active')
       or not exists (
         select 1 from public.campaigns c join public.issues i on i.id = c.issue_id
          where c.id = d.campaign_id and i.status = 'published'
       )
     )
  returning d.campaign_id into v_suppressed_campaign_id;

  if v_suppressed_campaign_id is not null then perform public.refresh_campaign_delivery_status(v_suppressed_campaign_id); end if;

  return query
  select d.id, d.campaign_id, s.id, s.email, s.first_name,
         c.subject, c.preheader, c.message_text, i.title, i.description, i.issue_number
    from public.email_deliveries d
    join public.subscribers s on s.id = d.subscriber_id
    join public.campaigns c on c.id = d.campaign_id
    join public.issues i on i.id = c.issue_id
   where d.id = p_delivery_id and d.lock_token = p_claim_token
     and d.delivery_status = 'sending' and s.subscription_status = 'active' and i.status = 'published';
end;
$$;

create or replace function public.complete_campaign_delivery(p_delivery_id uuid, p_claim_token uuid, p_provider_message_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_campaign_id uuid;
begin
  update public.email_deliveries
     set delivery_status = case when delivery_status = 'sending' then 'sent' else delivery_status end,
         provider_message_id = coalesce(provider_message_id, p_provider_message_id),
         sent_at = coalesce(sent_at, now()), lock_token = null, locked_until = null, error_message = null
   where id = p_delivery_id and lock_token = p_claim_token
     and delivery_status in ('sending', 'sent', 'delivered', 'bounced', 'complained', 'suppressed', 'failed')
  returning campaign_id into v_campaign_id;
  if not found then return false; end if;
  perform public.refresh_campaign_delivery_status(v_campaign_id);
  return true;
end;
$$;

create or replace function public.fail_campaign_delivery(
  p_delivery_id uuid, p_claim_token uuid, p_error_message text default null, p_retryable boolean default true
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_campaign_id uuid;
begin
  update public.email_deliveries
     set delivery_status = case when p_retryable and attempt_count < 5 then 'queued' else 'failed' end,
         next_attempt_at = case
           when p_retryable and attempt_count < 5
             then now() + make_interval(secs => least(900, 60 * power(2, greatest(0, attempt_count - 1)))::integer)
           else next_attempt_at
         end,
         error_message = left(coalesce(p_error_message, 'Email provider request failed'), 500),
         lock_token = null, locked_until = null
   where id = p_delivery_id and lock_token = p_claim_token and delivery_status = 'sending'
  returning campaign_id into v_campaign_id;
  if not found then return false; end if;
  perform public.refresh_campaign_delivery_status(v_campaign_id);
  return true;
end;
$$;

create or replace function public.retry_failed_campaign_deliveries(p_campaign_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_updated integer;
begin
  update public.email_deliveries
     set delivery_status = 'queued', attempt_count = 0, next_attempt_at = now(),
         lock_token = null, locked_until = null, error_message = null
   where campaign_id = p_campaign_id and delivery_status = 'failed'
     and provider_message_id is null and last_attempt_at >= now() - interval '24 hours';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;
  update public.campaigns
     set status = 'queued', queued_at = now(), completed_at = null, last_error = null
   where id = p_campaign_id and status in ('completed', 'failed', 'sending', 'queued');
  perform public.refresh_campaign_delivery_status(p_campaign_id);
  return true;
end;
$$;

create or replace function public.campaign_delivery_stats()
returns table(campaign_id uuid, delivery_status text, total bigint)
language sql stable security definer set search_path = public as $$
  select d.campaign_id, d.delivery_status, count(*)
    from public.email_deliveries d
   group by d.campaign_id, d.delivery_status;
$$;

revoke all on function public.suppress_campaign_deliveries_for_inactive_subscriber() from public, anon, authenticated;
revoke all on function public.suppress_campaign_deliveries_before_subscriber_delete() from public, anon, authenticated;
revoke all on function public.refresh_campaign_delivery_status(uuid) from public, anon, authenticated;
revoke all on function public.queue_campaign_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.claim_campaign_deliveries(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.get_campaign_delivery_for_send(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_campaign_delivery(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_campaign_delivery(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.retry_failed_campaign_deliveries(uuid) from public, anon, authenticated;
revoke all on function public.campaign_delivery_stats() from public, anon, authenticated;

grant execute on function public.suppress_campaign_deliveries_for_inactive_subscriber() to service_role;
grant execute on function public.suppress_campaign_deliveries_before_subscriber_delete() to service_role;
grant execute on function public.refresh_campaign_delivery_status(uuid) to service_role;
grant execute on function public.queue_campaign_deliveries(uuid) to service_role;
grant execute on function public.claim_campaign_deliveries(uuid, integer, integer) to service_role;
grant execute on function public.get_campaign_delivery_for_send(uuid, uuid) to service_role;
grant execute on function public.complete_campaign_delivery(uuid, uuid, text) to service_role;
grant execute on function public.fail_campaign_delivery(uuid, uuid, text, boolean) to service_role;
grant execute on function public.retry_failed_campaign_deliveries(uuid) to service_role;
grant execute on function public.campaign_delivery_stats() to service_role;
