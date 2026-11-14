-- TON Home Inspector — core schema
-- Conventions: client-generated uuid PKs, soft delete (deleted_at), LWW via updated_at,
-- pull cursor via server_updated_at (set by trigger), project_id on every child row for RLS.

create extension if not exists pgcrypto with schema extensions;

-- ───────────── Enums ─────────────
create type public.app_role as enum ('ADMIN', 'INSPECTOR', 'VIEWER');
create type public.item_status as enum ('NOT_CHECKED', 'PASS', 'FAIL', 'NEEDS_REINSPECTION', 'NOT_APPLICABLE');
create type public.priority_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.severity_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.defect_status as enum ('OPEN', 'SUBMITTED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'REOPENED');
create type public.construction_status as enum ('UNDER_CONSTRUCTION', 'READY_FOR_INSPECTION', 'INSPECTING', 'DEFECT_FIXING', 'READY_TO_TRANSFER', 'TRANSFERRED');
create type public.photo_kind as enum ('DEFECT', 'AFTER_FIX', 'ITEM');

-- ───────────── Shared trigger functions ─────────────
create or replace function public.set_server_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

-- ───────────── profiles ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  role public.app_role not null default 'INSPECTOR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their name but never their own role (service role / SQL editor bypasses).
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Changing role is not allowed' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or (new.email is distinct from old.email and auth.uid() is not null) then
    raise exception 'Changing id/email is not allowed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ───────────── projects ─────────────
create table public.projects (
  id uuid primary key,
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  developer text check (char_length(developer) <= 200),
  developer_contact text check (char_length(developer_contact) <= 300),
  location text check (char_length(location) <= 500),
  description text check (char_length(description) <= 2000),
  inspection_date date,
  reinspection_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── project_members ─────────────
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, new.owner_id, 'ADMIN')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end $$;

create trigger add_owner_membership
  after insert on public.projects
  for each row execute function public.add_owner_membership();

-- ───────────── properties ─────────────
create table public.properties (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  plot_number text check (char_length(plot_number) <= 100),
  house_model text check (char_length(house_model) <= 100),
  property_type text check (char_length(property_type) <= 100),
  land_area_sqw numeric(10, 2) check (land_area_sqw >= 0),
  usable_area_sqm numeric(10, 2) check (usable_area_sqm >= 0),
  floors smallint check (floors between 1 and 10),
  construction_status public.construction_status not null default 'READY_FOR_INSPECTION',
  inspection_type text check (char_length(inspection_type) <= 100),
  inspection_owner text check (char_length(inspection_owner) <= 100),
  transfer_date_planned date,
  transfer_date_actual date,
  claim_window_days smallint not null default 15 check (claim_window_days between 1 and 365),
  warranty_info text check (char_length(warranty_info) <= 2000),
  price numeric(14, 2) check (price >= 0),
  booking_fee numeric(14, 2) check (booking_fee >= 0),
  cashback numeric(14, 2) check (cashback >= 0),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index properties_project_idx on public.properties (project_id, server_updated_at);

-- ───────────── checklist ─────────────
create table public.checklist_categories (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index checklist_categories_property_idx on public.checklist_categories (property_id, sort_order);
create index checklist_categories_sync_idx on public.checklist_categories (project_id, server_updated_at);

create table public.checklist_items (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  category_id uuid not null references public.checklist_categories (id) on delete cascade,
  code text not null default '' check (char_length(code) <= 30),
  location text check (char_length(location) <= 200),
  title text not null check (char_length(title) between 1 and 300),
  description text check (char_length(description) <= 2000),
  method text check (char_length(method) <= 2000),
  acceptance_criteria text check (char_length(acceptance_criteria) <= 2000),
  priority public.priority_level not null default 'MEDIUM',
  sort_order integer not null default 0,
  status public.item_status not null default 'NOT_CHECKED',
  note text check (char_length(note) <= 2000),
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index checklist_items_category_idx on public.checklist_items (category_id, sort_order);
create index checklist_items_status_idx on public.checklist_items (property_id, status) where deleted_at is null;
create index checklist_items_sync_idx on public.checklist_items (project_id, server_updated_at);
create index checklist_items_checked_by_idx on public.checklist_items (checked_by);

-- ───────────── defects ─────────────
create table public.defects (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  item_id uuid references public.checklist_items (id) on delete set null,
  code text not null check (char_length(code) between 1 and 30),
  title text not null check (char_length(title) between 1 and 300),
  description text check (char_length(description) <= 3000),
  category text check (char_length(category) <= 200),
  location text check (char_length(location) <= 200),
  severity public.severity_level not null,
  status public.defect_status not null default 'OPEN',
  recommendation text check (char_length(recommendation) <= 2000),
  found_at timestamptz not null default now(),
  due_date date,
  fixed_at timestamptz,
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index defects_code_unique on public.defects (property_id, code) where deleted_at is null;
create index defects_property_idx on public.defects (property_id, status, severity);
create index defects_item_idx on public.defects (item_id);
create index defects_sync_idx on public.defects (project_id, server_updated_at);
create index defects_created_by_idx on public.defects (created_by);

create table public.defect_events (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  defect_id uuid not null references public.defects (id) on delete cascade,
  from_status public.defect_status,
  to_status public.defect_status not null,
  note text check (char_length(note) <= 2000),
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index defect_events_defect_idx on public.defect_events (defect_id, created_at);
create index defect_events_sync_idx on public.defect_events (project_id, server_updated_at);
create index defect_events_actor_idx on public.defect_events (actor);

-- ───────────── photos ─────────────
create table public.photos (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  defect_id uuid references public.defects (id) on delete cascade,
  item_id uuid references public.checklist_items (id) on delete cascade,
  kind public.photo_kind not null,
  caption text check (char_length(caption) <= 500),
  storage_path text check (char_length(storage_path) <= 300),
  width integer check (width > 0),
  height integer check (height > 0),
  size_bytes integer check (size_bytes >= 0),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint photos_has_parent check (defect_id is not null or item_id is not null)
);
create index photos_defect_idx on public.photos (defect_id);
create index photos_item_idx on public.photos (item_id);
create index photos_property_idx on public.photos (property_id);
create index photos_sync_idx on public.photos (project_id, server_updated_at);

create index projects_sync_idx on public.projects (server_updated_at);
create index projects_owner_idx on public.projects (owner_id);

-- server_updated_at on every synced table
do $$
declare t text;
begin
  foreach t in array array['projects','properties','checklist_categories','checklist_items','defects','defect_events','photos'] loop
    execute format('create trigger set_server_updated_at before insert or update on public.%I for each row execute function public.set_server_updated_at()', t);
  end loop;
end $$;

-- ───────────── Consistency: child.project_id must match its parent ─────────────
create or replace function public.check_project_consistency()
returns trigger language plpgsql set search_path = '' as $$
declare parent_project uuid;
begin
  if tg_table_name = 'properties' then
    return new;
  elsif tg_table_name in ('checklist_categories', 'defects', 'photos') then
    select p.project_id into parent_project from public.properties p where p.id = new.property_id;
  elsif tg_table_name = 'checklist_items' then
    select c.project_id into parent_project from public.checklist_categories c where c.id = new.category_id and c.property_id = new.property_id;
  elsif tg_table_name = 'defect_events' then
    select d.project_id into parent_project from public.defects d where d.id = new.defect_id;
  end if;
  if parent_project is null or parent_project <> new.project_id then
    raise exception '% row % has inconsistent project_id', tg_table_name, new.id using errcode = '23514';
  end if;
  return new;
end $$;

create trigger check_project_consistency before insert or update of project_id, property_id on public.checklist_categories
  for each row execute function public.check_project_consistency();
create trigger check_project_consistency before insert or update of project_id, property_id, category_id on public.checklist_items
  for each row execute function public.check_project_consistency();
create trigger check_project_consistency before insert or update of project_id, property_id on public.defects
  for each row execute function public.check_project_consistency();
create trigger check_project_consistency before insert or update of project_id, defect_id on public.defect_events
  for each row execute function public.check_project_consistency();
create trigger check_project_consistency before insert or update of project_id, property_id on public.photos
  for each row execute function public.check_project_consistency();

-- Deadline view for reporting (computed, not stored).
create view public.property_deadlines with (security_invoker = true) as
select id, project_id, transfer_date_planned, transfer_date_actual, claim_window_days,
       transfer_date_actual + claim_window_days as claim_deadline
from public.properties
where deleted_at is null;
