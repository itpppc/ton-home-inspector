"use client";
import { useSearchParams } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Reads ?id= and rejects anything that is not a UUID. */
export function useIdParam(): string | null {
  const id = useSearchParams().get("id");
  return id && UUID.test(id) ? id : null;
}
