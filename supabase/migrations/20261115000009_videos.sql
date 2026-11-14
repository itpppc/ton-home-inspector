-- 1) Short video evidence (≤ 30 s, compressed on-device to ~720p) stored next to photos.
-- 2) Project-level media (site, common areas, project signboard, documents): kind PROJECT, no house.
alter type public.photo_kind add value if not exists 'PROJECT';

alter table public.photos
  add column media_type text not null default 'image' check (media_type in ('image', 'video')),
  add column duration_sec numeric(5, 1) check (duration_sec > 0 and duration_sec <= 60),
  alter column property_id drop not null;
alter table public.photos drop constraint photos_has_parent;
alter table public.photos add constraint photos_has_parent check (
  (kind::text = 'PROJECT' and property_id is null and defect_id is null and item_id is null)
  or (kind::text <> 'PROJECT' and property_id is not null
      and (defect_id is not null or item_id is not null or kind::text = 'PROPERTY'))
);

-- Project-level photos have no house: their parent is the project itself.
create or replace function public.check_project_consistency()
returns trigger language plpgsql set search_path = '' as $$
declare parent_project uuid;
begin
  if tg_table_name = 'properties' then
    return new;
  elsif tg_table_name in ('checklist_categories', 'defects', 'photos', 'rooms') then
    -- Nested IF: only these tables have NEW.property_id. A project-level photo's parent is the project.
    if tg_table_name = 'photos' and new.property_id is null then
      select p.id into parent_project from public.projects p where p.id = new.project_id;
    else
      select p.project_id into parent_project from public.properties p where p.id = new.property_id;
    end if;
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

create index if not exists photos_project_level_idx on public.photos (project_id) where property_id is null;

-- Bucket: allow short videos; 15 MB per file (on-device compression targets ~5 MB).
update storage.buckets
  set file_size_limit = 15728640,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
  where id = 'inspection-photos';
