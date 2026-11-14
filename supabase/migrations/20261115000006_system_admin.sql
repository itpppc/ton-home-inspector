-- System administration: a global ADMIN (profiles.role) can list every account, change roles and
-- suspend accounts. Customer project DATA stays private — the admin sees counts, never content.

alter table public.profiles add column disabled_at timestamptz;

create or replace function private.is_system_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'ADMIN' and p.disabled_at is null)
$$;

create or replace function private.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.disabled_at is null)
$$;

-- A suspended account loses access to every project (data stays; restoring the account restores access).
create or replace function private.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()))
$$;

create or replace function private.can_edit(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()) and m.role in ('ADMIN', 'INSPECTOR'))
$$;

create or replace function private.is_project_admin(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = (select auth.uid()) and m.role = 'ADMIN')
$$;

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (private.is_project_member(id) or (owner_id = (select auth.uid()) and private.is_active()));
drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (
    (owner_id = (select auth.uid()) and private.is_active() and coalesce(private.global_role(), 'INSPECTOR') <> 'VIEWER')
    or private.can_edit(id)
  );

revoke all on function private.is_system_admin() from public;
revoke all on function private.is_active() from public;
grant execute on function private.is_system_admin() to authenticated;
grant execute on function private.is_active() to authenticated;

-- Role / suspension can be changed only by the SQL editor or by a system admin acting on SOMEONE ELSE
-- (an admin cannot demote or suspend themself, so the system always keeps at least one admin).
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if (new.role is distinct from old.role or new.disabled_at is distinct from old.disabled_at)
     and caller is not null and not (private.is_system_admin() and new.id <> caller) then
    raise exception 'Changing role is not allowed' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or (new.email is distinct from old.email and caller is not null) then
    raise exception 'Changing id/email is not allowed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ───────────── Admin RPCs ─────────────
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, full_name text, role public.app_role, created_at timestamptz,
  last_sign_in_at timestamptz, disabled_at timestamptz, project_count int, property_count int
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_system_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role, p.created_at, u.last_sign_in_at, p.disabled_at,
      (select count(*)::int from public.projects pr where pr.owner_id = p.id and pr.deleted_at is null),
      (select count(*)::int from public.properties h join public.projects pr on pr.id = h.project_id
        where pr.owner_id = p.id and h.deleted_at is null and pr.deleted_at is null)
    from public.profiles p left join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

create or replace function public.admin_set_user_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_system_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'ไม่พบผู้ใช้' using errcode = 'P0002'; end if;
end $$;

create or replace function public.admin_set_user_disabled(p_user uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_system_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'ระงับบัญชีของตัวเองไม่ได้' using errcode = '42501';
  end if;
  update public.profiles set disabled_at = case when p_disabled then coalesce(disabled_at, now()) else null end where id = p_user;
  if not found then raise exception 'ไม่พบผู้ใช้' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_user_role(uuid, public.app_role) from public, anon;
revoke all on function public.admin_set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
