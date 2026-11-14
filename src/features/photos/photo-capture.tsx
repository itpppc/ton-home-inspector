"use client";
import * as React from "react";
import { Camera, ImagePlus, LoaderCircle, Video } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image/compress";
import { savePhoto } from "@/lib/db/photos";
import { formatBytes, isVideoMime, VIDEO_MAX_SECONDS } from "@/lib/media/policy";
import { prepareVideo } from "@/lib/media/video"; // static: must work offline without fetching a chunk
import type { PhotoKind } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PhotoTarget {
  project_id: string;
  property_id?: string | null;
  defect_id?: string | null;
  item_id?: string | null;
}

/**
 * Camera + video + gallery picker. Images are compressed on-device; videos are limited to
 * 30 s and shrunk to ~720p. Each file is saved to IndexedDB together with its sync entry,
 * so it survives a dead signal or the app being closed.
 */
export function PhotoCapture({ target, kind, disabled, size = "default", className, label = "ถ่ายรูป", allowVideo = true }: {
  target: PhotoTarget;
  kind: PhotoKind;
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
  label?: string;
  allowVideo?: boolean;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<{ left: number; status: string } | null>(null);

  async function handle(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    let photos = 0, videos = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const left = list.length - i;
      try {
        if (isVideoMime(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
          if (!allowVideo) throw new Error("ช่องนี้แนบได้เฉพาะรูป");
          setBusy({ left, status: "กำลังเตรียมวิดีโอ…" });
          const v = await prepareVideo(file, (pct) => setBusy({ left, status: `กำลังย่อวิดีโอ ${pct}%` }));
          await savePhoto({ target, kind, blob: v.blob, width: v.width, height: v.height, durationSec: v.durationSec });
          videos++;
          if (v.compressed) toast.message(`ย่อวิดีโอจาก ${formatBytes(file.size)} เหลือ ${formatBytes(v.blob.size)}`);
        } else {
          setBusy({ left, status: `กำลังบันทึก ${left}…` });
          const img = await compressImage(file);
          await savePhoto({ target, kind, blob: img.blob, width: img.width, height: img.height });
          photos++;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไฟล์ไม่สำเร็จ");
      }
    }
    setBusy(null);
    const parts = [photos && `รูป ${photos} รูป`, videos && `วิดีโอ ${videos} คลิป`].filter(Boolean);
    if (parts.length) toast.success(`บันทึก${parts.join(" และ ")}ในเครื่องแล้ว`);
  }

  const reset = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handle(e.target.files);
    e.target.value = ""; // allow picking the same file again
  };
  const off = disabled || busy !== null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button type="button" size={size} variant="secondary" disabled={off} onClick={() => cameraRef.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Camera />}
        {busy ? <span aria-live="polite">{busy.status}</span> : label}
      </Button>
      {allowVideo && (
        <Button type="button" size={size === "sm" ? "icon-sm" : "icon"} variant="outline" disabled={off} onClick={() => videoRef.current?.click()} aria-label={`อัดวิดีโอ (ไม่เกิน ${VIDEO_MAX_SECONDS} วินาที)`} title={`อัดวิดีโอสั้น ไม่เกิน ${VIDEO_MAX_SECONDS} วินาที`}>
          <Video />
        </Button>
      )}
      <Button type="button" size={size === "sm" ? "icon-sm" : "icon"} variant="outline" disabled={off} onClick={() => galleryRef.current?.click()} aria-label={allowVideo ? "เลือกรูปหรือวิดีโอจากคลังภาพ" : "เลือกรูปจากคลังภาพ"}>
        <ImagePlus />
      </Button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={reset} data-testid="photo-camera-input" />
      {allowVideo && <input ref={videoRef} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={reset} data-testid="video-camera-input" />}
      <input ref={galleryRef} type="file" accept={allowVideo ? "image/*,video/*" : "image/*"} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={reset} data-testid="photo-gallery-input" />
    </div>
  );
}
