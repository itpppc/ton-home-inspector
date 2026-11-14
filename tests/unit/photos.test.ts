import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { InspectorDB, setDB, getDB } from "@/lib/db/local";
import { deletePhoto, pendingPhotoUploads, savePhoto } from "@/lib/db/photos";
import { uploadPhotoBlobs } from "@/lib/sync/engine";

let n = 0;
beforeEach(() => setDB(new InspectorDB(`photos-${++n}`)));

const target = { project_id: "p1", property_id: "pr1", defect_id: "d1" };
const blob = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

function fakeClient(result: { error: { message: string } | null }) {
  const calls: { path: string; size: number; opts: unknown }[] = [];
  return {
    calls,
    client: { storage: { from: () => ({ upload: async (path: string, b: Blob, opts: unknown) => { calls.push({ path, size: b.size, opts }); return result; } }) } } as never,
  };
}

describe("photo capture storage", () => {
  it("saves row + binary + outbox entry together", async () => {
    const p = await savePhoto({ target, kind: "DEFECT", blob: blob(), width: 10, height: 10 });
    const db = getDB();
    expect(await db.photos.get(p.id)).toMatchObject({ kind: "DEFECT", storage_path: `p1/${p.id}.jpg`, size_bytes: 3 });
    expect((await db.photo_blobs.get(p.id))!.uploaded).toBe(0);
    expect(await db.outbox.get(`photos:${p.id}`)).toBeTruthy();
    expect(await pendingPhotoUploads()).toBe(1);
  });

  it("requires a defect or an item", async () => {
    await expect(savePhoto({ target: { project_id: "p", property_id: "pr" }, kind: "ITEM", blob: blob(), width: 1, height: 1 })).rejects.toThrow();
    expect(await getDB().photos.count()).toBe(0);
  });
});

describe("photo upload before row push", () => {
  it("uploads the binary, marks it uploaded, and reports no failures", async () => {
    const p = await savePhoto({ target, kind: "DEFECT", blob: blob(), width: 1, height: 1 });
    const { client, calls } = fakeClient({ error: null });
    const { failed } = await uploadPhotoBlobs(client, [p]);
    expect(failed.size).toBe(0);
    expect(calls).toEqual([{ path: p.storage_path, size: 3, opts: { contentType: "image/jpeg", upsert: true } }]);
    expect((await getDB().photo_blobs.get(p.id))!.uploaded).toBe(1);
    expect(await pendingPhotoUploads()).toBe(0);
    // idempotent: a second pass does not upload again
    await uploadPhotoBlobs(client, [p]);
    expect(calls).toHaveLength(1);
  });

  it("keeps the binary and flags the photo when the upload fails (offline / error)", async () => {
    const p = await savePhoto({ target, kind: "AFTER_FIX", blob: blob(), width: 1, height: 1 });
    const { client } = fakeClient({ error: { message: "network down" } });
    const { failed } = await uploadPhotoBlobs(client, [p]);
    expect(failed.get(p.id)).toBe("network down");
    expect((await getDB().photo_blobs.get(p.id))!.uploaded).toBe(0);
    expect(await getDB().photo_blobs.get(p.id)).toBeTruthy(); // never lose the picture
  });

  it("drops the binary of a deleted photo without uploading it", async () => {
    const p = await savePhoto({ target, kind: "DEFECT", blob: blob(), width: 1, height: 1 });
    await deletePhoto(p.id);
    const { client, calls } = fakeClient({ error: null });
    await uploadPhotoBlobs(client, [(await getDB().photos.get(p.id))!]);
    expect(calls).toHaveLength(0);
    expect(await getDB().photo_blobs.get(p.id)).toBeUndefined();
  });
});
