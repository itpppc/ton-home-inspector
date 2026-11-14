// RLS / trigger integration test against a real Postgres with the Supabase shim applied.
// Usage: DATABASE_URL=postgres://postgres@/db?host=/tmp/pgtest&port=5444 node supabase/tests/rls.test.mjs
import pg from "pg";
import { randomUUID as id } from "node:crypto";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let passed = 0, failed = 0;
const ok = (name, cond, extra = "") => { cond ? passed++ : failed++; console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` ${extra}`}`); };

/** Runs fn as an authenticated user inside a rolled-back-on-error savepoint. */
async function as(user, sql, params = []) {
  await db.query("begin");
  try {
    if (user) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    } else await db.query("set local role anon");
    const r = await db.query(sql, params);
    await db.query("commit");
    return { rows: r.rows, count: r.rowCount, error: null };
  } catch (e) {
    await db.query("rollback");
    return { rows: [], count: 0, error: e.message };
  }
}

const [A, B, V, I, GV] = [id(), id(), id(), id(), id()];
for (const [u, e] of [[A, "a@x.co"], [B, "b@x.co"], [V, "v@x.co"], [I, "i@x.co"], [GV, "gv@x.co"]])
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [u, e, { full_name: e }]);
await db.query("update public.profiles set role = 'VIEWER' where id = $1", [GV]);
ok("profile auto-created on signup", (await db.query("select count(*)::int c from public.profiles")).rows[0].c === 5);

const P = id(), H = id(), C = id(), IT = id();
const now = new Date().toISOString();
let r = await as(A, "insert into public.projects (id, owner_id, name, created_at, updated_at) values ($1, $2, 'Siri Place Rama 2', $3, $3)", [P, A, now]);
ok("owner creates project", !r.error, r.error);
ok("owner becomes ADMIN member", (await db.query("select role from public.project_members where project_id=$1 and user_id=$2", [P, A])).rows[0]?.role === "ADMIN");
r = await as(A, "insert into public.properties (id, project_id, name, plot_number, transfer_date_planned) values ($1,$2,'บ้าน','1240-032002','2026-11-18')", [H, P]);
ok("owner creates property", !r.error, r.error);
r = await as(A, "insert into public.checklist_categories (id, project_id, property_id, name) values ($1,$2,$3,'ไฟฟ้า')", [C, P, H]);
ok("owner creates category", !r.error, r.error);
r = await as(A, "insert into public.checklist_items (id, project_id, property_id, category_id, title, code) values ($1,$2,$3,$4,'เต้ารับ','ELEC-001')", [IT, P, H, C]);
ok("owner creates item", !r.error, r.error);
ok("server_updated_at is set", (await db.query("select server_updated_at is not null s from public.checklist_items where id=$1", [IT])).rows[0].s);

r = await as(B, "select * from public.projects");
ok("outsider sees no projects", r.rows.length === 0);
r = await as(B, "update public.checklist_items set status='PASS' where id=$1", [IT]);
ok("outsider cannot update items", r.count === 0);
r = await as(B, "insert into public.properties (id, project_id, name) values ($1,$2,'x')", [id(), P]);
ok("outsider cannot insert into project", !!r.error);
r = await as(B, "insert into public.projects (id, owner_id, name) values ($1,$2,'hijack') on conflict (id) do update set name = excluded.name", [P, B]);
ok("outsider cannot hijack project via upsert", !!r.error || (await db.query("select name from public.projects where id=$1", [P])).rows[0].name === "Siri Place Rama 2");
r = await as(null, "select * from public.properties");
ok("anon sees nothing", r.rows.length === 0 || !!r.error);

r = await as(I, "select public.add_project_member($1, 'v@x.co', 'VIEWER')", [P]);
ok("non-admin cannot invite", !!r.error);
r = await as(A, "select public.add_project_member($1, 'V@X.CO', 'VIEWER')", [P]);
ok("admin invites viewer by email (case-insensitive)", !r.error, r.error);
r = await as(A, "select public.add_project_member($1, 'i@x.co', 'INSPECTOR')", [P]);
ok("admin invites inspector", !r.error, r.error);
r = await as(A, "select public.add_project_member($1, 'nobody@x.co', 'VIEWER')", [P]);
ok("invite unknown email fails clearly", /ไม่พบผู้ใช้/.test(r.error ?? ""));

r = await as(V, "select * from public.checklist_items");
ok("viewer can read items", r.rows.length === 1);
r = await as(V, "update public.checklist_items set status='PASS' where id=$1", [IT]);
ok("viewer cannot update items", r.count === 0);
r = await as(V, "insert into public.checklist_items (id, project_id, property_id, category_id, title) values ($1,$2,$3,$4,'x')", [id(), P, H, C]);
ok("viewer cannot insert items", !!r.error);

r = await as(I, "update public.checklist_items set status='FAIL', note='ไฟไม่เข้า' where id=$1", [IT]);
ok("inspector updates item status", r.count === 1, r.error);
r = await as(I, "insert into public.projects (id, owner_id, name, updated_at) values ($1,$2,'Siri Place Rama 2 (edit)', now()) on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at", [P, A]);
ok("inspector upserts existing project (sync path)", !r.error, r.error);
r = await as(I, "update public.properties set deleted_at = now() where id=$1", [H]);
ok("inspector cannot soft-delete property", !!r.error);
r = await as(I, "update public.projects set owner_id=$2 where id=$1", [P, I]);
ok("owner_id is immutable", !!r.error);
r = await as(I, "delete from public.project_members where project_id=$1 and user_id=$2", [P, A]);
ok("inspector cannot remove admin", r.count === 0);
r = await as(I, "update public.project_members set role='ADMIN' where project_id=$1 and user_id=$2", [P, I]);
ok("inspector cannot promote self", r.count === 0);

r = await as(A, "update public.profiles set role='ADMIN' where id=$1", [A]);
ok("user cannot change own global role", !!r.error);
r = await as(A, "update public.profiles set full_name='TON' where id=$1", [A]);
ok("user can edit own name", r.count === 1, r.error);
r = await as(A, "update public.profiles set full_name='hack' where id=$1", [B]);
ok("user cannot edit others' profile", r.count === 0);
r = await as(A, "update public.project_members set role='VIEWER' where project_id=$1 and user_id=$2", [P, A]);
ok("last admin cannot be demoted", !!r.error);

r = await as(GV, "insert into public.projects (id, owner_id, name) values ($1,$2,'viewer project')", [id(), GV]);
ok("global VIEWER cannot create projects", !!r.error);

const P2 = id();
await as(B, "insert into public.projects (id, owner_id, name) values ($1,$2,'B project')", [P2, B]);
r = await as(B, "insert into public.checklist_categories (id, project_id, property_id, name) values ($1,$2,$3,'x')", [id(), P2, H]);
ok("child row cannot point at another project's property", !!r.error);

const E = id(), D = id();
await as(A, "insert into public.defects (id, project_id, property_id, code, title, severity) values ($1,$2,$3,'D-001','ไฟไม่เข้า','CRITICAL')", [D, P, H]);
r = await as(I, "insert into public.defect_events (id, project_id, defect_id, to_status) values ($1,$2,$3,'OPEN')", [E, P, D]);
ok("inspector appends defect event", !r.error, r.error);
r = await as(I, "update public.defect_events set note='edited' where id=$1", [E]);
ok("defect events are append-only", !!r.error);

r = await as(A, "insert into storage.objects (bucket_id, name) values ('inspection-photos', $1)", [`${P}/${id()}.jpg`]);
ok("member uploads photo to project folder", !r.error, r.error);
r = await as(B, "insert into storage.objects (bucket_id, name) values ('inspection-photos', $1)", [`${P}/${id()}.jpg`]);
ok("outsider cannot upload to project folder", !!r.error);
r = await as(B, "select * from storage.objects where bucket_id='inspection-photos'");
ok("outsider cannot list project photos", r.rows.length === 0);
r = await as(V, "insert into storage.objects (bucket_id, name) values ('inspection-photos', 'not-a-uuid/x.jpg')");
ok("malformed storage path rejected", !!r.error);

r = await as(A, "update public.properties set transfer_date_actual='2026-11-18' where id=$1", [H]);
r = await as(A, "select claim_deadline::text d from public.property_deadlines where id=$1", [H]);
ok("deadline view: 18 Nov + 15 = 3 Dec", r.rows[0]?.d === "2026-12-03", JSON.stringify(r));


// ── Phase 2: rooms, scope, photos ──────────────────────────────────────────────
const R1 = id(), R2 = id(), H2 = id();
r = await as(I, "insert into public.rooms (id, project_id, property_id, name, floor, sort_order) values ($1,$2,$3,'ห้องนั่งเล่น','ชั้น 1',10)", [R1, P, H]);
ok("inspector creates room", !r.error, r.error);
r = await as(V, "insert into public.rooms (id, project_id, property_id, name) values ($1,$2,$3,'x')", [id(), P, H]);
ok("viewer cannot create room", !!r.error);
r = await as(V, "select * from public.rooms");
ok("viewer can read rooms", r.rows.length === 1);
r = await as(B, "select * from public.rooms");
ok("outsider cannot read rooms", r.rows.length === 0);
r = await as(B, "insert into public.rooms (id, project_id, property_id, name) values ($1,$2,$3,'x')", [id(), P, H]);
ok("outsider cannot create room", !!r.error);
r = await as(I, "insert into public.rooms (id, project_id, property_id, name) values ($1,$2,$3,'')", [id(), P, H]);
ok("empty room name rejected", !!r.error);
r = await as(B, "insert into public.rooms (id, project_id, property_id, name) values ($1,$2,$3,'ข้ามโครงการ')", [id(), P2, H]);
ok("room cannot point at another project's property", !!r.error);

await as(A, "insert into public.properties (id, project_id, name) values ($1,$2,'บ้านหลังที่ 2')", [H2, P]);
await as(A, "insert into public.rooms (id, project_id, property_id, name) values ($1,$2,$3,'ห้องหลังที่ 2')", [R2, P, H2]);
r = await as(I, "update public.checklist_items set room_id=$2, scope='ENGINEERING' where id=$1", [IT, R1]);
ok("item links to a room of its own property + engineering scope", r.count === 1, r.error);
r = await as(I, "update public.checklist_items set room_id=$2 where id=$1", [IT, R2]);
ok("item cannot link to a room of another property", !!r.error);
r = await as(I, "update public.checklist_items set scope='STRUCTURAL' where id=$1", [IT]);
ok("invalid scope rejected", !!r.error);
r = await as(I, "update public.defects set room_id=$2, requires_engineer=true where id=$1", [D, R1]);
ok("defect links to room + requires_engineer", r.count === 1, r.error);
r = await as(I, "update public.defects set room_id=$2 where id=$1", [D, R2]);
ok("defect cannot link to a room of another property", !!r.error);

r = await as(I, "delete from public.rooms where id=$1", [R1]);
ok("inspector cannot hard-delete a room", r.count === 0);
r = await as(I, "update public.rooms set name='ห้องรับแขก', deleted_at = now() where id=$1", [R1]);
ok("inspector renames / soft-deletes room (sync path)", r.count === 1, r.error);

const PH = id();
r = await as(I, "insert into public.photos (id, project_id, property_id, defect_id, kind, storage_path, width, height, size_bytes) values ($1,$2,$3,$4,'DEFECT',$5,1600,1200,250000)", [PH, P, H, D, `${P}/${PH}.jpg`]);
ok("inspector adds defect photo row", !r.error, r.error);
r = await as(V, "insert into public.photos (id, project_id, property_id, defect_id, kind) values ($1,$2,$3,$4,'AFTER_FIX')", [id(), P, H, D]);
ok("viewer cannot add photo", !!r.error);
r = await as(I, "insert into public.photos (id, project_id, property_id, kind) values ($1,$2,$3,'ITEM')", [id(), P, H]);
ok("photo needs a defect or an item", !!r.error);
r = await as(B, "select * from public.photos");
ok("outsider cannot read photos", r.rows.length === 0);
r = await as(I, "update public.photos set deleted_at = now() where id=$1", [PH]);
ok("inspector soft-deletes photo", r.count === 1, r.error);

r = await as(A, "delete from public.rooms where id=$1", [R2]);
ok("admin hard-deletes room; items keep working (room_id set null)", !r.error, r.error);


// ── Phase 3: server-side LWW guard ─────────────────────────────────────────────
const IT2 = id();
await as(A, "insert into public.checklist_items (id, project_id, property_id, category_id, title, code, status, note, updated_at) values ($1,$2,$3,$4,'LWW','LWW-001','PASS','newer', '2026-11-14T10:05:00Z')", [IT2, P, H, C]);
const serverTs = async () => (await db.query("select server_updated_at::text s from public.checklist_items where id=$1", [IT2])).rows[0].s;
const ts0 = await serverTs();
r = await as(I, "update public.checklist_items set status='FAIL', note='stale offline edit', updated_at='2026-11-14T10:00:00Z' where id=$1", [IT2]);
ok("stale write is accepted without error (client ack succeeds)", !r.error && r.count === 1, r.error);
r = await as(A, "select status, note from public.checklist_items where id=$1", [IT2]);
ok("stale write does NOT overwrite newer content", r.rows[0].status === "PASS" && r.rows[0].note === "newer", JSON.stringify(r.rows));
ok("stale write still advances server_updated_at (all devices pull the winner)", (await serverTs()) > ts0);
r = await as(I, "update public.checklist_items set status='NEEDS_REINSPECTION', updated_at='2026-11-14T10:10:00Z' where id=$1", [IT2]);
r = await as(A, "select status, updated_at::text u from public.checklist_items where id=$1", [IT2]);
ok("newer write wins", r.rows[0].status === "NEEDS_REINSPECTION" && r.rows[0].u.startsWith("2026-11-14 10:10"), JSON.stringify(r.rows));
r = await as(I, "update public.checklist_items set status='NEEDS_REINSPECTION', updated_at='2026-11-14T10:10:00Z' where id=$1", [IT2]);
ok("re-pushing the identical row (retry) is idempotent", !r.error);

r = await as(A, "update public.projects set deleted_at = now() where id=$1", [P]);
ok("admin can soft-delete project", r.count === 1, r.error);

console.log(`\n${passed} passed, ${failed} failed`);
await db.end();
process.exit(failed ? 1 : 0);
