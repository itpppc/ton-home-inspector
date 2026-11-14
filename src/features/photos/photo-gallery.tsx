"use client";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CloudOff, ImageOff, Play, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/media/policy";
import { getDB } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { deletePhoto } from "@/lib/db/photos";
import type { Photo, PhotoKind } from "@/lib/domain/types";
import { PHOTO_KIND_META } from "@/lib/domain/labels";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { usePhotoUrl } from "./photo-url";

export function usePhotos(filter: { defectId?: string; itemId?: string; propertyId?: string; projectId?: string; kinds?: PhotoKind[] }) {
  const { defectId, itemId, propertyId, projectId, kinds } = filter;
  const kindKey = kinds?.join(",") ?? "";
  return useLiveQuery(async () => {
    const db = getDB();
    const rows = defectId
      ? await db.photos.where("defect_id").equals(defectId).filter(alive).toArray()
      : itemId
        ? await db.photos.where("item_id").equals(itemId).filter((p) => alive(p) && !p.defect_id).toArray()
        : propertyId
          ? await db.photos.where("property_id").equals(propertyId).filter((p) => alive(p) && p.kind === "PROPERTY").toArray()
          : projectId
            ? await db.photos.where("project_id").equals(projectId).filter((p) => alive(p) && p.kind === "PROJECT").toArray()
            : [];
    const wanted = kindKey ? new Set(kindKey.split(",")) : null;
    const pending = new Set(await db.photo_blobs.where("uploaded").equals(0).primaryKeys());
    return rows
      .filter((p) => !wanted || wanted.has(p.kind))
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      .map((p) => ({ ...p, pendingUpload: pending.has(p.id) }));
  }, [defectId, itemId, propertyId, projectId, kindKey]);
}

type GalleryPhoto = Photo & { pendingUpload: boolean };

function Thumb({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const { url, missing } = usePhotoUrl(photo);
  const video = photo.media_type === "video";
  return (
    <button type="button" onClick={onOpen} className="relative aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${video ? "ดูวิดีโอ" : "ดูรูป"} ${PHOTO_KIND_META[photo.kind].label} ${formatDateTime(photo.taken_at)}`}>
      {url && video ? (
        <>
          {/* #t=0.1 makes iOS paint the first frame as a poster */}
          <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="pointer-events-none size-full bg-black object-cover" />
          <span className="absolute inset-0 grid place-items-center"><span className="rounded-full bg-black/60 p-2 text-white"><Play className="size-4 fill-current" aria-hidden /></span></span>
          {photo.duration_sec ? <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-medium tabular-nums text-white">{formatDuration(photo.duration_sec)}</span> : null}
        </>
      ) : url ? (
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
      {url && photo.media_type === "video" ? (
        <video src={url} controls playsInline autoPlay className="mx-auto max-h-[70dvh] w-full rounded-lg bg-black" aria-label={photo.caption ?? `วิดีโอ ${PHOTO_KIND_META[photo.kind].label}`} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.caption ?? PHOTO_KIND_META[photo.kind].label} className="mx-auto max-h-[70dvh] w-auto rounded-lg" />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">ไม่สามารถโหลดไฟล์ได้ (ออฟไลน์และไม่มีไฟล์ในเครื่องนี้)</p>
      )}
      {photo.pendingUpload && <p className="mt-2 text-xs text-muted-foreground">ไฟล์นี้เก็บในเครื่องแล้ว จะอัปโหลดอัตโนมัติเมื่อออนไลน์</p>}
      {canDelete && (
        <Button variant="destructive" className="mt-3" onClick={() => window.confirm(photo.media_type === "video" ? "ลบวิดีโอนี้?" : "ลบรูปนี้?") && void deletePhoto(photo.id).then(onClose)}><Trash2 />{photo.media_type === "video" ? "ลบวิดีโอ" : "ลบรูป"}</Button>
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
