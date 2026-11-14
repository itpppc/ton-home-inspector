-- Phase 2: room management + general/engineering scope. Items/defects keep `location` as a text snapshot; room_id links to the room.
create table public.rooms (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  floor text check (char_length(floor) <= 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index rooms_property_idx on public.rooms (property_id, sort_order);
create index rooms_sync_idx on public.rooms (project_id, server_updated_at);

create type public.inspection_scope as enum ('GENERAL', 'ENGINEERING');
-- ENGINEERING = screening only; findings must be confirmed by a licensed engineer (the app never certifies safety).
alter table public.checklist_items add column scope public.inspection_scope not null default 'GENERAL';
alter table public.defects add column requires_engineer boolean not null default false;

alter table public.checklist_items add column room_id uuid references public.rooms (id) on delete set null;
alter table public.defects add column room_id uuid references public.rooms (id) on delete set null;
create index checklist_items_room_idx on public.checklist_items (room_id);
create index defects_room_idx on public.defects (room_id);

create trigger set_server_updated_at before insert or update on public.rooms
  for each row execute function public.set_server_updated_at();

-- Extend consistency check: rooms belong to the property's project; room_id must be in the same property.
create or replace function public.check_project_consistency()
returns trigger language plpgsql set search_path = '' as $$
declare parent_project uuid;
begin
  if tg_table_name = 'properties' then
    return new;
  elsif tg_table_name in ('checklist_categories', 'defects', 'photos', 'rooms') then
    select p.project_id into parent_project from public.properties p where p.id = new.property_id;
  elsif tg_table_name = 'checklist_items' then
    select c.project_id into parent_project from public.checklist_categories c where c.id = new.category_id and c.property_id = new.property_id;
  elsif tg_table_name = 'defect_events' then
    select d.project_id into parent_project from public.defects d where d.id = new.defect_id;
  end if;
  if parent_project is null or parent_project <> new.project_id then
    raise exception '% row % has inconsistent project_id', tg_table_name, new.id using errcode = '23514';
  end if;
  -- Nested IF: NEW.room_id only exists on these two tables (PL/pgSQL does not short-circuit field access).
  if tg_table_name in ('checklist_items', 'defects') then
    if new.room_id is not null and not exists (select 1 from public.rooms r where r.id = new.room_id and r.property_id = new.property_id) then
      raise exception '% row % references a room of another property', tg_table_name, new.id using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger check_project_consistency before insert or update of project_id, property_id on public.rooms
  for each row execute function public.check_project_consistency();
drop trigger check_project_consistency on public.checklist_items;
create trigger check_project_consistency before insert or update of project_id, property_id, category_id, room_id on public.checklist_items
  for each row execute function public.check_project_consistency();
drop trigger check_project_consistency on public.defects;
create trigger check_project_consistency before insert or update of project_id, property_id, room_id on public.defects
  for each row execute function public.check_project_consistency();

alter table public.rooms enable row level security;
create policy rooms_select on public.rooms for select to authenticated using (private.is_project_member(project_id));
create policy rooms_insert on public.rooms for insert to authenticated with check (private.can_edit(project_id));
create policy rooms_update on public.rooms for update to authenticated using (private.can_edit(project_id)) with check (private.can_edit(project_id));
create policy rooms_delete on public.rooms for delete to authenticated using (private.is_project_admin(project_id));
