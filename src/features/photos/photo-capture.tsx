"use client";
import * as React from "react";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image/compress";
import { savePhoto } from "@/lib/db/photos";
import type { PhotoKind } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PhotoTarget {
  project_id: string;
  property_id: string;
  defect_id?: string | null;
  item_id?: string | null;
}

/**
 * Camera + gallery picker. Each image is compressed on-device and saved to IndexedDB
 * together with its sync entry, so it survives a dead signal or the app being closed.
 */
export function PhotoCapture({ target, kind, disabled, size = "default", className, label = "ถ่ายรูป" }: {
  target: PhotoTarget;
  kind: PhotoKind;
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
  label?: string;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(0);

  async function handle(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setBusy(list.length);
    let saved = 0;
    for (const file of list) {
      try {
        const img = await compressImage(file);
        await savePhoto({ target, kind, blob: img.blob, width: img.width, height: img.height });
        saved++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกรูปไม่สำเร็จ");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (saved) toast.success(`บันทึกรูป ${saved} รูปในเครื่องแล้ว`);
  }

  const reset = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handle(e.target.files);
    e.target.value = ""; // allow picking the same file again
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Button type="button" size={size} variant="secondary" disabled={disabled || busy > 0} onClick={() => cameraRef.current?.click()}>
        {busy > 0 ? <LoaderCircle className="animate-spin" /> : <Camera />}
        {busy > 0 ? `กำลังบันทึก ${busy}…` : label}
      </Button>
      <Button type="button" size={size === "sm" ? "icon-sm" : "icon"} variant="outline" disabled={disabled || busy > 0} onClick={() => galleryRef.current?.click()} aria-label="เลือกรูปจากคลังภาพ">
        <ImagePlus />
      </Button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={reset} data-testid="photo-camera-input" />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={reset} data-testid="photo-gallery-input" />
    </div>
  );
}
