"use client";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, ImageOff, Trash2 } from "lucide-react";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { deletePhoto } from "@/lib/db/photos";
import type { Photo, PhotoKind } from "@/lib/domain/types";
import { PHOTO_KIND_META } from "@/lib/domain/labels";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { usePhotoUrl } from "./photo-url";

export function usePhotos(filter: { defectId?: string; itemId?: string; propertyId?: string; kinds?: PhotoKind[] }) {
  const { defectId, itemId, propertyId, kinds } = filter;
  const kindKey = kinds?.join(",") ?? "";
  return useLiveQuery(async () => {
    const db = getDB();
    const rows = defectId
      ? await db.photos.where("defect_id").equals(defectId).filter(alive).toArray()
      : itemId
        ? await db.photos.where("item_id").equals(itemId).filter((p) => alive(p) && !p.defect_id).toArray()
        : propertyId
          ? await db.photos.where("property_id").equals(propertyId).filter((p) => alive(p) && p.kind === "PROPERTY").toArray()
          : [];
    const wanted = kindKey ? new Set(kindKey.split(",")) : null;
    const pending = new Set(await db.photo_blobs.where("uploaded").equals(0).primaryKeys());
    return rows
      .filter((p) => !wanted || wanted.has(p.kind))
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      .map((p) => ({ ...p, pendingUpload: pending.has(p.id) }));
  }, [defectId, itemId, propertyId, kindKey]);
}

type GalleryPhoto = Photo & { pendingUpload: boolean };

function Thumb({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const { url, missing } = usePhotoUrl(photo);
  return (
    <button type="button" onClick={onOpen} className="relative aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label={`ดูรูป ${PHOTO_KIND_META[photo.kind].label} ${formatDateTime(photo.taken_at)}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob/signed URLs, not optimisable
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">{missing ? <ImageOff className="size-5" /> : null}</span>
      )}
      {photo.pendingUpload && (
        <span className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" title="ยังไม่อัปโหลด (เก็บในเครื่องแล้ว)"><CloudOff className="size-3" aria-hidden /></span>
      )}
    </button>
  );
}

function Viewer({ photo, canDelete, onClose }: { photo: GalleryPhoto; canDelete: boolean; onClose: () => void }) {
  const { url } = usePhotoUrl(photo);
  return (
    <DialogContent title={PHOTO_KIND_META[photo.kind].label} description={formatDateTime(photo.taken_at)} className="sm:max-w-3xl">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.caption ?? PHOTO_KIND_META[photo.kind].label} className="mx-auto max-h-[70dvh] w-auto rounded-lg" />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่สามารถโหลดรูปได้ (ออฟไลน์และไม่มีไฟล์ในเครื่องนี้)</p>
      )}
      {photo.pendingUpload && <p className="mt-2 text-xs text-muted-foreground">รูปนี้เก็บในเครื่องแล้ว จะอัปโหลดอัตโนมัติเมื่อออนไลน์</p>}
      {canDelete && (
        <Button variant="destructive" className="mt-3" onClick={() => window.confirm("ลบรูปนี้?") && void deletePhoto(photo.id).then(onClose)}><Trash2 />ลบรูป</Button>
      )}
    </DialogContent>
  );
}

export function PhotoGallery({ photos, canDelete, emptyText }: { photos: GalleryPhoto[] | undefined; canDelete: boolean; emptyText?: string }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  if (!photos) return null;
  if (photos.length === 0) return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null;
  const open = photos.find((p) => p.id === openId) ?? null;
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" aria-label="รูปภาพ">
        {photos.map((p) => <li key={p.id}><Thumb photo={p} onOpen={() => setOpenId(p.id)} /></li>)}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && <Viewer photo={open} canDelete={canDelete} onClose={() => setOpenId(null)} />}
      </Dialog>
    </>
  );
}
