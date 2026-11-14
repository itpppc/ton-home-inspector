"use client";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB, getMeta, setMeta } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { syncEngine } from "@/lib/sync/engine";
import { checkQuota, DEFAULT_PLANS, type MyPlan, type PlanRow, type Quota } from "./plans";

export interface PlanState {
  /** false in local mode or before migration 0007 is applied: nothing is limited. */
  enforced: boolean;
  loading: boolean;
  plans: PlanRow[];
  my: MyPlan | null;
  /** Usage counted from the local DB (includes rows not synced yet). */
  usage: { projects: number; properties: number };
  quota: (kind: "projects" | "properties") => Quota;
  refresh: () => Promise<void>;
}

/** Plan + quota for the signed-in user. Cached in Dexie meta so it works offline. */
export function usePlan(): PlanState {
  const { mode, userId } = useAuth();
  const [plans, setPlans] = React.useState<PlanRow[]>(DEFAULT_PLANS);
  const [my, setMy] = React.useState<MyPlan | null>(null);
  const [loading, setLoading] = React.useState(mode === "cloud");

  const usage = useLiveQuery(async () => {
    if (!userId) return { projects: 0, properties: 0 };
    const db = getDB();
    const mine = await db.projects.filter((p) => alive(p) && p.owner_id === userId).toArray();
    const ids = new Set(mine.map((p) => p.id));
    const properties = await db.properties.filter((h) => alive(h) && ids.has(h.project_id)).count();
    return { projects: mine.length, properties };
  }, [userId]) ?? { projects: 0, properties: 0 };

  const load = React.useCallback(async () => {
    if (mode !== "cloud" || !userId) return setLoading(false);
    const [cachedMy, cachedPlans] = await Promise.all([getMeta<MyPlan>(`plan:${userId}`), getMeta<PlanRow[]>("plans")]);
    if (cachedMy) setMy(cachedMy);
    if (cachedPlans?.length) setPlans(cachedPlans);
    const sb = getSupabase();
    if (sb && (typeof navigator === "undefined" || navigator.onLine)) {
      const [m, p] = await Promise.all([sb.rpc("my_plan"), sb.from("plans").select("*").order("sort_order")]);
      if (!m.error && m.data) {
        setMy(m.data as MyPlan);
        await setMeta(`plan:${userId}`, m.data);
      }
      if (!p.error && p.data?.length) {
        setPlans(p.data as PlanRow[]);
        await setMeta("plans", p.data);
      }
    }
    setLoading(false);
  }, [mode, userId]);

  React.useEffect(() => {
    void load();
    let last: string | null = null;
    return syncEngine.subscribe((s) => {
      if (s.lastSyncedAt && s.lastSyncedAt !== last) {
        if (last) void load();
        last = s.lastSyncedAt;
      }
    });
  }, [load]);

  const enforced = mode === "cloud" && !!my && !my.unlimited;
  return {
    enforced,
    loading,
    plans,
    my,
    usage,
    quota: (kind) => (enforced ? checkQuota(my, kind, usage[kind]) : { allowed: true, used: usage[kind], limit: null }),
    refresh: load,
  };
}
