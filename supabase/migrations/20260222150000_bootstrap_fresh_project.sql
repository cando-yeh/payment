-- Bootstrap schema for a brand-new Supabase project.
-- This file creates the base objects required by the consolidated migrations.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='claim_type') then
    create type public.claim_type as enum ('employee', 'vendor', 'personal_service');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='claim_status') then
    create type public.claim_status as enum (
      'draft','pending_manager','pending_finance','pending_payment',
      'paid','paid_pending_doc','pending_doc_review','rejected','cancelled'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='attachment_status') then
    create type public.attachment_status as enum ('uploaded', 'exempt', 'pending_supplement');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='payee_type') then
    create type public.payee_type as enum ('employee', 'vendor', 'personal');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='payee_status') then
    create type public.payee_status as enum ('pending_add', 'pending_update', 'pending_disable', 'available', 'disabled');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='vendor_change_type') then
    create type public.vendor_change_type as enum ('create', 'update', 'disable');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='vendor_change_status') then
    create type public.vendor_change_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='payment_status') then
    create type public.payment_status as enum ('completed', 'reversed');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='vendor_status') then
    create type public.vendor_status as enum ('pending', 'approved', 'disabled');
  end if;
end $$;

create table if not exists public.system_config (
  key text primary key,
  value text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  approver_id uuid null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bank_account bytea null,
  is_finance boolean not null default false,
  is_admin boolean not null default false,
  bank varchar null,
  is_active boolean not null default true,
  deactivated_at timestamptz null,
  deactivated_by uuid null,
  deactivate_reason text null,
  email text null,
  bank_account_tail text null
);

alter table public.profiles
  add constraint profiles_approver_id_fkey foreign key (approver_id) references public.profiles(id);
alter table public.profiles
  add constraint profiles_deactivated_by_fkey foreign key (deactivated_by) references public.profiles(id);

create unique index if not exists profiles_email_unique_idx
  on public.profiles(email) where email is not null;
create index if not exists profiles_is_active_idx on public.profiles(is_active);

create table if not exists public.payees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.payee_type not null,
  bank_account bytea null,
  status public.payee_status not null default 'available',
  extra_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_description text null,
  bank varchar null,
  attachments jsonb not null default '{}'::jsonb,
  bank_account_tail text null,
  editable_account boolean not null default false,
  unified_no text null,
  national_id bytea null
);

create index if not exists payees_type_idx on public.payees(type);
create index if not exists idx_payees_unified_no on public.payees(unified_no);

create table if not exists public.payee_change_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  payee_id uuid null,
  change_type public.vendor_change_type not null,
  requested_by uuid not null,
  reviewed_by uuid null,
  status public.vendor_change_status not null default 'pending',
  reason text null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  proposed_data jsonb null,
  proposed_bank_account bytea null,
  proposed_attachments jsonb not null default '{}'::jsonb,
  proposed_bank_account_tail text null,
  proposed_unified_no text null,
  proposed_national_id bytea null
);

alter table public.payee_change_requests
  add constraint vendor_change_requests_requested_by_fkey foreign key (requested_by) references public.profiles(id);
alter table public.payee_change_requests
  add constraint vendor_change_requests_reviewed_by_fkey foreign key (reviewed_by) references public.profiles(id);

create or replace function public.generate_short_id()
returns text
language sql
volatile
as $$
  select upper(substr(md5(random()::text), 1, 8));
$$;

create table if not exists public.payments (
  id varchar primary key default public.generate_short_id(),
  payee_id uuid not null,
  payee_name text not null,
  total_amount numeric not null,
  bank_account bytea null,
  status public.payment_status not null default 'completed',
  paid_by uuid null references public.profiles(id),
  paid_at timestamptz null default now(),
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  bank varchar null
);

create table if not exists public.claims (
  id varchar primary key default public.generate_short_id(),
  claim_type public.claim_type not null,
  status public.claim_status not null default 'draft',
  applicant_id uuid not null references public.profiles(id),
  total_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz null,
  payee_id uuid null references public.payees(id),
  description text null,
  bank_code text null,
  bank_account bytea null,
  last_comment text null,
  pay_first_patch_doc boolean not null default false,
  payment_id varchar null references public.payments(id)
);

create table if not exists public.claim_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  claim_id varchar not null references public.claims(id),
  item_index integer not null,
  category text not null,
  description text null,
  amount numeric not null,
  invoice_number text null,
  attachment_status public.attachment_status not null default 'uploaded',
  date_start date null,
  date_end date null,
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.claim_history (
  id uuid primary key default extensions.uuid_generate_v4(),
  claim_id varchar not null references public.claims(id),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  from_status public.claim_status null,
  to_status public.claim_status null,
  comment text null,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  description text not null default ''
);

create index if not exists idx_expense_categories_active_name
  on public.expense_categories(is_active, name);

create table if not exists public.notification_event_types (
  event_code text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_event_template_map (
  event_code text not null references public.notification_event_types(event_code),
  channel text not null default 'email',
  template_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_code, channel)
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_code text not null references public.notification_event_types(event_code),
  channel text not null default 'email',
  template_key text null,
  claim_id text null references public.claims(id),
  actor_id uuid null references public.profiles(id),
  recipient_user_id uuid null references public.profiles(id),
  recipient_email text null,
  cc_emails text[] not null default '{}'::text[],
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status = any (array['queued','processing','sent','failed','cancelled'])),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  dedupe_key text null,
  scheduled_at timestamptz not null default now(),
  processing_started_at timestamptz null,
  sent_at timestamptz null,
  failed_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_template_fk
    foreign key (event_code, channel) references public.notification_event_template_map(event_code, channel)
    on update cascade on delete restrict
);

create unique index if not exists uq_notification_jobs_dedupe_key
  on public.notification_jobs(channel, dedupe_key);
create index if not exists idx_notification_jobs_claim
  on public.notification_jobs(claim_id, created_at desc);
create index if not exists idx_notification_jobs_queue_pick
  on public.notification_jobs(status, scheduled_at, created_at)
  where status = any (array['queued','processing']);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid null references public.notification_jobs(id),
  event_code text not null references public.notification_event_types(event_code),
  channel text not null default 'email',
  template_key text null,
  claim_id text null references public.claims(id),
  recipient_user_id uuid null references public.profiles(id),
  recipient_email text null,
  cc_emails text[] not null default '{}'::text[],
  status text not null check (status = any (array['sent','failed','cancelled'])),
  provider text null,
  provider_message_id text null,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists idx_notification_logs_claim
  on public.notification_logs(claim_id, created_at desc);
create index if not exists idx_notification_logs_job
  on public.notification_logs(job_id, created_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

create or replace function public.is_finance()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_finance = true
  );
$$;

create or replace function public.sync_payee_editable_account_from_extra_info()
returns trigger
language plpgsql
as $$
begin
  if new.type <> 'vendor' then
    new.editable_account := false;
  elsif new.editable_account is null then
    new.editable_account := false;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create or replace function public.reveal_profile_bank_account(target_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encrypted bytea;
begin
  if not (public.is_finance() or public.is_admin() or auth.uid() = target_id) then
    raise exception 'Not allowed';
  end if;

  select bank_account into v_encrypted
  from public.profiles
  where id = target_id;

  if v_encrypted is null then
    return null;
  end if;

  return public.pgp_sym_decrypt(v_encrypted, public.get_crypto_key());
end;
$$;

create or replace function public.update_profile_bank_account(target_id uuid, raw_account text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.uid() = target_id) then
    raise exception 'Not allowed';
  end if;

  update public.profiles
  set bank_account = case
      when raw_account is null or btrim(raw_account) = '' then null
      else public.pgp_sym_encrypt(btrim(raw_account), public.get_crypto_key())
    end,
    bank_account_tail = case
      when raw_account is null or btrim(raw_account) = '' then null
      when length(btrim(raw_account)) <= 5 then btrim(raw_account)
      else right(btrim(raw_account), 5)
    end,
    updated_at = now()
  where id = target_id;
end;
$$;

create or replace function public.reject_payee_change_request(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_finance() then
    raise exception 'Only finance users can reject requests';
  end if;

  update public.payee_change_requests
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = _request_id and status = 'pending';
end;
$$;

create or replace function public.log_claim_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.claim_history (
      claim_id, actor_id, action, from_status, to_status, comment, created_at
    )
    values (
      new.id, auth.uid(), 'status_change', old.status, new.status, new.last_comment, now()
    );
    new.last_comment := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_expense_categories_updated_at on public.expense_categories;
create trigger trg_expense_categories_updated_at
before update on public.expense_categories
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_sync_payee_editable_account on public.payees;
create trigger trg_sync_payee_editable_account
before insert or update on public.payees
for each row execute function public.sync_payee_editable_account_from_extra_info();

drop trigger if exists trigger_claim_status_change on public.claims;
create trigger trigger_claim_status_change
after update on public.claims
for each row execute function public.log_claim_status_change();

alter table public.profiles enable row level security;
alter table public.claims enable row level security;
alter table public.claim_items enable row level security;
alter table public.claim_history enable row level security;
alter table public.payees enable row level security;
alter table public.payee_change_requests enable row level security;
alter table public.payments enable row level security;
alter table public.system_config enable row level security;
alter table public.expense_categories enable row level security;
alter table public.notification_event_types enable row level security;
alter table public.notification_event_template_map enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists claims_applicant on public.claims;
create policy claims_applicant on public.claims for all to public using (auth.uid() = applicant_id);
drop policy if exists claims_approver on public.claims;
create policy claims_approver on public.claims for select to public
using (exists (select 1 from public.profiles where profiles.id = claims.applicant_id and profiles.approver_id = auth.uid()));
drop policy if exists claims_approver_update on public.claims;
create policy claims_approver_update on public.claims for update to public
using (exists (select 1 from public.profiles where profiles.id = claims.applicant_id and profiles.approver_id = auth.uid()));
drop policy if exists claims_finance_read on public.claims;
create policy claims_finance_read on public.claims for select to public using (public.is_finance());
drop policy if exists claims_finance_update on public.claims;
create policy claims_finance_update on public.claims for update to public using (public.is_finance());

drop policy if exists items_management on public.claim_items;
create policy items_management on public.claim_items for all to public
using (exists (select 1 from public.claims where (claims.id)::text = (claim_items.claim_id)::text and claims.applicant_id = auth.uid()));
drop policy if exists items_approver_read on public.claim_items;
create policy items_approver_read on public.claim_items for select to public
using (exists (select 1 from public.claims join public.profiles on profiles.id = claims.applicant_id where (claims.id)::text = (claim_items.claim_id)::text and profiles.approver_id = auth.uid()));
drop policy if exists items_finance on public.claim_items;
create policy items_finance on public.claim_items for select to public using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_finance = true));

drop policy if exists history_individual on public.claim_history;
create policy history_individual on public.claim_history for select to public
using (exists (select 1 from public.claims where (claims.id)::text = (claim_history.claim_id)::text and claims.applicant_id = auth.uid()));
drop policy if exists history_approver_read on public.claim_history;
create policy history_approver_read on public.claim_history for select to public
using (exists (select 1 from public.claims join public.profiles on profiles.id = claims.applicant_id where (claims.id)::text = (claim_history.claim_id)::text and profiles.approver_id = auth.uid()));
drop policy if exists history_finance on public.claim_history;
create policy history_finance on public.claim_history for select to public
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_finance = true));

drop policy if exists profiles_individual_read on public.profiles;
create policy profiles_individual_read on public.profiles for select to public using (auth.uid() = id);
drop policy if exists profiles_individual_update on public.profiles;
create policy profiles_individual_update on public.profiles for update to public using (auth.uid() = id);
drop policy if exists profiles_approver_read on public.profiles;
create policy profiles_approver_read on public.profiles for select to public using (approver_id = auth.uid());
drop policy if exists profiles_finance_read on public.profiles;
create policy profiles_finance_read on public.profiles for select to public using (public.is_finance());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to public using (public.is_admin());

drop policy if exists payees_select_all on public.payees;
create policy payees_select_all on public.payees for select to public using (true);

drop policy if exists payee_change_select_own on public.payee_change_requests;
create policy payee_change_select_own on public.payee_change_requests for select to public using (requested_by = auth.uid());
drop policy if exists payee_change_read_finance on public.payee_change_requests;
create policy payee_change_read_finance on public.payee_change_requests for select to public
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_finance = true));
drop policy if exists payee_change_update_finance on public.payee_change_requests;
create policy payee_change_update_finance on public.payee_change_requests for update to public
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_finance = true));
drop policy if exists payee_change_update_own on public.payee_change_requests;
create policy payee_change_update_own on public.payee_change_requests for update to public
using ((requested_by = auth.uid()) and (status = 'pending'::public.vendor_change_status))
with check ((status = 'withdrawn'::public.vendor_change_status) and (requested_by = auth.uid()));
drop policy if exists payee_change_delete_own on public.payee_change_requests;
create policy payee_change_delete_own on public.payee_change_requests for delete to public
using ((requested_by = auth.uid()) and (status = 'pending'::public.vendor_change_status));

drop policy if exists payments_applicant on public.payments;
create policy payments_applicant on public.payments for select to public
using ((id)::text in (select claims.payment_id from public.claims where claims.applicant_id = auth.uid()));
drop policy if exists payments_approver_read on public.payments;
create policy payments_approver_read on public.payments for select to public
using (exists (select 1 from public.claims join public.profiles on profiles.id = claims.applicant_id where (claims.payment_id)::text = (payments.id)::text and profiles.approver_id = auth.uid()));
drop policy if exists payments_finance on public.payments;
create policy payments_finance on public.payments for all to public
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_finance = true));

drop policy if exists expense_categories_select_authenticated on public.expense_categories;
create policy expense_categories_select_authenticated on public.expense_categories
for select to authenticated using (true);
drop policy if exists expense_categories_insert_finance on public.expense_categories;
create policy expense_categories_insert_finance on public.expense_categories
for insert to authenticated with check (public.is_finance());
drop policy if exists expense_categories_update_finance on public.expense_categories;
create policy expense_categories_update_finance on public.expense_categories
for update to authenticated using (public.is_finance()) with check (public.is_finance());
drop policy if exists expense_categories_delete_finance on public.expense_categories;
create policy expense_categories_delete_finance on public.expense_categories
for delete to authenticated using (public.is_finance());

drop policy if exists system_config_admin_all on public.system_config;
create policy system_config_admin_all on public.system_config
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('claims', 'claims', false, null, null),
  ('payees', 'payees', false, null, null),
  ('receipts', 'receipts', false, 5242880, array['image/png','image/jpeg','image/jpg','application/pdf'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists claims_attachments_upload on storage.objects;
create policy claims_attachments_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'claims'
  and exists (
    select 1 from public.claims c
    where (c.id)::text = split_part(objects.name, '/', 1)
      and c.applicant_id = auth.uid()
      and c.status = any (array['draft'::public.claim_status, 'pending_doc_review'::public.claim_status, 'paid_pending_doc'::public.claim_status, 'rejected'::public.claim_status])
  )
);

drop policy if exists claims_attachments_view on storage.objects;
create policy claims_attachments_view
on storage.objects for select to authenticated
using (
  bucket_id = 'claims'
  and exists (
    select 1
    from public.claims c
    join public.profiles viewer on viewer.id = auth.uid()
    where (c.id)::text = split_part(objects.name, '/', 1)
      and (
        c.applicant_id = auth.uid()
        or viewer.is_admin = true
        or viewer.is_finance = true
        or exists (
          select 1 from public.profiles applicant
          where applicant.id = c.applicant_id and applicant.approver_id = auth.uid()
        )
      )
  )
);

drop policy if exists payee_attachments_upload on storage.objects;
create policy payee_attachments_upload
on storage.objects for insert to authenticated
with check (bucket_id = 'payees');

drop policy if exists payee_attachments_select_restricted on storage.objects;
create policy payee_attachments_select_restricted
on storage.objects for select to authenticated
using (
  bucket_id = 'payees'
  and (
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_finance = true or p.is_admin = true))
  )
);

drop policy if exists payee_attachments_update_restricted on storage.objects;
create policy payee_attachments_update_restricted
on storage.objects for update to authenticated
using (
  bucket_id = 'payees'
  and (
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_finance = true or p.is_admin = true))
  )
)
with check (bucket_id = 'payees');

drop policy if exists payee_attachments_delete_restricted on storage.objects;
create policy payee_attachments_delete_restricted
on storage.objects for delete to authenticated
using (
  bucket_id = 'payees'
  and (
    owner = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_finance = true or p.is_admin = true))
  )
);
