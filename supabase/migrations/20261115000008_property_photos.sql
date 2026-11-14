-- House-level photos (front of house, floor plans, documents): kind PROPERTY, no defect/item parent.
-- `kind::text` keeps the check valid inside the same transaction that adds the enum value.
alter type public.photo_kind add value if not exists 'PROPERTY';
alter table public.photos drop constraint photos_has_parent;
alter table public.photos add constraint photos_has_parent
  check (defect_id is not null or item_id is not null or kind::text = 'PROPERTY');
