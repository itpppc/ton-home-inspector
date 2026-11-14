/** Client-side image compression: EXIF-aware decode → max edge 1600px → JPEG. */
export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 1600;
const QUALITY = 0.78;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> (e.g. older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function compressImage(file: File | Blob): Promise<CompressedImage> {
  if (file.size === 0) throw new Error("ไฟล์รูปว่างเปล่า");
  if (file.size > MAX_INPUT_BYTES) throw new Error("ไฟล์รูปใหญ่เกิน 25MB");
  if (file.type && !file.type.startsWith("image/")) throw new Error("รองรับเฉพาะไฟล์รูปภาพ");
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error("เปิดไฟล์รูปนี้ไม่ได้ (รองรับ JPEG/PNG/WebP — iPhone: ตั้งค่ากล้องเป็น Most Compatible)");
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับการประมวลผลรูป");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("บีบอัดรูปไม่สำเร็จ"))), "image/jpeg", QUALITY));
    return { blob, width, height };
  } finally {
    decoded.close();
  }
}
