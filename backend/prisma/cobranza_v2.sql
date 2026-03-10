-- Cobranza App v2 - Full PostgreSQL schema
-- Target: PostgreSQL 14+
-- Timezone reference for business day logic: America/Bogota

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================
-- Enums
-- ============================================================
do $$
begin
  create type app_role_code as enum ('ADMIN', 'AUXILIAR', 'COBRADOR');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type status_flag as enum ('ACTIVE', 'INACTIVE');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type loan_status as enum ('ACTIVE', 'COMPLETED', 'RENEWED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type notification_type as enum ('INACTIVITY_ALERT', 'AUTO_CLOSE_CONFIRMATION');
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- Core tables
-- ============================================================
create table if not exists roles (
  id            smallserial primary key,
  code          app_role_code not null unique,
  name          varchar(40) not null unique,
  description   text,
  created_at    timestamptz not null default now()
);

create table if not exists users (
  id                     uuid primary key default gen_random_uuid(),
  full_name              varchar(120) not null,
  email                  citext not null unique,
  phone                  varchar(30) not null,
  password_hash          text not null,
  role_id                smallint not null references roles(id),
  status                 status_flag not null default 'ACTIVE',
  created_by_admin_id    uuid references users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  last_password_reset_at timestamptz,
  constraint users_phone_not_blank check (btrim(phone) <> '')
);

create index if not exists idx_users_role_id on users(role_id);
create index if not exists idx_users_status on users(status);

create table if not exists clients (
  id               uuid primary key default gen_random_uuid(),
  collector_id     uuid not null references users(id),
  full_name        varchar(120) not null,
  cedula           varchar(30) not null unique,
  address          text not null,
  phone            varchar(30) not null,
  status           status_flag not null default 'ACTIVE',
  last_contact_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint clients_phone_not_blank check (btrim(phone) <> ''),
  constraint clients_cedula_not_blank check (btrim(cedula) <> '')
);

create index if not exists idx_clients_collector_id on clients(collector_id);
create index if not exists idx_clients_status on clients(status);

create table if not exists loans (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id),
  collector_id         uuid not null references users(id),
  base_amount          numeric(12,2) not null check (base_amount > 0),
  interest_rate        numeric(5,2) not null default 20.00 check (interest_rate = 20.00),
  total_amount         numeric(12,2) generated always as (round(base_amount * (1 + (interest_rate / 100.0)), 2)) stored,
  paid_amount          numeric(12,2) not null default 0.00 check (paid_amount >= 0),
  pending_amount       numeric(12,2) generated always as (greatest(total_amount - paid_amount, 0)) stored,
  status               loan_status not null default 'ACTIVE',
  renewed_from_loan_id uuid references loans(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  constraint loans_completed_has_timestamp check (
    (status = 'COMPLETED' and completed_at is not null)
    or status <> 'COMPLETED'
  )
);

create index if not exists idx_loans_client_id on loans(client_id);
create index if not exists idx_loans_collector_id on loans(collector_id);
create index if not exists idx_loans_status on loans(status);

-- At most one current loan (ACTIVE/RENEWED) per client.
create unique index if not exists uq_loans_one_open_per_client
  on loans(client_id)
  where status in ('ACTIVE', 'RENEWED');

create table if not exists payments (
  id                    uuid primary key default gen_random_uuid(),
  loan_id               uuid not null references loans(id),
  collector_id          uuid not null references users(id),
  registered_by_user_id uuid not null references users(id),
  amount                numeric(12,2) not null check (amount > 0),
  paid_at               timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists idx_payments_loan_id on payments(loan_id);
create index if not exists idx_payments_collector_id on payments(collector_id);
create index if not exists idx_payments_paid_at on payments(paid_at desc);

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  collector_id  uuid not null references users(id),
  category      varchar(80) not null,
  amount        numeric(12,2) not null check (amount > 0),
  description   text,
  spent_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_expenses_collector_id on expenses(collector_id);
create index if not exists idx_expenses_spent_at on expenses(spent_at desc);

create table if not exists daily_cash_closures (
  id                 uuid primary key default gen_random_uuid(),
  collector_id       uuid not null references users(id),
  business_date      date not null,
  total_collected    numeric(12,2) not null default 0.00,
  total_expenses     numeric(12,2) not null default 0.00,
  net_amount         numeric(12,2) generated always as (total_collected - total_expenses) stored,
  closed_at          timestamptz not null default now(),
  closed_by_user_id  uuid references users(id),
  is_auto_closed     boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint uq_daily_cash_closure unique (collector_id, business_date)
);

create index if not exists idx_daily_cash_closures_business_date on daily_cash_closures(business_date desc);
create index if not exists idx_daily_cash_closures_collector_id on daily_cash_closures(collector_id);

create table if not exists collector_activity (
  collector_id      uuid primary key references users(id),
  last_activity_at  timestamptz not null,
  last_action       varchar(120) not null,
  updated_at        timestamptz not null default now()
);

create table if not exists notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_user_id     uuid not null references users(id),
  type                  notification_type not null,
  title                 varchar(180) not null,
  message               text not null,
  payload               jsonb not null default '{}'::jsonb,
  related_collector_id  uuid references users(id),
  business_date         date,
  read_at               timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_read on notifications(recipient_user_id, read_at);
create index if not exists idx_notifications_created_at on notifications(created_at desc);

-- Avoid duplicated alerts for same admin + collector + day.
create unique index if not exists uq_notifications_unique_daily_alert
  on notifications(recipient_user_id, type, related_collector_id, business_date)
  where type in ('INACTIVITY_ALERT', 'AUTO_CLOSE_CONFIRMATION');

-- ============================================================
-- Seed base roles
-- ============================================================
insert into roles (code, name, description)
values
  ('ADMIN', 'admin', 'Acceso total y gestion de usuarios'),
  ('AUXILIAR', 'auxiliar', 'Dashboards y reportes'),
  ('COBRADOR', 'cobrador', 'Gestion de clientes, cobros, gastos y cierre')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- ============================================================
-- Utility functions
-- ============================================================
create or replace function fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function fn_business_date(p_ts timestamptz)
returns date
language sql
stable
as $$
  select (p_ts at time zone 'America/Bogota')::date;
$$;

create or replace function fn_role_code(p_user_id uuid)
returns app_role_code
language sql
stable
as $$
  select r.code
  from users u
  join roles r on r.id = u.role_id
  where u.id = p_user_id;
$$;

create or replace function fn_assert_cobrador(p_user_id uuid, p_entity_name text default 'entity')
returns void
language plpgsql
as $$
begin
  if fn_role_code(p_user_id) <> 'COBRADOR' then
    raise exception '% must belong to a COBRADOR user', p_entity_name;
  end if;
end;
$$;

create or replace function fn_current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function fn_current_role()
returns app_role_code
language sql
stable
as $$
  select nullif(current_setting('app.role', true), '')::app_role_code;
$$;

create or replace function fn_is_admin()
returns boolean
language sql
stable
as $$
  select fn_current_role() = 'ADMIN';
$$;

create or replace function fn_is_auxiliar()
returns boolean
language sql
stable
as $$
  select fn_current_role() = 'AUXILIAR';
$$;

create or replace function fn_is_cobrador()
returns boolean
language sql
stable
as $$
  select fn_current_role() = 'COBRADOR';
$$;

-- ============================================================
-- Validation triggers
-- ============================================================
create or replace function fn_validate_user_creator()
returns trigger
language plpgsql
as $$
declare
  new_role app_role_code;
begin
  select code into new_role from roles where id = new.role_id;

  if new_role is null then
    raise exception 'Invalid role_id for users record';
  end if;

  if new_role <> 'ADMIN' and new.created_by_admin_id is null then
    raise exception 'Non-admin users must be created by an admin user';
  end if;

  if new.created_by_admin_id is not null and fn_role_code(new.created_by_admin_id) <> 'ADMIN' then
    raise exception 'created_by_admin_id must belong to an admin user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on users;
create trigger trg_users_set_updated_at
before update on users
for each row execute function fn_set_updated_at();

drop trigger if exists trg_users_validate_creator on users;
create trigger trg_users_validate_creator
before insert or update on users
for each row execute function fn_validate_user_creator();

create or replace function fn_validate_client_collector()
returns trigger
language plpgsql
as $$
begin
  perform fn_assert_cobrador(new.collector_id, 'clients.collector_id');
  return new;
end;
$$;

drop trigger if exists trg_clients_set_updated_at on clients;
create trigger trg_clients_set_updated_at
before update on clients
for each row execute function fn_set_updated_at();

drop trigger if exists trg_clients_validate_collector on clients;
create trigger trg_clients_validate_collector
before insert or update on clients
for each row execute function fn_validate_client_collector();

create or replace function fn_validate_loan_integrity()
returns trigger
language plpgsql
as $$
declare
  v_client_collector uuid;
begin
  select collector_id into v_client_collector
  from clients
  where id = new.client_id;

  if v_client_collector is null then
    raise exception 'Loan client_id % does not exist', new.client_id;
  end if;

  if new.collector_id <> v_client_collector then
    raise exception 'loan.collector_id must match client.collector_id';
  end if;

  perform fn_assert_cobrador(new.collector_id, 'loans.collector_id');
  return new;
end;
$$;

drop trigger if exists trg_loans_set_updated_at on loans;
create trigger trg_loans_set_updated_at
before update on loans
for each row execute function fn_set_updated_at();

drop trigger if exists trg_loans_validate_integrity on loans;
create trigger trg_loans_validate_integrity
before insert or update on loans
for each row execute function fn_validate_loan_integrity();

create or replace function fn_validate_expense_collector()
returns trigger
language plpgsql
as $$
begin
  perform fn_assert_cobrador(new.collector_id, 'expenses.collector_id');
  return new;
end;
$$;

drop trigger if exists trg_expenses_validate_collector on expenses;
create trigger trg_expenses_validate_collector
before insert or update on expenses
for each row execute function fn_validate_expense_collector();

create or replace function fn_validate_payment()
returns trigger
language plpgsql
as $$
declare
  v_loan_collector uuid;
  v_total          numeric(12,2);
  v_existing_paid  numeric(12,2);
begin
  select collector_id, total_amount
    into v_loan_collector, v_total
  from loans
  where id = new.loan_id
  for update;

  if v_loan_collector is null then
    raise exception 'Payment loan_id % does not exist', new.loan_id;
  end if;

  new.collector_id := v_loan_collector;

  if new.registered_by_user_id <> new.collector_id then
    raise exception 'registered_by_user_id must match loan collector';
  end if;

  perform fn_assert_cobrador(new.registered_by_user_id, 'payments.registered_by_user_id');

  select coalesce(sum(amount), 0)
    into v_existing_paid
  from payments
  where loan_id = new.loan_id
    and (tg_op <> 'UPDATE' or id <> new.id);

  if v_existing_paid + new.amount > v_total then
    raise exception 'Payment exceeds pending loan balance';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_validate on payments;
create trigger trg_payments_validate
before insert or update on payments
for each row execute function fn_validate_payment();

create or replace function fn_recalculate_loan(p_loan_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric(12,2);
  v_paid  numeric(12,2);
  v_rem   numeric(12,2);
begin
  select total_amount into v_total
  from loans
  where id = p_loan_id
  for update;

  if v_total is null then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into v_paid
  from payments
  where loan_id = p_loan_id;

  v_rem := greatest(v_total - v_paid, 0);

  update loans
  set
    paid_amount = v_paid,
    status = case
      when v_rem = 0 then 'COMPLETED'
      when status = 'COMPLETED' and v_rem > 0 then 'ACTIVE'
      else status
    end,
    completed_at = case
      when v_rem = 0 then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_loan_id;
end;
$$;

create or replace function fn_recalculate_loan_from_payment()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform fn_recalculate_loan(new.loan_id);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform fn_recalculate_loan(old.loan_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_payments_recalculate_loan on payments;
create trigger trg_payments_recalculate_loan
after insert or update or delete on payments
for each row execute function fn_recalculate_loan_from_payment();

drop trigger if exists trg_daily_cash_closures_set_updated_at on daily_cash_closures;
create trigger trg_daily_cash_closures_set_updated_at
before update on daily_cash_closures
for each row execute function fn_set_updated_at();

drop trigger if exists trg_collector_activity_set_updated_at on collector_activity;
create trigger trg_collector_activity_set_updated_at
before update on collector_activity
for each row execute function fn_set_updated_at();

-- ============================================================
-- Business functions
-- ============================================================
create or replace function fn_touch_collector_activity(
  p_collector_id uuid,
  p_action text,
  p_activity_at timestamptz default now()
)
returns void
language plpgsql
as $$
begin
  perform fn_assert_cobrador(p_collector_id, 'collector_activity.collector_id');

  insert into collector_activity (collector_id, last_activity_at, last_action)
  values (p_collector_id, p_activity_at, left(coalesce(p_action, 'activity'), 120))
  on conflict (collector_id)
  do update set
    last_activity_at = excluded.last_activity_at,
    last_action = excluded.last_action,
    updated_at = now();
end;
$$;

create or replace function fn_close_cash_day(
  p_collector_id uuid,
  p_business_date date default fn_business_date(now()),
  p_closed_by_user_id uuid default null,
  p_is_auto_closed boolean default false,
  p_notes text default null
)
returns daily_cash_closures
language plpgsql
as $$
declare
  v_collected numeric(12,2);
  v_expenses  numeric(12,2);
  v_row       daily_cash_closures;
begin
  perform fn_assert_cobrador(p_collector_id, 'daily_cash_closures.collector_id');

  select coalesce(sum(amount), 0)
    into v_collected
  from payments
  where collector_id = p_collector_id
    and fn_business_date(paid_at) = p_business_date;

  select coalesce(sum(amount), 0)
    into v_expenses
  from expenses
  where collector_id = p_collector_id
    and fn_business_date(spent_at) = p_business_date;

  insert into daily_cash_closures (
    collector_id,
    business_date,
    total_collected,
    total_expenses,
    closed_at,
    closed_by_user_id,
    is_auto_closed,
    notes
  )
  values (
    p_collector_id,
    p_business_date,
    v_collected,
    v_expenses,
    now(),
    p_closed_by_user_id,
    p_is_auto_closed,
    p_notes
  )
  on conflict (collector_id, business_date)
  do update set
    total_collected = excluded.total_collected,
    total_expenses = excluded.total_expenses,
    closed_at = excluded.closed_at,
    closed_by_user_id = excluded.closed_by_user_id,
    is_auto_closed = excluded.is_auto_closed,
    notes = excluded.notes,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function fn_admin_ids()
returns table (admin_id uuid)
language sql
stable
as $$
  select u.id
  from users u
  join roles r on r.id = u.role_id
  where r.code = 'ADMIN'
    and u.status = 'ACTIVE';
$$;

create or replace function fn_auto_close_previous_day(
  p_reference timestamptz default now()
)
returns integer
language plpgsql
as $$
declare
  v_business_date date := fn_business_date(p_reference) - 1;
  v_collector record;
  v_admin record;
  v_count integer := 0;
begin
  for v_collector in
    select u.id, u.full_name
    from users u
    join roles r on r.id = u.role_id
    where r.code = 'COBRADOR'
      and u.status = 'ACTIVE'
      and not exists (
        select 1
        from daily_cash_closures d
        where d.collector_id = u.id
          and d.business_date = v_business_date
      )
  loop
    perform fn_close_cash_day(
      v_collector.id,
      v_business_date,
      null,
      true,
      'Auto-cierre por medianoche'
    );
    v_count := v_count + 1;

    for v_admin in select admin_id from fn_admin_ids()
    loop
      insert into notifications (
        recipient_user_id,
        type,
        title,
        message,
        related_collector_id,
        business_date,
        payload
      )
      values (
        v_admin.admin_id,
        'AUTO_CLOSE_CONFIRMATION',
        'Cierre automatico generado',
        format(
          'Se ejecuto cierre automatico para %s en la fecha %s',
          v_collector.full_name,
          v_business_date::text
        ),
        v_collector.id,
        v_business_date,
        jsonb_build_object(
          'collectorId', v_collector.id,
          'collectorName', v_collector.full_name,
          'businessDate', v_business_date::text
        )
      )
      on conflict do nothing;
    end loop;
  end loop;

  return v_count;
end;
$$;

create or replace function fn_emit_inactivity_alerts(
  p_reference timestamptz default now()
)
returns integer
language plpgsql
as $$
declare
  v_today date := fn_business_date(p_reference);
  v_start_today timestamptz :=
    (v_today::timestamp at time zone 'America/Bogota') + interval '8 hours';
  v_collector record;
  v_last_activity timestamptz;
  v_effective_last timestamptz;
  v_admin record;
  v_count integer := 0;
begin
  -- No alerts before 08:00 local time.
  if (p_reference at time zone 'America/Bogota')::time < time '08:00' then
    return 0;
  end if;

  for v_collector in
    select u.id, u.full_name
    from users u
    join roles r on r.id = u.role_id
    where r.code = 'COBRADOR'
      and u.status = 'ACTIVE'
      and not exists (
        select 1
        from daily_cash_closures d
        where d.collector_id = u.id
          and d.business_date = v_today
      )
  loop
    select a.last_activity_at
      into v_last_activity
    from collector_activity a
    where a.collector_id = v_collector.id;

    v_effective_last := greatest(coalesce(v_last_activity, v_start_today), v_start_today);

    if p_reference - v_effective_last > interval '3 hours' then
      for v_admin in select admin_id from fn_admin_ids()
      loop
        insert into notifications (
          recipient_user_id,
          type,
          title,
          message,
          related_collector_id,
          business_date,
          payload
        )
        values (
          v_admin.admin_id,
          'INACTIVITY_ALERT',
          'Alerta de inactividad',
          format(
            'El cobrador %s supera 3 horas sin actividad en jornada activa',
            v_collector.full_name
          ),
          v_collector.id,
          v_today,
          jsonb_build_object(
            'collectorId', v_collector.id,
            'collectorName', v_collector.full_name,
            'lastActivityAt', v_last_activity
          )
        )
        on conflict do nothing;
      end loop;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- Session context required per request:
--   set local app.user_id = '<uuid>';
--   set local app.role    = 'ADMIN'|'AUXILIAR'|'COBRADOR';
-- ============================================================
alter table users enable row level security;
alter table clients enable row level security;
alter table loans enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table daily_cash_closures enable row level security;
alter table collector_activity enable row level security;
alter table notifications enable row level security;

-- USERS
drop policy if exists p_users_select on users;
create policy p_users_select on users
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and id = fn_current_user_id())
);

drop policy if exists p_users_insert on users;
create policy p_users_insert on users
for insert
with check (fn_is_admin());

drop policy if exists p_users_update on users;
create policy p_users_update on users
for update
using (fn_is_admin())
with check (fn_is_admin());

drop policy if exists p_users_delete on users;
create policy p_users_delete on users
for delete
using (fn_is_admin());

-- CLIENTS
drop policy if exists p_clients_select on clients;
create policy p_clients_select on clients
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_clients_insert on clients;
create policy p_clients_insert on clients
for insert
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_clients_update on clients;
create policy p_clients_update on clients
for update
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
)
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_clients_delete on clients;
create policy p_clients_delete on clients
for delete
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

-- LOANS
drop policy if exists p_loans_select on loans;
create policy p_loans_select on loans
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_loans_insert on loans;
create policy p_loans_insert on loans
for insert
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_loans_update on loans;
create policy p_loans_update on loans
for update
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
)
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_loans_delete on loans;
create policy p_loans_delete on loans
for delete
using (fn_is_admin());

-- PAYMENTS
drop policy if exists p_payments_select on payments;
create policy p_payments_select on payments
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_payments_insert on payments;
create policy p_payments_insert on payments
for insert
with check (
  fn_is_admin()
  or (
    fn_is_cobrador()
    and collector_id = fn_current_user_id()
    and registered_by_user_id = fn_current_user_id()
  )
);

drop policy if exists p_payments_update on payments;
create policy p_payments_update on payments
for update
using (fn_is_admin())
with check (fn_is_admin());

drop policy if exists p_payments_delete on payments;
create policy p_payments_delete on payments
for delete
using (fn_is_admin());

-- EXPENSES
drop policy if exists p_expenses_select on expenses;
create policy p_expenses_select on expenses
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_expenses_insert on expenses;
create policy p_expenses_insert on expenses
for insert
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_expenses_update on expenses;
create policy p_expenses_update on expenses
for update
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
)
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_expenses_delete on expenses;
create policy p_expenses_delete on expenses
for delete
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

-- DAILY CLOSURES
drop policy if exists p_daily_cash_closures_select on daily_cash_closures;
create policy p_daily_cash_closures_select on daily_cash_closures
for select
using (
  fn_is_admin()
  or fn_is_auxiliar()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_daily_cash_closures_insert on daily_cash_closures;
create policy p_daily_cash_closures_insert on daily_cash_closures
for insert
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_daily_cash_closures_update on daily_cash_closures;
create policy p_daily_cash_closures_update on daily_cash_closures
for update
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
)
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_daily_cash_closures_delete on daily_cash_closures;
create policy p_daily_cash_closures_delete on daily_cash_closures
for delete
using (fn_is_admin());

-- COLLECTOR ACTIVITY
drop policy if exists p_collector_activity_select on collector_activity;
create policy p_collector_activity_select on collector_activity
for select
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_collector_activity_insert on collector_activity;
create policy p_collector_activity_insert on collector_activity
for insert
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_collector_activity_update on collector_activity;
create policy p_collector_activity_update on collector_activity
for update
using (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
)
with check (
  fn_is_admin()
  or (fn_is_cobrador() and collector_id = fn_current_user_id())
);

drop policy if exists p_collector_activity_delete on collector_activity;
create policy p_collector_activity_delete on collector_activity
for delete
using (fn_is_admin());

-- NOTIFICATIONS
drop policy if exists p_notifications_select on notifications;
create policy p_notifications_select on notifications
for select
using (
  fn_is_admin()
  or recipient_user_id = fn_current_user_id()
);

drop policy if exists p_notifications_insert on notifications;
create policy p_notifications_insert on notifications
for insert
with check (fn_is_admin());

drop policy if exists p_notifications_update on notifications;
create policy p_notifications_update on notifications
for update
using (
  fn_is_admin()
  or recipient_user_id = fn_current_user_id()
)
with check (
  fn_is_admin()
  or recipient_user_id = fn_current_user_id()
);

drop policy if exists p_notifications_delete on notifications;
create policy p_notifications_delete on notifications
for delete
using (fn_is_admin());

commit;

-- ============================================================
-- Operational notes
-- ============================================================
-- 1) Manual daily close:
--    select fn_close_cash_day('<collector_uuid>', current_date, '<user_uuid>', false);
--
-- 2) Midnight auto-close job (run once after 00:00):
--    select fn_auto_close_previous_day(now());
--
-- 3) Inactivity alerts job (run every 15 minutes):
--    select fn_emit_inactivity_alerts(now());
--
-- 4) On each authenticated request, set session context before queries:
--    set local app.user_id = '<authenticated_user_uuid>';
--    set local app.role = 'ADMIN'|'AUXILIAR'|'COBRADOR';
