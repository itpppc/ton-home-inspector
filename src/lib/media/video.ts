"use client";
import { AUDIO_BITRATE, baseMime, planVideo, targetSize, VIDEO_BITRATE, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "./policy";

export interface VideoInfo { durationSec: number; width: number; height: number }
export interface PreparedVideo extends VideoInfo { blob: Blob; compressed: boolean }

function load(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.playsInline = true;
    v.muted = true;
    const timer = setTimeout(() => reject(new Error("เปิดวิดีโอไม่ได้ (หมดเวลา)")), 15_000);
    v.onloadedmetadata = () => { clearTimeout(timer); resolve(v); };
    v.onerror = () => { clearTimeout(timer); reject(new Error("เปิดวิดีโอไม่ได้ รูปแบบไฟล์ไม่รองรับ")); };
    v.src = src;
  });
}

/** Duration + size. MediaRecorder webm files report Infinity until seeked to the end. */
async function probe(v: HTMLVideoElement): Promise<VideoInfo> {
  let d = v.duration;
  if (!Number.isFinite(d)) {
    d = await new Promise<number>((resolve) => {
      const done = () => { v.ontimeupdate = null; resolve(v.duration); v.currentTime = 0; };
      v.ontimeupdate = done;
      v.currentTime = 1e7;
      setTimeout(done, 3000);
    });
  }
  return { durationSec: d, width: v.videoWidth, height: v.videoHeight };
}

const RECORDER_TYPES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
export const canCompressVideo = () =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype &&
  RECORDER_TYPES.some((t) => MediaRecorder.isTypeSupported(t));

/** Re-encodes in real time (≈ video length) to ≤720p at ~1.2 Mbps, keeping audio where the browser allows. */
async function compress(v: HTMLVideoElement, info: VideoInfo, onProgress?: (pct: number) => void): Promise<Blob> {
  const mime = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t))!;
  const size = targetSize(info.width || 1280, info.height || 720);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx2d = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaElementSource(v); // not connected to speakers → silent
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    v.muted = false;
  } catch {
    v.muted = true; // no audio graph: keep the picture
  }

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: AUDIO_BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    void audioCtx?.close().catch(() => undefined);
  };
  const draw = () => {
    if (stopped) return;
    ctx2d.drawImage(v, 0, 0, canvas.width, canvas.height);
    onProgress?.(Math.min(99, Math.round((v.currentTime / info.durationSec) * 100)));
    if ("requestVideoFrameCallback" in v) (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };

  v.currentTime = 0;
  v.onended = stop;
  const guard = setTimeout(stop, (info.durationSec * 2 + 15) * 1000);
  recorder.start(1000);
  try {
    await v.play();
  } catch {
    v.muted = true; // autoplay with sound refused → continue silently
    await v.play();
  }
  draw();
  await finished;
  clearTimeout(guard);
  onProgress?.(100);
  return new Blob(chunks, { type: baseMime(mime) });
}

/** Validates a picked/recorded video and shrinks it when needed. Throws a Thai message on rejection. */
export async function prepareVideo(file: File, onProgress?: (pct: number) => void): Promise<PreparedVideo> {
  const url = URL.createObjectURL(file);
  try {
    const v = await load(url);
    const info = await probe(v);
    const plan = planVideo({ bytes: file.size, durationSec: info.durationSec, height: Math.min(info.width, info.height), type: file.type });
    if (plan.action === "reject") throw new Error(plan.reason);
    const keep = (): PreparedVideo => ({ ...info, blob: new Blob([file], { type: baseMime(file.type) }), compressed: false });
    if (plan.action === "keep") return keep();
    if (!canCompressVideo()) {
      if (plan.fallbackKeep) return keep();
      throw new Error(`วิดีโอใหญ่เกินไป และเครื่องนี้ย่อวิดีโอไม่ได้ กรุณาอัดให้สั้นลง (ไม่เกิน ${VIDEO_MAX_SECONDS} วินาที)`);
    }
    let blob: Blob;
    try {
      blob = await compress(v, info, onProgress);
    } catch {
      if (plan.fallbackKeep) return keep();
      throw new Error("ย่อวิดีโอไม่สำเร็จ กรุณาอัดใหม่ให้สั้นลง");
    }
    // Keep whichever is smaller; refuse anything still over the server limit.
    const best = blob.size > 0 && blob.size < file.size ? blob : file;
    if (best.size > VIDEO_MAX_BYTES) throw new Error("วิดีโอยังใหญ่เกิน 14 MB หลังย่อแล้ว กรุณาอัดให้สั้นลง");
    const size = best === blob ? targetSize(info.width, info.height) : info;
    return { durationSec: info.durationSec, width: size.width, height: size.height, blob: best === blob ? blob : new Blob([file], { type: baseMime(file.type) }), compressed: best === blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}
