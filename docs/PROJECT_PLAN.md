# TON Home Inspector — Project Plan

> INSIGHT • AUTOMATE • GROW
> สถานะ: **Draft v0.1 รอ TON AI review** · 14 Nov 2026
> เจ้าของโครงการ: TON AI

---

## 0. สรุปสำหรับผู้ตรวจ (TL;DR)

| หัวข้อ | ข้อเสนอ |
|---|---|
| แนวคิดหลัก | **Offline-first PWA**: บันทึกลง IndexedDB บนเครื่องก่อนเสมอ แล้ว sync ขึ้น Supabase เมื่อออนไลน์ ใช้ตรวจในบ้านที่สัญญาณไม่ดีได้ |
| Stack | Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui · Lucide · Supabase (Postgres/Auth/Storage) · Dexie (IndexedDB) · Zod + React Hook Form · Recharts · jsPDF · ExcelJS · Vitest · Playwright |
| Deploy | Vercel + Supabase Cloud (region `ap-southeast-1` Singapore) |
| Security | Supabase RLS ทุกตาราง, Private Storage bucket, Role ADMIN / INSPECTOR / VIEWER ต่อโครงการ |
| Deadline | คำนวณวันสุดท้ายแจ้งเก็บงาน = **วันโอนจริง + 15 วัน** (ไม่นับวันโอน ตาม ปพพ. ม.193/3) ใช้เฉพาะวันโอนจริงที่ผู้ใช้กรอก วันที่ 18 Nov แสดงเป็น "กำหนดตามเอกสารจอง" เท่านั้น |
| เป้าหมายเวลา | **Phase 1 (MVP ใช้ตรวจหน้างานได้) ก่อน 17 Nov 2026** ให้ทันวันโอน 18 Nov |

**สิ่งที่ต้องการจาก TON AI ก่อนเริ่มโค้ด** → ดู [§10 Open Questions](#10-open-questions-ต้องการคำตอบ)

---

## 1. Repository Analysis

| ตรวจสอบ | ผลลัพธ์ |
|---|---|
| GitHub repo ที่เกี่ยวข้อง (ค้นด้วย `inspect`, `home`) | **ไม่พบ** |
| Supabase project สำหรับระบบนี้ | **ไม่พบ** (มีโปรเจกต์อื่น 4 ตัว: narai-superbag, it-project-tracker-public, floodwatch-th, nobet-ai — จะไม่แตะต้อง) |
| ไฟล์ใน Project Files | ว่าง |

**ข้อสรุป:** เป็น Greenfield project ไม่มีระบบเดิมให้ต้องระวังเขียนทับ

**หมายเหตุความโปร่งใส:** ก่อนได้รับคำสั่งให้วางแผนก่อน ผมได้ scaffold โปรเจกต์ใน sandbox ไปแล้วบางส่วน (Next.js skeleton, domain types, ฟังก์ชันคำนวณ deadline/progress, checklist template ~180 รายการ) ยังไม่ได้ push ที่ไหน หยุดไว้แล้ว และจะปรับให้ตรงกับแผนที่อนุมัติ

**Constraints ที่พบ:**
- Session นี้สร้าง GitHub repo ใหม่ไม่ได้ → TON AI ต้องสร้าง repo เปล่า (เช่น `itpppc/ton-home-inspector`) แล้วแจ้งชื่อ
- shadcn registry ถูก block จาก sandbox → เขียน component แบบ shadcn (Radix + CVA) เอง พร้อม `components.json` ให้ใช้ `npx shadcn add` ต่อบนเครื่องได้ตามปกติ

---

## 2. Scope ที่ตีความจาก Master Prompt

Master Prompt ถูกตัดที่ Module 5 ("แต่ละ Checklist ต้องประกอบด้วย: 1. Item") ส่วนที่เหลือ **อนุมานจาก Project Overview 14 ข้อ** (ทำเครื่องหมาย ⚠︎ = อนุมาน)

| Module | ที่มา | เนื้อหา |
|---|---|---|
| M1 Authentication | Prompt | Login, Register, Forgot/Reset Password, Profile, Session, Roles |
| M2 Dashboard | Prompt | KPI 9 ตัว, Progress %, กราฟ 4 แบบ |
| M3 Project Management | Prompt | CRUD โครงการ, Developer, Location, Inspection Schedule |
| M4 Property Management | Prompt | CRUD บ้าน, Transfer Date, Warranty |
| M5 Inspection Checklist | Prompt (บางส่วน) | Dynamic checklist, 5 statuses, หมวด/ลำดับ/วิธีตรวจ/ความสำคัญ |
| M5 field list | ⚠︎ | ดู §4.3 |
| M6 Defect Management | ⚠︎ Overview ข้อ 5–8 | บันทึก Defect, ตำแหน่ง, Severity, Workflow สถานะ, มอบให้โครงการแก้ |
| M7 Photo Evidence | ⚠︎ Overview ข้อ 4 | กล้องมือถือ, บีบอัดภาพ, Before/After |
| M8 Re-inspection | ⚠︎ Overview ข้อ 9 | ตรวจซ้ำหลังแก้, ประวัติการแก้, เปิดงานซ้ำ |
| M9 Reports | ⚠︎ Overview ข้อ 10–11 | PDF, Excel, Print layout |
| M10 Deadline & Alerts | ⚠︎ เงื่อนไขสำคัญ | วันโอนจริง, นับถอยหลัง 15 วัน, แจ้งเตือน |
| M11 Offline & Sync | ⚠︎ Overview ข้อ 14 | PWA, IndexedDB, Queue, Background Sync |
| M12 Settings / Members | ⚠︎ | เชิญสมาชิกเข้าโครงการด้วยอีเมล + กำหนด Role |

---

## 3. Architecture

### 3.1 ภาพรวม

```
┌──────────────────────── Browser / PWA (Mobile & Desktop) ────────────────────────┐
│  Next.js App Router (Client Components สำหรับหน้าที่ต้อง offline)                    │
│   ├─ UI: shadcn/ui + Tailwind (Navy / Cyan / Purple, Sarabun)                    │
│   ├─ Forms: React Hook Form + Zod (schema เดียวกับ server)                         │
│   ├─ Data hooks: dexie-react-hooks (live queries → UI อัปเดตทันที)                  │
│   ├─ Local DB: IndexedDB (Dexie) ← Source of truth ฝั่ง client                      │
│   │     tables: projects, properties, categories, items, defects, events,        │
│   │             photos (meta), photo_blobs (ไฟล์ภาพ), outbox, sync_state          │
│   ├─ Sync Engine: push outbox → Supabase, pull delta ← Supabase (LWW)            │
│   └─ Service Worker: precache app shell, runtime cache, Background Sync          │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │ HTTPS (supabase-js, JWT)
┌───────────────────────────────────────▼──────────────────────────────────────────┐
│ Supabase Cloud (ap-southeast-1)                                                   │
│   Auth (email/password, reset) · Postgres + RLS · Storage (private bucket)        │
│   Triggers: server_updated_at, profile on signup, owner→member                    │
└───────────────────────────────────────────────────────────────────────────────────┘
          ▲
          │ Route Handlers / Server Actions (เฉพาะงานที่ต้องอยู่ฝั่ง server:
          │  auth callback, invite member, signed URL)       Next.js on Vercel
```

### 3.2 Architecture Decisions (ADR สั้น)

| # | Decision | เหตุผล | Trade-off |
|---|---|---|---|
| ADR-1 | **Offline-first** (IndexedDB เป็น source of truth ฝั่ง client) แทน Server Components fetch ตรง | บ้านใหม่มักไม่มี Wi-Fi/สัญญาณอ่อน การตรวจต้องไม่สะดุด | ต้องมี sync engine และ conflict policy |
| ADR-2 | Route แบบ **query param** (`/property?id=…`) แทน dynamic segment (`/property/[id]`) | Service Worker precache 1 HTML ต่อ route แล้วเปิดได้ทุก id ขณะ offline | URL สวยน้อยลงเล็กน้อย |
| ADR-3 | Client สร้าง **UUID เอง** | สร้างข้อมูล offline ได้โดยไม่ต้องรอ server | — |
| ADR-4 | Conflict = **Last-Write-Wins ต่อแถว** ด้วย `updated_at` (client) และ pull cursor ด้วย `server_updated_at` (server trigger) | ผู้ใช้ส่วนใหญ่ตรวจคนเดียว/ต่างรายการกัน LWW เพียงพอและเข้าใจง่าย | ถ้า 2 คนแก้รายการเดียวกันพร้อมกัน คนหลังชนะ (มี defect_events เป็น audit) |
| ADR-5 | **Soft delete** (`deleted_at`) ทุกตาราง | การลบต้อง sync ได้และกู้คืนได้ | ต้อง filter `deleted_at is null` |
| ADR-6 | Denormalize **`project_id` ลงทุกตารางลูก** | RLS เช็คสิทธิ์ด้วย `is_project_member(project_id)` ตัวเดียว เร็วและอ่านง่าย | ต้องรักษาความสอดคล้อง (ตั้งค่าตอน insert) |
| ADR-7 | **Dynamic checklist ในฐานข้อมูล** + Template เริ่มต้นจาก seed | เพิ่ม/แก้หัวข้อได้ในแอป ไม่ต้องแก้ source code | — |
| ADR-8 | **โหมด Local** เมื่อยังไม่ตั้งค่า Supabase env | ใช้งานได้ทันทีบนเครื่องเดียว ข้อมูลจะ sync ขึ้น cloud เมื่อ login ภายหลัง | — |
| ADR-9 | PDF 2 ทาง: (1) **jsPDF + ฟอนต์ Sarabun** ดาวน์โหลดได้ทันที (2) **Print layout** → "Save as PDF" ของเบราว์เซอร์ | jsPDF ไม่ทำ text shaping ภาษาไทยเต็มรูปแบบ (สระบน+วรรณยุกต์อาจซ้อนเล็กน้อย) Print layout ได้ภาษาไทยสมบูรณ์ 100% | ต้องดูแล 2 layout |
| ADR-10 | บีบอัดภาพฝั่ง client (Canvas → JPEG ≤1600px, q≈0.75) | ประหยัด storage/data, อัปโหลดเร็วตอนสัญญาณอ่อน | — |
| ADR-11 | Role ระดับ **โครงการ** (`project_members.role`) + global role ใน `profiles` | แชร์บ้านให้ภรรยา/ช่าง/ผู้ตรวจอิสระดูได้แบบ VIEWER | — |

### 3.3 โครงสร้างโฟลเดอร์

```
ton-home-inspector/
├─ docs/                      PROJECT_PLAN.md, DATABASE_SCHEMA.md, TASK_TRACKER.md
├─ supabase/
│  ├─ migrations/             0001_init.sql, 0002_rls.sql, 0003_storage.sql
│  └─ seed.sql
├─ public/                    sw.js, icons/, fonts/Sarabun-*.ttf
├─ src/
│  ├─ app/
│  │  ├─ (auth)/              login, register, forgot-password, reset-password
│  │  ├─ auth/callback/       route.ts (exchange code)
│  │  ├─ (app)/               layout (AppShell + guard)
│  │  │  ├─ page.tsx          Dashboard
│  │  │  ├─ projects/ project/ property/ inspect/ checklist/
│  │  │  ├─ defects/ defect/ reports/ report-print/ profile/ settings/
│  │  ├─ manifest.ts, layout.tsx, globals.css
│  ├─ components/ui/          shadcn primitives
│  ├─ components/app/         AppShell, BottomNav, SyncIndicator, DeadlineBanner,
│  │                          StatusPicker, PhotoCapture, PhotoGrid, StatCard, Charts
│  ├─ features/               auth/, dashboard/, projects/, properties/,
│  │                          checklist/, defects/, reports/  (UI + hooks ต่อ feature)
│  ├─ lib/
│  │  ├─ domain/              types, schemas (Zod), stats, deadline, labels
│  │  ├─ db/                  dexie schema, repositories (CRUD + outbox)
│  │  ├─ sync/                engine, conflict, photo upload
│  │  ├─ supabase/            browser/server clients, middleware, generated types
│  │  ├─ report/              pdf.ts, excel.ts, ics.ts
│  │  ├─ image/               compress.ts
│  │  └─ seed/                checklist-template.ts, default project/property
│  └─ middleware.ts           refresh Supabase session
├─ tests/unit/  tests/e2e/
└─ .env.example
```

---

## 4. Functional Design

### 4.1 Roles & Permissions

| Action | ADMIN | INSPECTOR | VIEWER |
|---|:-:|:-:|:-:|
| ดู Dashboard / รายงาน / ดาวน์โหลด PDF-Excel | ✓ | ✓ | ✓ |
| บันทึกผลตรวจ, ถ่ายรูป, สร้าง/แก้ Defect | ✓ | ✓ | ✗ |
| แก้ Checklist (เพิ่ม/แก้/ลบหัวข้อ, จัดลำดับ) | ✓ | ✓ | ✗ |
| สร้าง/แก้ Project & Property, บันทึกวันโอนจริง | ✓ | ✓ | ✗ |
| ลบ Project/Property, จัดการสมาชิก | ✓ | ✗ | ✗ |

บังคับ 2 ชั้น: UI ซ่อน/disable + **RLS ฝั่ง database** (ชั้นที่เชื่อถือได้)

### 4.2 Inspection Status & Progress

`NOT_CHECKED · PASS · FAIL · NEEDS_REINSPECTION · NOT_APPLICABLE`

```
Checked          = total − NOT_CHECKED
Progress %       = Checked / Total                  (ตัวอย่าง: (120+20)/200 = 70%)
Pass rate %      = PASS / (Total − NOT_APPLICABLE)
Pending          = NOT_CHECKED
```
รายการที่ข้ามหรือยังไม่ตรวจ **ไม่ถูกนับเป็น PASS ในทุกกรณี** · ตั้ง FAIL → ระบบเสนอให้สร้าง Defect ทันที (prefill หมวด/ตำแหน่ง/หัวข้อ)

### 4.3 Checklist Item Fields ⚠︎ (อนุมาน — รอยืนยัน)

1. **Item Code** (เช่น `ELEC-012`) 2. **Category** 3. **Location** (ชั้น/ห้อง) 4. **Title** 5. **Description** 6. **Inspection Method** (วิธีตรวจ + เครื่องมือ) 7. **Acceptance Criteria** (เกณฑ์ผ่าน) 8. **Priority** (LOW/MEDIUM/HIGH/CRITICAL) 9. **Sort Order** 10. **Status** 11. **Note** 12. **Photos** 13. **Checked by / Checked at** 14. **Linked Defects**

Template เริ่มต้น: 10 หมวด ~45 หัวข้อ ขยายตามห้อง → **~180 รายการ** (เอกสารส่งมอบ, โครงสร้าง/ภายนอก, หลังคา, ผนัง/สี, พื้น/กระเบื้อง, ฝ้า, ประตู/หน้าต่าง, สุขภัณฑ์/ประปา, ไฟฟ้า, ครัว/บิวท์อิน) ห้อง 14 ตำแหน่ง ⚠︎ อิงผังทาวน์โฮม 2 ชั้น 3 นอน ควรเทียบกับแบบ TH99B จริง

### 4.4 Defect Workflow ⚠︎

```
OPEN ──► SUBMITTED ──► IN_PROGRESS ──► FIXED ──► VERIFIED (ปิดงาน)
  พบปัญหา   แจ้งโครงการ     กำลังแก้       แก้แล้ว     ▲      │
                                         รอตรวจซ้ำ   │      ▼
                                             └── REOPENED (ตรวจซ้ำไม่ผ่าน)
```
Severity: **LOW** เล็กน้อย · **MEDIUM** ปานกลาง · **HIGH** สูง (ต้องแก้ก่อนโอน) · **CRITICAL** วิกฤต (ความปลอดภัย/โครงสร้าง/ไฟฟ้า)
ทุกการเปลี่ยนสถานะบันทึกใน `defect_events` (ใคร/เมื่อไร/หมายเหตุ) · รูป `DEFECT` (ก่อนแก้) และ `AFTER_FIX` (หลังแก้) แสดงเทียบกันในรายงาน

### 4.5 Transfer Date & 15-Day Claim Deadline

- Property มี `transfer_date_planned` (2026-11-18 จากเอกสารจอง, **อ้างอิงเท่านั้น**) และ `transfer_date_actual` (ผู้ใช้กรอก)
- `deadline = transfer_date_actual + claim_window_days (ค่าเริ่มต้น 15)` นับแบบไม่รวมวันโอน
- สถานะ banner ทุกหน้า: `ยังไม่บันทึกวันโอนจริง` → `เหลือ N วัน` → `เร่งด่วน (≤3 วัน)` → `วันสุดท้าย` → `หมดสิทธิ์แล้ว`
- ดาวน์โหลด **.ics** ลงปฏิทิน (แจ้งเตือนล่วงหน้า 3 วันและ 1 วัน) + Browser Notification เมื่อเปิดแอป (ถ้าอนุญาต)
- คำแนะนำในแอป: ยื่นรายการ **ฉบับเดียวที่ครบถ้วน** เพราะสิทธิ์มี 1 ครั้ง และขอหลักฐานการรับเรื่องจากโครงการ

### 4.6 Reports

| รายงาน | เนื้อหา |
|---|---|
| PDF "รายงานตรวจรับบ้าน" | ปก (โครงการ/แปลง/แบบบ้าน/วันที่ตรวจ/ผู้ตรวจ), สรุปผล KPI, Deadline, ตาราง Defect เรียงตาม Severity พร้อมรูป, ผล Checklist แยกหมวด, ช่องลงนาม |
| PDF "ใบแจ้งเก็บงาน" | เฉพาะ Defect ที่ยังไม่ปิด ใช้ยื่นโครงการภายใน 15 วัน |
| Excel (.xlsx) | Sheet: Summary, Checklist, Defects, Defect History |
| Print layout | หน้า HTML จัดหน้า A4 สำหรับ "Save as PDF" (ภาษาไทยสมบูรณ์) |

### 4.7 Offline & Sync

- **Outbox:** ทุกการเขียนลง IndexedDB จะเพิ่ม `(table, row_id)` ลง outbox ใน transaction เดียวกัน (atomic)
- **Push:** ตามลำดับ FK: projects → properties → categories → items → defects → events → photos · รูปอัปโหลด Storage ก่อน แล้วค่อย upsert metadata
- **Pull:** `select … where server_updated_at > cursor` ต่อตาราง (page 1,000 แถว) merge แบบ LWW ไม่ทับแถวที่ยังค้างใน outbox
- **Triggers:** เปิดแอป, กลับมาออนไลน์ (`online` event), หลังแก้ข้อมูล (debounce 2 วินาที), ทุก 60 วินาที, ปุ่ม Sync, Background Sync API (Chrome/Android)
- **Retry:** exponential backoff สูงสุด 5 นาที, error แยกต่อแถว ไม่ block ทั้งคิว
- **UI:** แสดง Online/Offline, จำนวนรายการรอ sync, เวลา sync ล่าสุด, error
- **Service Worker:** precache app shell + ทุก route, navigation = network-first (timeout 3s) → cache, static = cache-first, Supabase = ไม่ cache

---

## 5. UI/UX

- **Theme:** Primary Navy `#0B1F4B` · Secondary Cyan `#06B6D4` · Accent Purple `#7C3AED` · Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · BG Light `#F4F6FA` / Dark `#071330` · Light/Dark/System
- **Font:** Sarabun (self-hosted ไฟล์ .ttf ใช้ทั้งเว็บและ PDF ทำงาน offline ได้)
- **Desktop:** Sidebar + Top header (Property switcher, Sync status, Deadline chip, User menu) + Content
- **Mobile:** Bottom nav 5 ปุ่ม (Dashboard · ตรวจบ้าน · Defects · รายงาน · เมนู), touch target ≥ 44px, ปุ่มสถานะ PASS/FAIL ขนาดใหญ่, ปุ่มกล้องลอย (FAB)
- **หน้าตรวจบ้าน:** เลือกหมวดหรือห้อง → การ์ดรายการ แตะสถานะได้ทันที → FAIL เปิด sheet สร้าง Defect + ถ่ายรูป ในขั้นตอนเดียว · filter: ยังไม่ตรวจ / ไม่ผ่าน / ตามห้อง · ค้นหา
- **Accessibility (WCAG 2.1 AA):** contrast ≥ 4.5:1, focus ring ชัด, label ทุก input, aria-live สำหรับสถานะ sync, ไม่ใช้สีอย่างเดียวสื่อความหมาย (มี icon + ข้อความ)

---

## 6. Security & Quality

- RLS เปิดทุกตาราง, ไม่มี service-role key ฝั่ง client, Storage private + signed URL อายุสั้น
- Zod validate ทั้งฟอร์มและก่อน sync, จำกัดขนาด/ชนิดไฟล์ภาพ (JPEG/PNG/WebP/HEIC → JPEG, ≤ 10MB ก่อนบีบ)
- Password policy ≥ 8 ตัว มีตัวอักษร+ตัวเลข, reset ผ่านอีเมล
- ข้อมูลการเงิน (ราคา/เงินจอง/Cashback) แสดงเป็นข้อมูลประกอบ แยกจากผลประเมินคุณภาพ
- **Testing:** Vitest (deadline, progress, stats, schemas, sync merge, repositories ด้วย fake-indexeddb) · Playwright (ตรวจรายการ → FAIL → Defect + รูป → PDF; offline mode)
- **CI:** typecheck + lint + unit test + build (GitHub Actions) เมื่อมี repo

---

## 7. Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://<vercel-domain>
```
ไม่ตั้งค่า → แอปทำงานโหมด Local (ข้อมูลอยู่บนเครื่องเท่านั้น)

---

## 8. Delivery Phases (รายละเอียดใน TASK_TRACKER.md)

| Phase | เป้าหมาย | Target |
|---|---|---|
| **P0** Planning | 3 เอกสารนี้ + อนุมัติ | 14 Nov |
| **P1** MVP หน้างาน | Checklist, Defect, รูป, Deadline, PDF/Excel, PWA offline (โหมด Local) | **16 Nov** (ซ้อมใช้ 17 Nov) |
| **P2** Cloud | Supabase Auth, RLS, Storage, Sync, Roles, Members | 17–18 Nov |
| **P3** Deploy | Vercel + Supabase production, ทดสอบมือถือจริง | 18 Nov |
| **P4** หลังโอน | Re-inspection flow เต็ม, ใบแจ้งเก็บงาน, Dashboard charts ครบ, E2E tests | ภายในช่วง 15 วันหลังโอน |

### 8.1 Product Roadmap (TON AI) — ทิศทางระยะยาว, ไม่ขยาย scope ตอนนี้

| Version | ขอบเขต | สถานะ |
|---|---|---|
| **V1.0 — Home Inspection** (Core) | ตรวจบ้าน, บันทึกภาพ, Checklist, Defect, รายงาน PDF/Excel, Offline — Pilot: TH99B | **กำลังพัฒนา** |
| **V2.0 — AI Inspection** | AI วิเคราะห์ภาพรอยร้าว สีพอง น้ำรั่ว และจำแนกข้อบกพร่อง โดยผู้ตรวจต้องยืนยันผลเสมอ (human-in-the-loop) | Backlog |
| **V3.0 — Multi-Project** | ผู้ตรวจหลายคน หลายโครงการ หลายบ้าน + รายงานเปรียบเทียบ | Backlog |
| **V4.0 — Commercial Platform** | ระบบสมาชิกสำหรับผู้ซื้อบ้านและธุรกิจรับตรวจบ้าน | Backlog |

Design hooks ที่ V1.0 เตรียมไว้แล้ว (ไม่มีงานเพิ่ม): `photos` แยกตาราง + Storage path ต่อ project (พร้อมให้ AI V2 อ่าน), `suggestSeverity()` แยกเป็น pure function (สลับเป็น AI ได้), RLS ระดับ project_members + roles (รองรับหลายผู้ตรวจ V3), `owner_id` ทุก project (รองรับ tenant/สมาชิก V4).

---

## 9. Risks

| Risk | ผลกระทบ | การรับมือ |
|---|---|---|
| เวลาเหลือ 4 วัน | ไม่ทันใช้วันโอน | P1 ใช้งานได้โดยไม่ต้องรอ cloud (โหมด Local) |
| ไม่มี GitHub repo / Supabase project | Deploy ไม่ได้ | ต้องให้ TON AI สร้าง repo และอนุมัติสร้าง Supabase project |
| iOS Safari: ไม่มี Background Sync, อาจล้าง storage ถ้าไม่ได้เปิดแอปนาน | ข้อมูลค้างในเครื่อง | sync ตอนเปิดแอป/ออนไลน์, ขอ `navigator.storage.persist()`, เตือนให้ sync ก่อนออกจากหน้างาน, Export Excel/backup JSON ได้ |
| jsPDF ภาษาไทยวรรณยุกต์ซ้อน | PDF ไม่สวย 100% | Print layout เป็นทางเลือกหลักสำหรับเอกสารยื่นโครงการ |
| Master prompt ไม่ครบ | Scope คลาดเคลื่อน | ⚠︎ ระบุส่วนที่อนุมาน ปรับได้เมื่อได้ส่วนที่เหลือ |

---

## 10. Open Questions (ต้องการคำตอบ)

1. **ส่วนที่เหลือของ Master Prompt** (ตั้งแต่ Module 5 "แต่ละ Checklist ต้องประกอบด้วย") — หรือยืนยันว่าใช้ field ตาม §4.3 ได้
2. **GitHub repo:** สร้าง repo เปล่าชื่อ `ton-home-inspector` (private) แล้วแจ้งชื่อ — หรือให้ส่งเป็นไฟล์ zip ก่อน
3. **Supabase:** อนุมัติให้สร้าง project ใหม่ `ton-home-inspector` (region Singapore) ใน org เดิมหรือไม่ (อาจมีค่าใช้จ่ายตามแพ็กเกจ)
4. **ลำดับความสำคัญ:** เห็นด้วยกับ P1 = ใช้ตรวจหน้างานแบบ Local ให้ทันก่อน แล้วค่อยต่อ Cloud ใน P2 หรือไม่
5. **ผังห้อง TH99B:** จำนวนห้องนอน/ห้องน้ำจริง (template ตั้งไว้ 3 นอน 3 น้ำ) ถ้ามีแบบบ้าน แนบมาได้
