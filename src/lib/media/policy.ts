/** Size/duration policy for inspection media. Pure — unit tested. */
export const VIDEO_MAX_SECONDS = 30;
/** Server bucket limit is 15 MB; stay under it with margin. */
export const VIDEO_MAX_BYTES = 14 * 1024 * 1024;
/** Videos at or under this size are kept as recorded (already small enough). */
export const VIDEO_KEEP_BYTES = 4 * 1024 * 1024;
export const VIDEO_TARGET_HEIGHT = 720;
export const VIDEO_BITRATE = 1_200_000;
export const AUDIO_BITRATE = 64_000;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** "video/webm;codecs=vp9,opus" → "video/webm" (Storage matches the bare type). */
export const baseMime = (type: string) => type.split(";")[0].trim().toLowerCase();
export const isVideoMime = (type: string) => baseMime(type).startsWith("video/");
export const extensionFor = (type: string) => EXT[baseMime(type)] ?? (isVideoMime(type) ? "mp4" : "jpg");
export const SUPPORTED_VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type VideoPlan =
  | { action: "reject"; reason: string }
  | { action: "keep" }
  | { action: "compress"; fallbackKeep: boolean };

/** Decides what to do with a picked/recorded video. */
export function planVideo(info: { bytes: number; durationSec: number; height: number; type: string }): VideoPlan {
  if (!Number.isFinite(info.durationSec) || info.durationSec <= 0) return { action: "reject", reason: "อ่านความยาววิดีโอไม่ได้ ลองอัดใหม่อีกครั้ง" };
  if (info.durationSec > VIDEO_MAX_SECONDS + 0.5) return { action: "reject", reason: `วิดีโอยาว ${Math.round(info.durationSec)} วินาที เกิน ${VIDEO_MAX_SECONDS} วินาที กรุณาอัดให้สั้นลง` };
  const supported = SUPPORTED_VIDEO.has(baseMime(info.type));
  if (supported && info.bytes <= VIDEO_KEEP_BYTES && info.height <= VIDEO_TARGET_HEIGHT * 1.5) return { action: "keep" };
  return { action: "compress", fallbackKeep: supported && info.bytes <= VIDEO_MAX_BYTES };
}

/** Output size for a downscale to at most 720p (short side), even dimensions for encoders. */
export function targetSize(width: number, height: number, maxShort = VIDEO_TARGET_HEIGHT) {
  const short = Math.min(width, height);
  const k = short > maxShort ? maxShort / short : 1;
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { width: even(width), height: even(height) };
}

export const formatDuration = (sec: number | null | undefined) => {
  if (!sec || sec <= 0) return "";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
