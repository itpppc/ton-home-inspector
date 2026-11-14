"use client";
import * as React from "react";
import { getDB } from "@/lib/db/local";
import { getSupabase } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/supabase/config";
import type { Photo } from "@/lib/domain/types";

const SIGNED_TTL_S = 60 * 60;
const signedCache = new Map<string, { url: string; exp: number }>();

/**
 * Resolves a displayable URL for a photo: the on-device file first (works offline),
 * otherwise a short-lived signed URL from private Storage.
 */
export function usePhotoUrl(photo: Pick<Photo, "id" | "storage_path">): { url: string | null; missing: boolean } {
  const [state, setState] = React.useState<{ url: string | null; missing: boolean }>({ url: null, missing: false });
  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      const local = await getDB().photo_blobs.get(photo.id);
      if (cancelled) return;
      if (local) {
        objectUrl = URL.createObjectURL(local.blob);
        setState({ url: objectUrl, missing: false });
        return;
      }
      const path = photo.storage_path;
      const client = getSupabase();
      if (!path || !client) return setState({ url: null, missing: true });
      const hit = signedCache.get(path);
      if (hit && hit.exp > Date.now()) return setState({ url: hit.url, missing: false });
      const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_TTL_S);
      if (cancelled) return;
      if (error || !data) return setState({ url: null, missing: true });
      signedCache.set(path, { url: data.signedUrl, exp: Date.now() + (SIGNED_TTL_S - 60) * 1000 });
      setState({ url: data.signedUrl, missing: false });
    })().catch(() => !cancelled && setState({ url: null, missing: true }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.storage_path]);
  return state;
}
