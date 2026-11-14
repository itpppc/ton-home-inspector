import type { Photo, PhotoKind } from "@/lib/domain/types";
import { nowIso, uid } from "@/lib/utils";
import { getDB } from "./local";
import { alive, notifyMutation } from "./mutations";

/**
 * Saves a photo row AND its binary in one IndexedDB transaction, so a photo can never
 * exist without its file (or vice versa) even if the app is killed mid-save.
 */
export async function savePhoto(args: {
  target: { project_id: string; property_id: string; defect_id?: string | null; item_id?: string | null };
  kind: PhotoKind;
  blob: Blob;
  width: number;
  height: number;
  caption?: string | null;
}): Promise<Photo> {
  const { target } = args;
  if (!target.defect_id && !target.item_id) throw new Error("ต้องระบุ Defect หรือรายการตรวจ");
  const db = getDB();
  const at = nowIso();
  const id = uid();
  const photo: Photo = {
    id,
    project_id: target.project_id,
    property_id: target.property_id,
    defect_id: target.defect_id ?? null,
    item_id: target.item_id ?? null,
    kind: args.kind,
    caption: args.caption?.trim() || null,
    storage_path: `${target.project_id}/${id}.jpg`,
    width: args.width,
    height: args.height,
    size_bytes: args.blob.size,
    taken_at: at,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await db.transaction("rw", db.photos, db.photo_blobs, db.outbox, async () => {
    await db.photo_blobs.put({ photo_id: id, blob: args.blob, uploaded: 0 });
    await db.photos.put(photo);
    await db.outbox.put({ key: `photos:${id}`, table: "photos", row_id: id, queued_at: at, attempts: 0, last_error: null });
  });
  notifyMutation();
  return photo;
}

export async function deletePhoto(id: string) {
  const db = getDB();
  const p = await db.photos.get(id);
  if (!p || !alive(p)) return;
  const at = nowIso();
  await db.transaction("rw", db.photos, db.outbox, async () => {
    await db.photos.put({ ...p, deleted_at: at, updated_at: at });
    await db.outbox.put({ key: `photos:${id}`, table: "photos", row_id: id, queued_at: at, attempts: 0, last_error: null });
  });
  notifyMutation();
}

/** Count of photo files saved on this device but not yet uploaded. */
export const pendingPhotoUploads = () => getDB().photo_blobs.where("uploaded").equals(0).count();
