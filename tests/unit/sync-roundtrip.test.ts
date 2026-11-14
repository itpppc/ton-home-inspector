import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import * as repo from "@/lib/db/repo";
import { createDefect, transitionDefect } from "@/lib/db/defects";
import { savePhoto } from "@/lib/db/photos";
import { SyncEngine } from "@/lib/sync/engine";
import { SYNC_TABLES } from "@/lib/domain/types";

/** In-memory stand-in for Supabase (PostgREST + Storage) with the same rules our migrations enforce. */
class FakeServer {
  tables = new Map<string, Map<string, Record<string, unknown>>>(SYNC_TABLES.map((t) => [t, new Map()]));
  objects = new Map<string, Blob>();
  clock = 0;
  failUploads = new Set<string>();
  failTables = new Set<string>();
  violations: string[] = [];
  beforeUpsert: ((table: string) => Promise<void>) | null = null;
  upsertCalls = 0;

  private tick = () => new Date(1_800_000_000_000 + ++this.clock * 1000).toISOString();

  private upsertOne(table: string, row: Record<string, unknown>) {
    const store = this.tables.get(table)!;
    const parent = (t: string, key: string) => row[key] == null || this.tables.get(t)!.has(row[key] as string);
    if (table === "properties" && !parent("projects", "project_id")) this.violations.push("properties→projects");
    if (table === "rooms" && !parent("properties", "property_id")) this.violations.push("rooms→properties");
    if (table === "checklist_items" && !(parent("checklist_categories", "category_id") && parent("rooms", "room_id"))) this.violations.push("items→category/room");
    if (table === "defects" && !(parent("properties", "property_id") && parent("checklist_items", "item_id"))) this.violations.push("defects→parents");
    if (table === "defect_events" && !parent("defects", "defect_id")) this.violations.push("events→defects");
    if (table === "photos") {
      if (!parent("defects", "defect_id")) this.violations.push("photos→defects");
      if (!row.deleted_at && row.storage_path && !this.objects.has(row.storage_path as string)) this.violations.push(`photo row without file: ${row.storage_path}`);
    }
    const old = store.get(row.id as string);
    // migration 0005: a stale write keeps the stored content; server_updated_at always advances
    const next = old && (row.updated_at as string) < (old.updated_at as string) ? { ...old } : { ...row };
    store.set(row.id as string, { ...next, server_updated_at: this.tick() });
  }

  client() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the fake's nested objects need the outer instance
    const server = this;
    return {
      from(table: string) {
        return {
          async upsert(rows: Record<string, unknown> | Record<string, unknown>[]) {
            server.upsertCalls++;
            if (server.failTables.has(table)) return { error: { message: `TypeError: Failed to fetch (${table})` } };
            await server.beforeUpsert?.(table);
            for (const r of Array.isArray(rows) ? rows : [rows]) server.upsertOne(table, r);
            return { error: null };
          },
          select() {
            let cursor: string | null = null;
            const q = {
              order: () => q,
              limit: () => q,
              gt: (_col: string, v: string) => { cursor = v; return q; },
              then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
                const rows = [...server.tables.get(table)!.values()].filter((r) => !cursor || (r.server_updated_at as string) > cursor)
                  .sort((a, b) => (a.server_updated_at as string).localeCompare(b.server_updated_at as string));
                resolve({ data: rows, error: null });
              },
            };
            return q;
          },
        };
      },
      storage: {
        from: () => ({
          async upload(path: string, blob: Blob) {
            if (server.failUploads.has(path)) return { error: { message: "Failed to fetch" } };
            server.objects.set(path, blob);
            return { error: null };
          },
        }),
      },
    } as never;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const newDevice = () => { const db = new InspectorDB(`sync-${++n}`); setDB(db); return db; };
function engineFor(server: FakeServer) {
  const e = new SyncEngine();
  Object.assign(e as unknown as Record<string, unknown>, { client: server.client(), userId: "u1" });
  return e;
}
const phaseOf = (e: SyncEngine) => { let p = ""; e.subscribe((s) => (p = s.phase))(); return p; };

async function work(opts: { photos?: number } = {}) {
  await repo.seedDefaultData(null);
  const db = getDB();
  const property = (await db.properties.toArray())[0];
  const items = await db.checklist_items.filter(alive).toArray();
  await repo.setItemStatus(items[0].id, "FAIL", "u1");
  const defect = await createDefect({ property, itemId: items[0].id, actor: "u1", values: { title: "น้ำซึม", description: null, category: null, room_id: items[0].room_id, severity: "HIGH", requires_engineer: false, recommendation: null, due_date: null } });
  await transitionDefect(defect.id, "SUBMITTED", "แจ้งแล้ว", "u1");
  const photos = [];
  for (let i = 0; i < (opts.photos ?? 2); i++) {
    photos.push(await savePhoto({ target: { project_id: property.project_id, property_id: property.id, defect_id: defect.id }, kind: i ? "AFTER_FIX" : "DEFECT", blob: new Blob([new Uint8Array([i, 1, 2, 3])], { type: "image/jpeg" }), width: 2, height: 2 }));
  }
  return { db, property, items, defect, photos };
}

beforeEach(() => { vi.stubGlobal("navigator", { onLine: true }); });
afterEach(() => vi.unstubAllGlobals());

describe("offline → online round trip (zero data loss)", () => {
  it("everything captured offline reaches the server once the network returns", async () => {
    const server = new FakeServer();
    const db = newDevice();
    const engine = engineFor(server);

    vi.stubGlobal("navigator", { onLine: false });
    const { defect, photos } = await work();
    await engine.syncNow();
    expect(phaseOf(engine)).toBe("offline");
    expect(server.upsertCalls).toBe(0); // nothing sent while offline
    expect(await db.outbox.count()).toBeGreaterThan(200); // …but nothing dropped either
    expect(await db.photo_blobs.where("uploaded").equals(0).count()).toBe(2);

    vi.stubGlobal("navigator", { onLine: true });
    await engine.syncNow();
    expect(phaseOf(engine)).toBe("idle");
    expect(await db.outbox.count()).toBe(0);
    expect(server.violations).toEqual([]);
    for (const t of SYNC_TABLES) expect(server.tables.get(t)!.size, t).toBe(await db.table(t).count());
    expect(server.tables.get("defects")!.get(defect.id)).toMatchObject({ status: "SUBMITTED", title: "น้ำซึม" });
    for (const p of photos) expect(server.objects.has(p.storage_path!)).toBe(true);
    expect(await db.photo_blobs.where("uploaded").equals(0).count()).toBe(0);
  });

  it("a flaky network never loses a photo or pushes a photo row without its file; retry completes", async () => {
    const server = new FakeServer();
    const db = newDevice();
    const engine = engineFor(server);
    const { photos, defect } = await work();

    server.failUploads.add(photos[1].storage_path!);
    server.failTables.add("defect_events");
    await engine.syncNow();
    expect(phaseOf(engine)).toBe("error");
    expect(server.violations).toEqual([]); // the photo row whose file failed was held back
    expect(server.tables.get("photos")!.has(photos[1].id)).toBe(false);
    expect(server.tables.get("photos")!.has(photos[0].id)).toBe(true);
    expect(await db.outbox.get(`photos:${photos[1].id}`)).toBeTruthy();
    expect(await db.outbox.get(`defects:${defect.id}`)).toBeUndefined(); // acked
    expect((await db.photo_blobs.get(photos[1].id))!.blob.size).toBe(4); // still on the phone

    server.failUploads.clear();
    server.failTables.clear();
    await engine.syncNow();
    expect(phaseOf(engine)).toBe("idle");
    expect(await db.outbox.count()).toBe(0);
    expect(server.violations).toEqual([]);
    for (const t of SYNC_TABLES) expect(server.tables.get(t)!.size, t).toBe(await db.table(t).count());
    expect(server.objects.size).toBe(2);
  });

  it("an edit made while a push is in flight stays queued and is sent on the next sync", async () => {
    const server = new FakeServer();
    const db = newDevice();
    const engine = engineFor(server);
    const { items } = await work({ photos: 0 });
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);

    await repo.setItemStatus(items[2].id, "PASS", "u1");
    let edited = false;
    server.beforeUpsert = async (table) => {
      if (table === "checklist_items" && !edited) {
        edited = true;
        await sleep(3);
        await repo.setItemStatus(items[2].id, "FAIL", "u1"); // user taps again mid-sync
      }
    };
    await engine.syncNow();
    server.beforeUpsert = null;
    expect(edited).toBe(true);
    expect(await db.outbox.get(`checklist_items:${items[2].id}`)).toBeTruthy(); // not acked away
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(server.tables.get("checklist_items")!.get(items[2].id)!.status).toBe("FAIL");
  });
});

describe("two devices", () => {
  it("device B pulls everything A did and its changes flow back (fixed → item needs reinspection)", async () => {
    const server = new FakeServer();
    const dbA = newDevice();
    const { defect, items, photos } = await work();
    const engineA = engineFor(server);
    await engineA.syncNow();

    const dbB = newDevice();
    const engineB = engineFor(server);
    await engineB.syncNow();
    for (const t of SYNC_TABLES) expect(await dbB.table(t).count(), t).toBe(await dbA.table(t).count());
    expect(await dbB.photos.count()).toBe(2);
    expect(await dbB.photo_blobs.count()).toBe(0); // files are fetched via signed URL, not copied
    expect((await dbB.photos.get(photos[0].id))!.storage_path).toBe(photos[0].storage_path);

    await transitionDefect(defect.id, "FIXED", null, "u2");
    await engineB.syncNow();
    setDB(dbA);
    await engineA.syncNow();
    expect((await dbA.defects.get(defect.id))!.status).toBe("FIXED");
    expect((await dbA.checklist_items.get(items[0].id))!.status).toBe("NEEDS_REINSPECTION");
  });

  it("an older offline edit never overwrites a newer one from another device", async () => {
    const server = new FakeServer();
    const dbA = newDevice();
    const { items } = await work({ photos: 0 });
    const engineA = engineFor(server);
    await engineA.syncNow();

    const dbB = newDevice();
    const engineB = engineFor(server);
    await engineB.syncNow();

    // A edits first (stays offline), B edits LATER and syncs
    setDB(dbA);
    await repo.setItemStatus(items[3].id, "FAIL", "A");
    await sleep(5);
    setDB(dbB);
    await repo.setItemStatus(items[3].id, "PASS", "B");
    await engineB.syncNow();
    expect(server.tables.get("checklist_items")!.get(items[3].id)!.status).toBe("PASS");

    // A comes online: its stale write is accepted but loses, and A converges on B's value
    setDB(dbA);
    await engineA.syncNow();
    expect(server.tables.get("checklist_items")!.get(items[3].id)!.status).toBe("PASS");
    expect((await dbA.checklist_items.get(items[3].id))!.status).toBe("PASS");
    setDB(dbB);
    await engineB.syncNow();
    expect((await dbB.checklist_items.get(items[3].id))!.status).toBe("PASS");
  });
});
