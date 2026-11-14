-- Phase 3: server-side Last-Write-Wins guard.
-- Without this, a device that was offline for hours could push an OLDER edit over a NEWER one made on
-- another device (clients upsert unconditionally). A stale write now keeps the stored content but still
-- advances server_updated_at (set by set_server_updated_at, which fires after this trigger), so every
-- device — including the stale writer — pulls the winning row on its next sync. Nothing is lost silently.
create or replace function public.lww_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at then
    new := old;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'properties', 'rooms', 'checklist_categories', 'checklist_items', 'defects', 'photos'] loop
    execute format('create trigger a_lww_guard before update on public.%I for each row execute function public.lww_guard()', t);
  end loop;
end $$;
