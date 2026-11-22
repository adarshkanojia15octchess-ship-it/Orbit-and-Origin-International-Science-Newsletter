#!/usr/bin/env bash
set -euo pipefail
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must point to a disposable PostgreSQL database" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
drop schema public cascade;
create schema public;
grant all on schema public to postgres;
grant usage on schema public to public;
create extension if not exists pgcrypto with schema public;

create table public.issues (
  id uuid primary key,
  issue_number integer not null unique,
  title text not null,
  slug text not null,
  description text,
  publication_date date,
  status text not null
);
create table public.subscribers (
  id uuid primary key,
  email text not null unique,
  first_name text,
  subscription_status text not null,
  consent_at timestamptz,
  subscribed_at timestamptz default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz default now()
);
create table public.campaigns (
  id uuid primary key,
  issue_id uuid not null references public.issues(id),
  subject text not null,
  status text not null default 'draft',
  queued_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id),
  subscriber_id uuid not null references public.subscribers(id),
  provider_message_id text,
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);
alter table public.subscribers enable row level security;
alter table public.campaigns enable row level security;
alter table public.email_deliveries enable row level security;
SQL

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/007_newsletter_campaign_operations.sql" >/dev/null

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v_result jsonb;
  v_count integer;
  v_delivery_id uuid;
  v_second_id uuid;
  v_email text;
  v_completed boolean;
  v_campaign_status text;
begin
  insert into public.issues (id, issue_number, title, slug, description, publication_date, status)
  values ('10000000-0000-4000-8000-000000000001', 990001, 'Queue fixture', 'queue-fixture', 'Campaign test issue', current_date, 'published');

  insert into public.subscribers (id,email,first_name,subscription_status)
  values
    ('20000000-0000-4000-8000-000000000001','one@example.test','One','active'),
    ('20000000-0000-4000-8000-000000000002','pending@example.test','Pending','pending'),
    ('20000000-0000-4000-8000-000000000003','two@example.test','Two','active');

  insert into public.campaigns (id,issue_id,subject,message_text,status,test_sent_at)
  values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Queue fixture subject','A sufficiently long campaign note.','draft',now());

  v_result := public.queue_campaign_deliveries('30000000-0000-4000-8000-000000000001');
  if (v_result->>'queued_count')::integer <> 2 then raise exception 'Expected two active recipients to be queued'; end if;

  create temporary table claim_first on commit drop as
    select * from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000001', 5, 180);
  select count(*) into v_count from claim_first;
  if v_count <> 2 then raise exception 'Expected two deliveries to be atomically claimed'; end if;

  select delivery_id into v_delivery_id from claim_first order by delivery_id limit 1;
  select recipient_email into v_email
    from public.get_campaign_delivery_for_send(v_delivery_id,'40000000-0000-4000-8000-000000000001');
  if v_email is null then raise exception 'Claim revalidation did not return an active recipient'; end if;

  v_completed := public.complete_campaign_delivery(
    v_delivery_id,'40000000-0000-4000-8000-000000000001','resend-fixture-001'
  );
  if not v_completed then raise exception 'Provider acceptance was not committed'; end if;

  select count(*) into v_count
    from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000099',5,180);
  if v_count <> 0 then raise exception 'A second worker claimed rows held by an unexpired lease'; end if;

  insert into public.campaigns (id,issue_id,subject,message_text,status,test_sent_at)
  values ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Suppression fixture','A sufficiently long campaign note.','draft',now());
  v_result := public.queue_campaign_deliveries('30000000-0000-4000-8000-000000000002');
  if (v_result->>'queued_count')::integer <> 2 then raise exception 'Suppression campaign should queue two active recipients'; end if;

  create temporary table claim_suppression on commit drop as
    select * from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000002',5,180);

  update public.subscribers set subscription_status='unsubscribed', unsubscribed_at=now()
   where id='20000000-0000-4000-8000-000000000001';
  delete from public.subscribers where id='20000000-0000-4000-8000-000000000003';

  select count(*) into v_count
    from public.email_deliveries
   where campaign_id='30000000-0000-4000-8000-000000000002'
     and delivery_status='suppressed';
  if v_count <> 2 then raise exception 'Unsubscribe and delete must suppress queued deliveries'; end if;

  select count(*) into v_count
    from public.email_deliveries
   where campaign_id='30000000-0000-4000-8000-000000000002'
     and subscriber_id is null and delivery_status='suppressed';
  if v_count <> 1 then raise exception 'Hard deletion must anonymise the subscriber foreign key'; end if;

  perform public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000003',5,180);
  select status into v_campaign_status from public.campaigns
   where id='30000000-0000-4000-8000-000000000002';
  if v_campaign_status <> 'completed' then raise exception 'Suppressed campaign did not close cleanly'; end if;

  insert into public.subscribers (id,email,first_name,subscription_status)
  values ('20000000-0000-4000-8000-000000000004','retry@example.test','Retry','active');

  insert into public.campaigns (id,issue_id,subject,message_text,status,test_sent_at)
  values ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Retry fixture','A sufficiently long campaign note.','draft',now());
  v_result := public.queue_campaign_deliveries('30000000-0000-4000-8000-000000000003');
  if (v_result->>'queued_count')::integer <> 1 then raise exception 'Retry fixture should queue one active recipient'; end if;

  create temporary table retry_one on commit drop as
    select * from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000004',5,180);
  select delivery_id into v_delivery_id from retry_one limit 1;

  if not public.fail_campaign_delivery(v_delivery_id,'40000000-0000-4000-8000-000000000004','Resend returned HTTP 503',true) then
    raise exception 'Transient failure did not return to queue';
  end if;

  update public.email_deliveries set next_attempt_at=now()
   where campaign_id='30000000-0000-4000-8000-000000000003';

  create temporary table retry_two on commit drop as
    select * from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000005',5,180);
  select delivery_id into v_second_id from retry_two limit 1;
  if v_second_id <> v_delivery_id then raise exception 'Retry changed the persistent delivery identity'; end if;

  select attempt_count into v_count from public.email_deliveries where id=v_delivery_id;
  if v_count <> 2 then raise exception 'Retry attempt counter did not advance'; end if;

  if not public.complete_campaign_delivery(v_delivery_id,'40000000-0000-4000-8000-000000000005','resend-fixture-002') then
    raise exception 'Retried delivery did not complete';
  end if;

  insert into public.campaigns (id,issue_id,subject,message_text,status,test_sent_at)
  values ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Lease fixture','A sufficiently long campaign note.','draft',now());
  v_result := public.queue_campaign_deliveries('30000000-0000-4000-8000-000000000004');
  if (v_result->>'queued_count')::integer <> 1 then raise exception 'Lease fixture should queue one recipient'; end if;

  create temporary table lease_first on commit drop as
    select * from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000006',5,180);
  select count(*) into v_count from lease_first;
  if v_count <> 1 then raise exception 'First lease claim failed'; end if;

  select count(*) into v_count
    from public.claim_campaign_deliveries('40000000-0000-4000-8000-000000000007',5,180);
  if v_count <> 0 then raise exception 'Duplicate worker invocation double-claimed a leased delivery'; end if;
end $$;
SQL

echo "PASS: subscriber deletion and campaign delivery queue integration"
