-- TON Home Inspector — Row Level Security
-- Helpers live in a non-exposed schema so they are not callable through the REST API.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.project_role(pid uuid)
returns public.app_role language sql stable security definer set search_path = '' as $$
  select m.role from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid())
$$;

create or replace function private.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()))
$$;

create or replace function private.can_edit(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()) and m.role in ('ADMIN', 'INSPECTOR'))
$$;

create or replace function private.is_project_admin(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()) and m.role = 'ADMIN')
$$;

create or replace function private.global_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function private.shares_project_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members a
    join public.project_members b on a.project_id = b.project_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  )
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ───────────── Guards that RLS alone cannot express ─────────────

-- owner_id is immutable once set; soft delete/restore of projects & properties is ADMIN-only.
create or replace function private.guard_project_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if; -- service role / SQL editor
  if old.owner_id is not null and new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at and not private.is_project_admin(old.id) then
    raise exception 'Only project admins can delete or restore a project' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_project_update before update on public.projects
  for each row execute function private.guard_project_update();

create or replace function private.guard_property_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.deleted_at is distinct from old.deleted_at and not private.is_project_admin(old.project_id) then
    raise exception 'Only project admins can delete or restore a property' using errcode = '42501';
  end if;
  if new.project_id <> old.project_id then
    raise exception 'Moving a property to another project is not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_property_delete before update on public.properties
  for each row execute function private.guard_property_delete();

-- Every project keeps at least one ADMIN.
create or replace function private.guard_last_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role = 'ADMIN' and (tg_op = 'DELETE' or new.role <> 'ADMIN') then
    if not exists (select 1 from public.project_members m where m.project_id = old.project_id and m.role = 'ADMIN' and m.user_id <> old.user_id)
       and exists (select 1 from public.projects p where p.id = old.project_id) then
      raise exception 'A project must keep at least one admin' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_last_admin before update or delete on public.project_members
  for each row execute function private.guard_last_admin();

-- ───────────── Enable RLS ─────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.properties enable row level security;
alter table public.checklist_categories enable row level security;
alter table public.checklist_items enable row level security;
alter table public.defects enable row level security;
alter table public.defect_events enable row level security;
alter table public.photos enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_project_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- projects (INSERT also covers upserts of existing rows by editors)
create policy projects_select on public.projects for select to authenticated
  using (private.is_project_member(id) or owner_id = (select auth.uid()));
create policy projects_insert on public.projects for insert to authenticated
  with check (
    (owner_id = (select auth.uid()) and coalesce(private.global_role(), 'INSPECTOR') <> 'VIEWER')
    or private.can_edit(id)
  );
create policy projects_update on public.projects for update to authenticated
  using (private.can_edit(id)) with check (private.can_edit(id));
create policy projects_delete on public.projects for delete to authenticated
  using (private.is_project_admin(id));

-- project_members
create policy members_select on public.project_members for select to authenticated
  using (private.is_project_member(project_id));
create policy members_insert on public.project_members for insert to authenticated
  with check (private.is_project_admin(project_id));
create policy members_update on public.project_members for update to authenticated
  using (private.is_project_admin(project_id)) with check (private.is_project_admin(project_id));
create policy members_delete on public.project_members for delete to authenticated
  using (private.is_project_admin(project_id) or user_id = (select auth.uid()));

-- child tables: members read, editors write, admins hard-delete
do $$
declare t text;
begin
  foreach t in array array['properties','checklist_categories','checklist_items','defects','photos'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (private.is_project_member(project_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.can_edit(project_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (private.can_edit(project_id)) with check (private.can_edit(project_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (private.is_project_admin(project_id))', t);
  end loop;
end $$;

-- defect_events: append-only audit trail. Upsert of an identical row (sync retry) is allowed
-- through the insert path; updates are blocked by the absence of an update policy except no-op retries.
create policy defect_events_select on public.defect_events for select to authenticated
  using (private.is_project_member(project_id));
create policy defect_events_insert on public.defect_events for insert to authenticated
  with check (private.can_edit(project_id));
create policy defect_events_update on public.defect_events for update to authenticated
  using (private.can_edit(project_id)) with check (private.can_edit(project_id));

create or replace function private.guard_event_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (new.to_status, new.from_status, new.note, new.defect_id, new.actor)
     is distinct from (old.to_status, old.from_status, old.note, old.defect_id, old.actor) then
    raise exception 'defect_events are append-only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_event_immutable before update on public.defect_events
  for each row execute function private.guard_event_immutable();

-- ───────────── RPC: invite member by email (ADMIN only) ─────────────
create or replace function public.add_project_member(p_project_id uuid, p_email text, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not private.is_project_admin(p_project_id) then
    raise exception 'เฉพาะ Admin ของโครงการเท่านั้น' using errcode = '42501';
  end if;
  select p.id into target from public.profiles p where lower(p.email) = lower(trim(p_email));
  if target is null then
    raise exception 'ไม่พบผู้ใช้ที่ใช้อีเมลนี้ (ต้องสมัครสมาชิกก่อน)' using errcode = 'P0002';
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, target, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
end $$;

revoke all on function public.add_project_member(uuid, text, public.app_role) from public, anon;
grant execute on function public.add_project_member(uuid, text, public.app_role) to authenticated;

-- Internal trigger functions must not be callable via the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_owner_membership() from public, anon, authenticated;
