-- Membership plans (V4.0 Commercial step 2): FREE / PRO / BUSINESS with server-enforced quotas.
-- Limits live in a table so prices/quotas can change without a deploy. NULL limit = unlimited.
-- System ADMIN accounts are always unlimited. An expired paid plan falls back to FREE (data is kept,
-- only NEW projects/houses/members are blocked).

create type public.plan_tier as enum ('FREE', 'PRO', 'BUSINESS');

create table public.plans (
  tier public.plan_tier primary key,
  name text not null,
  description text not null default '',
  price_thb_month integer not null default 0 check (price_thb_month >= 0),
  max_projects integer check (max_projects > 0),
  max_properties integer check (max_properties > 0),
  max_members integer check (max_members > 0),
  features text[] not null default '{}',
  sort_order integer not null default 0
);

insert into public.plans (tier, name, description, price_thb_month, max_projects, max_properties, max_members, features, sort_order) values
  ('FREE', 'Free', 'ผู้ซื้อบ้านที่ตรวจบ้านของตัวเอง 1 หลัง', 0, 1, 1, 2,
    array['ตรวจบ้าน 1 หลัง', 'Checklist มาตรฐาน 180+ รายการ', 'ถ่ายรูป / Defect / ตรวจซ้ำ', 'ใช้งานออฟไลน์', 'รายงาน PDF และ Excel', 'แชร์ให้ผู้ร่วมดู 1 คน'], 1),
  ('PRO', 'Pro', 'นักลงทุน / ผู้ซื้อหลายหลัง / นายหน้า', 199, 5, 10, 5,
    array['สูงสุด 5 โครงการ 10 หลัง', 'ทุกอย่างใน Free', 'ทีมร่วมโครงการได้ 5 คน', 'สำรองข้อมูลบน Cloud'], 2),
  ('BUSINESS', 'Business', 'บริษัทรับตรวจบ้าน / ผู้รับเหมา / นิติบุคคล', 990, null, null, 50,
    array['โครงการและบ้านไม่จำกัด', 'ทีมผู้ตรวจได้ 50 คนต่อโครงการ', 'สิทธิ์ Admin / Inspector / Viewer', 'รายงานแบรนด์ TON AI สำหรับลูกค้า'], 3);

alter table public.plans enable row level security;
create policy plans_select on public.plans for select to anon, authenticated using (true);

alter table public.profiles
  add column plan public.plan_tier not null default 'FREE',
  add column plan_expires_at timestamptz;

-- Plan/expiry are admin-only, like role and suspension.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if (new.role is distinct from old.role or new.disabled_at is distinct from old.disabled_at
      or new.plan is distinct from old.plan or new.plan_expires_at is distinct from old.plan_expires_at)
     and caller is not null and not (private.is_system_admin() and new.id <> caller) then
    raise exception 'Changing role is not allowed' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or (new.email is distinct from old.email and caller is not null) then
    raise exception 'Changing id/email is not allowed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Effective plan for a user: ADMIN → unlimited BUSINESS; expired paid plan → FREE.
create or replace function private.effective_plan(uid uuid)
returns table (tier public.plan_tier, max_projects integer, max_properties integer, max_members integer)
language sql stable security definer set search_path = '' as $$
  select pl.tier,
    case when p.role = 'ADMIN' then null else pl.max_projects end,
    case when p.role = 'ADMIN' then null else pl.max_properties end,
    case when p.role = 'ADMIN' then null else pl.max_members end
  from public.profiles p
  join public.plans pl on pl.tier = case
    when p.role = 'ADMIN' then 'BUSINESS'::public.plan_tier
    when p.plan <> 'FREE' and (p.plan_expires_at is null or p.plan_expires_at > now()) then p.plan
    else 'FREE'::public.plan_tier end
  where p.id = uid
$$;

create or replace function private.owned_usage(uid uuid)
returns table (projects integer, properties integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.projects pr where pr.owner_id = uid and pr.deleted_at is null),
    (select count(*)::int from public.properties h join public.projects pr on pr.id = h.project_id
      where pr.owner_id = uid and h.deleted_at is null and pr.deleted_at is null)
$$;

-- BEFORE INSERT also fires for sync upserts of rows that already exist: those are never counted as new.
create or replace function private.enforce_plan_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid; lim record; used record; n integer;
begin
  if tg_table_name = 'projects' then
    if exists (select 1 from public.projects x where x.id = new.id) or new.owner_id is null then return new; end if;
    owner := new.owner_id;
  elsif tg_table_name = 'properties' then
    if exists (select 1 from public.properties x where x.id = new.id) then return new; end if;
    select pr.owner_id into owner from public.projects pr where pr.id = new.project_id;
  else -- project_members
    if exists (select 1 from public.project_members x where x.project_id = new.project_id and x.user_id = new.user_id) then return new; end if;
    select pr.owner_id into owner from public.projects pr where pr.id = new.project_id;
  end if;
  if owner is null then return new; end if;

  select * into lim from private.effective_plan(owner);
  if not found then return new; end if;
  select * into used from private.owned_usage(owner);

  if tg_table_name = 'projects' and lim.max_projects is not null and used.projects >= lim.max_projects then
    raise exception 'PLAN_LIMIT:projects:%', lim.max_projects using errcode = 'P0001',
      hint = 'แพ็กเกจปัจจุบันสร้างโครงการได้สูงสุด ' || lim.max_projects || ' โครงการ';
  elsif tg_table_name = 'properties' and lim.max_properties is not null and used.properties >= lim.max_properties then
    raise exception 'PLAN_LIMIT:properties:%', lim.max_properties using errcode = 'P0001',
      hint = 'แพ็กเกจปัจจุบันเพิ่มบ้านได้สูงสุด ' || lim.max_properties || ' หลัง';
  elsif tg_table_name = 'project_members' and lim.max_members is not null then
    select count(*)::int into n from public.project_members m where m.project_id = new.project_id;
    if n >= lim.max_members then
      raise exception 'PLAN_LIMIT:members:%', lim.max_members using errcode = 'P0001',
        hint = 'แพ็กเกจปัจจุบันมีสมาชิกต่อโครงการได้สูงสุด ' || lim.max_members || ' คน';
    end if;
  end if;
  return new;
end $$;

create trigger enforce_plan_limits before insert on public.projects
  for each row execute function private.enforce_plan_limits();
create trigger enforce_plan_limits before insert on public.properties
  for each row execute function private.enforce_plan_limits();
create trigger enforce_plan_limits before insert on public.project_members
  for each row execute function private.enforce_plan_limits();

revoke all on function private.effective_plan(uuid) from public;
revoke all on function private.owned_usage(uuid) from public;
revoke all on function private.enforce_plan_limits() from public;

-- ───────────── RPCs ─────────────
-- The signed-in user's plan, limits and usage (drives the Plans page and the create-buttons).
create or replace function public.my_plan()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'plan', p.plan, 'plan_expires_at', p.plan_expires_at,
    'effective', e.tier, 'unlimited', p.role = 'ADMIN',
    'max_projects', e.max_projects, 'max_properties', e.max_properties, 'max_members', e.max_members,
    'projects', u.projects, 'properties', u.properties)
  from public.profiles p, private.effective_plan(p.id) e, private.owned_usage(p.id) u
  where p.id = (select auth.uid())
$$;

create or replace function public.admin_set_user_plan(p_user uuid, p_tier public.plan_tier, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_system_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'เปลี่ยนแพ็กเกจของตัวเองไม่ได้ (Admin ใช้งานได้ไม่จำกัดอยู่แล้ว)' using errcode = '42501';
  end if;
  update public.profiles
    set plan = p_tier, plan_expires_at = case when p_tier = 'FREE' then null else p_expires_at end
    where id = p_user;
  if not found then raise exception 'ไม่พบผู้ใช้' using errcode = 'P0002'; end if;
end $$;

-- Return type gains plan columns → drop and recreate.
drop function public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid, email text, full_name text, role public.app_role, created_at timestamptz,
  last_sign_in_at timestamptz, disabled_at timestamptz, project_count int, property_count int,
  plan public.plan_tier, plan_expires_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_system_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role, p.created_at, u.last_sign_in_at, p.disabled_at,
      (select count(*)::int from public.projects pr where pr.owner_id = p.id and pr.deleted_at is null),
      (select count(*)::int from public.properties h join public.projects pr on pr.id = h.project_id
        where pr.owner_id = p.id and h.deleted_at is null and pr.deleted_at is null),
      p.plan, p.plan_expires_at
    from public.profiles p left join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

revoke all on function public.my_plan() from public, anon;
revoke all on function public.admin_set_user_plan(uuid, public.plan_tier, timestamptz) from public, anon;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.my_plan() to authenticated;
grant execute on function public.admin_set_user_plan(uuid, public.plan_tier, timestamptz) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
