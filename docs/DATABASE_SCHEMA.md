# TON Home Inspector — Database Schema

> สถานะ: **Draft v0.1 รอ review** · PostgreSQL 17 (Supabase) + IndexedDB (Dexie)

---

## 1. ER Diagram

```
auth.users 1─1 profiles
     │
     └─< project_members >─ projects 1─< properties 1─< checklist_categories 1─< checklist_items
                               │              │                                     │
                               │              └────────< defects >──── (item_id, nullable)
                               │                            │
                               │                            ├─< defect_events
                               │                            └─< photos >── (item_id, nullable)
                               └── project_id denormalized ลงทุกตารางลูก (ใช้ใน RLS)
```

## 2. หลักการร่วม (ทุกตารางที่ sync)

| Column | Type | หน้าที่ |
|---|---|---|
| `id` | `uuid` PK | client สร้างเอง (ทำงาน offline ได้) |
| `created_at` | `timestamptz` | เวลาสร้าง |
| `updated_at` | `timestamptz` | เวลาแก้ล่าสุดจาก client → ใช้ตัดสิน Last-Write-Wins |
| `server_updated_at` | `timestamptz` | ตั้งโดย trigger ทุกครั้งที่เขียน → pull cursor (ไม่ขึ้นกับนาฬิกาเครื่อง) |
| `deleted_at` | `timestamptz null` | soft delete |
| `project_id` | `uuid` | ทุกตารางลูก เพื่อ RLS |

## 3. Enums

```sql
create type app_role          as enum ('ADMIN','INSPECTOR','VIEWER');
create type item_status       as enum ('NOT_CHECKED','PASS','FAIL','NEEDS_REINSPECTION','NOT_APPLICABLE');
create type priority_level    as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type severity_level    as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type defect_status     as enum ('OPEN','SUBMITTED','IN_PROGRESS','FIXED','VERIFIED','REOPENED');
create type construction_status as enum ('UNDER_CONSTRUCTION','READY_FOR_INSPECTION','INSPECTING',
                                         'DEFECT_FIXING','READY_TO_TRANSFER','TRANSFERRED');
create type photo_kind        as enum ('DEFECT','AFTER_FIX','ITEM');
```

## 4. Tables

### 4.1 `profiles`
| Column | Type | Constraint |
|---|---|---|
| id | uuid | PK, FK → auth.users(id) on delete cascade |
| email | text | |
| full_name | text | ≤ 120 |
| role | app_role | default `INSPECTOR` — global role, ผู้ใช้แก้ของตัวเองไม่ได้ |
| created_at / updated_at | timestamptz | |

Trigger `on_auth_user_created` → insert profile อัตโนมัติ

### 4.2 `projects`
| Column | Type | Constraint |
|---|---|---|
| id | uuid | PK |
| owner_id | uuid | FK → profiles(id) |
| name | text | not null, 1–200 |
| developer | text | |
| developer_contact | text | |
| location | text | |
| description | text | |
| inspection_date | date | วันตรวจรับ |
| reinspection_date | date | วันนัดตรวจซ้ำ |
| + common columns | | |

Trigger `after insert` → เพิ่ม owner เป็น `project_members` role `ADMIN`

### 4.3 `project_members`
| Column | Type | Constraint |
|---|---|---|
| project_id | uuid | FK → projects on delete cascade |
| user_id | uuid | FK → profiles on delete cascade |
| role | app_role | not null |
| created_at | timestamptz | |
| | | **PK (project_id, user_id)** |

### 4.4 `properties`
| Column | Type | Constraint / หมายเหตุ |
|---|---|---|
| id, project_id | uuid | FK → projects |
| name | text | not null |
| plot_number | text | `1240-032002` |
| house_model | text | `TH99B` |
| property_type | text | `Two-storey townhouse` |
| land_area_sqw | numeric(10,2) | ≥ 0 · `16.20` |
| usable_area_sqm | numeric(10,2) | ≥ 0 · `99` |
| floors | smallint | 1–10 |
| construction_status | construction_status | |
| inspection_type | text | `Pre-handover Inspection` |
| inspection_owner | text | `Project Owner` |
| transfer_date_planned | date | `2026-11-18` (อ้างอิงเอกสารจอง) |
| **transfer_date_actual** | date | **ผู้ใช้กรอกเท่านั้น** |
| claim_window_days | smallint | default 15, 1–365 |
| warranty_info | text | |
| price / booking_fee / cashback | numeric(14,2) | ≥ 0 · ข้อมูลประกอบเท่านั้น |
| notes | text | |
| + common columns | | |

Deadline คำนวณใน app (ไม่เก็บ) = `transfer_date_actual + claim_window_days` และมี SQL view สำหรับรายงาน:
```sql
create view property_deadlines with (security_invoker = true) as
select id, project_id, transfer_date_actual,
       transfer_date_actual + claim_window_days as claim_deadline
from properties where deleted_at is null;
```

### 4.5 `checklist_categories`
| Column | Type | Constraint |
|---|---|---|
| id, project_id, property_id | uuid | FK |
| name | text | not null |
| sort_order | int | default 0 |

### 4.6 `checklist_items`
| Column | Type | Constraint |
|---|---|---|
| id, project_id, property_id | uuid | FK |
| category_id | uuid | FK → checklist_categories |
| code | text | เช่น `ELEC-012` |
| location | text | ชั้น/ห้อง |
| title | text | not null |
| description | text | |
| method | text | วิธีตรวจ + เครื่องมือ |
| acceptance_criteria | text | เกณฑ์ผ่าน |
| priority | priority_level | default `MEDIUM` |
| sort_order | int | |
| status | item_status | default `NOT_CHECKED` |
| note | text | |
| checked_at | timestamptz | |
| checked_by | uuid | FK → profiles |

### 4.7 `defects`
| Column | Type | Constraint |
|---|---|---|
| id, project_id, property_id | uuid | FK |
| item_id | uuid null | FK → checklist_items (on delete set null) |
| code | text | `D-001` unique ต่อ property |
| title | text | not null |
| description | text | |
| category | text | ชื่อหมวด (snapshot) |
| location | text | |
| severity | severity_level | not null |
| status | defect_status | default `OPEN` |
| recommendation | text | วิธีแก้ที่ต้องการ |
| found_at | timestamptz | |
| due_date | date | กำหนดแก้ |
| fixed_at / verified_at | timestamptz | |
| created_by | uuid | FK → profiles |

### 4.8 `defect_events` (audit / re-inspection history)
| Column | Type | |
|---|---|---|
| id, project_id | uuid | |
| defect_id | uuid | FK → defects on delete cascade |
| from_status | defect_status null | |
| to_status | defect_status | |
| note | text | |
| actor | uuid | FK → profiles |

### 4.9 `photos`
| Column | Type | |
|---|---|---|
| id, project_id, property_id | uuid | |
| defect_id | uuid null | FK → defects |
| item_id | uuid null | FK → checklist_items |
| kind | photo_kind | `DEFECT` / `AFTER_FIX` / `ITEM` |
| caption | text | |
| storage_path | text | `{project_id}/{photo_id}.jpg` |
| width / height / size_bytes | int | |
| taken_at | timestamptz | |
| | | check: `defect_id is not null or item_id is not null` |

## 5. Indexes

```sql
create index on properties (project_id) where deleted_at is null;
create index on checklist_categories (property_id, sort_order);
create index on checklist_items (property_id, category_id, sort_order);
create index on checklist_items (property_id, status);
create index on defects (property_id, status, severity);
create unique index on defects (property_id, code) where deleted_at is null;
create index on defect_events (defect_id, created_at);
create index on photos (defect_id);  create index on photos (item_id);
create index on project_members (user_id);
-- pull cursor ทุกตาราง
create index on <table> (project_id, server_updated_at);
```

## 6. Row Level Security

Helper (security definer, `stable`, `search_path = ''`):
```sql
is_project_member(pid uuid) → bool        -- มีแถวใน project_members
project_role(pid uuid)      → app_role    -- role ของ auth.uid() ในโครงการ
can_edit(pid uuid)          → bool        -- role in ('ADMIN','INSPECTOR')
is_project_admin(pid uuid)  → bool
```

| Table | SELECT | INSERT | UPDATE | DELETE (hard) |
|---|---|---|---|---|
| profiles | ตัวเอง + สมาชิกโครงการเดียวกัน | trigger เท่านั้น | ตัวเอง (ห้ามแก้ role) | ✗ |
| projects | member | `owner_id = auth.uid()` และ global role ≠ VIEWER | can_edit | admin |
| project_members | member | admin (ผ่าน RPC `add_project_member(project_id, email, role)`) | admin | admin (ห้ามลบ admin คนสุดท้าย) |
| properties, checklist_*, defects, photos | member | can_edit | can_edit | admin |
| defect_events | member | can_edit | ✗ (append-only) | ✗ |

Soft delete (`deleted_at`) เป็น UPDATE → INSPECTOR ทำได้, การลบถาวรเฉพาะ ADMIN

## 7. Storage

- Bucket `inspection-photos` — **private**, file size limit 5 MB, MIME `image/jpeg, image/png, image/webp`
- Path: `{project_id}/{photo_id}.jpg`
- Policy: `(storage.foldername(name))[1]::uuid` → read = `is_project_member`, write/delete = `can_edit`
- แสดงผลด้วย signed URL อายุ 1 ชั่วโมง (cache ใน IndexedDB หลังโหลดครั้งแรก)

## 8. Triggers

| Trigger | Table | หน้าที่ |
|---|---|---|
| `set_server_updated_at` | ทุกตาราง sync | `server_updated_at = now()` ก่อน insert/update |
| `handle_new_user` | auth.users | สร้าง profile |
| `add_owner_membership` | projects | owner → ADMIN member |
| `guard_profile_role` | profiles | กันผู้ใช้เปลี่ยน role ตัวเอง |
| `check_project_consistency` | ตารางลูก | `project_id` ต้องตรงกับ parent (กันข้อมูลข้ามโครงการ) |

## 9. Local Database (IndexedDB / Dexie)

```ts
db.version(1).stores({
  projects:             'id, updated_at, deleted_at',
  properties:           'id, project_id, updated_at',
  checklist_categories: 'id, property_id, [property_id+sort_order]',
  checklist_items:      'id, property_id, category_id, status, [property_id+status]',
  defects:              'id, property_id, item_id, status, severity',
  defect_events:        'id, defect_id',
  photos:               'id, property_id, defect_id, item_id',
  photo_blobs:          'photo_id, uploaded',            // ไฟล์ภาพ ไม่ sync เป็นแถว
  outbox:               '++seq, [table+row_id], attempts',// คิวรอส่ง
  sync_state:           'table',                         // pull cursor ต่อตาราง
  meta:                 'key',                           // current property, last sync, cached role
});
```
Schema ฝั่ง local ใช้ชื่อ column เดียวกับ Postgres (snake_case) → ไม่มี mapping layer

## 10. Seed

- Project: **Siri Place Rama 2** · Developer: Sansiri Public Company Limited
- Property: แปลง **1240-032002** · **TH99B** · 16.20 ตร.ว. · ~99 ตร.ม. · 2 ชั้น · Pre-handover · Owner: Project Owner
- Planned transfer **2026-11-18** · Actual transfer **ว่าง** (ผู้ใช้กรอก) · Claim window 15 วัน
- ราคา 2,305,000 · เงินจอง 2,000 · Cashback 300,000 (ข้อมูลประกอบ)
- Checklist template ~180 รายการ (10 หมวด × ห้องที่เกี่ยวข้อง)
- Seed ทำครั้งเดียวต่อผู้ใช้เมื่อยังไม่มีโครงการ (กันข้อมูลซ้ำข้ามเครื่อง)

## 11. Migrations

```
supabase/migrations/
  0001_init.sql      enums, tables, indexes, triggers
  0002_rls.sql       helper functions, policies, RPC add_project_member
  0003_storage.sql   bucket + storage policies
```
TypeScript types generate ด้วย `supabase gen types typescript` → `src/lib/supabase/database.types.ts`
