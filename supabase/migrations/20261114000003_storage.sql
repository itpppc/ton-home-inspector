-- Private bucket for inspection photos. Path: {project_id}/{photo_id}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_project_id(object_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end $$;
grant execute on function private.storage_project_id(text) to authenticated;

create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos' and private.is_project_member(private.storage_project_id(name)));
create policy photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos' and private.can_edit(private.storage_project_id(name)));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'inspection-photos' and private.can_edit(private.storage_project_id(name)))
  with check (bucket_id = 'inspection-photos' and private.can_edit(private.storage_project_id(name)));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos' and private.is_project_admin(private.storage_project_id(name)));
