"use client";
import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile, Role } from "@/lib/domain/types";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDB, getMeta, setMeta } from "@/lib/db/local";
import { seedDefaultData } from "@/lib/db/repo";
import { syncEngine } from "@/lib/sync/engine";

type Status = "loading" | "signed-out" | "signed-in";

interface AuthContextValue {
  mode: "local" | "cloud";
  status: Status;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** Effective role in a project (local mode = ADMIN). */
  roleFor: (projectId: string | null | undefined, ownerId?: string | null) => Role | null;
  canEdit: (projectId: string | null | undefined, ownerId?: string | null) => boolean;
  isAdmin: (projectId: string | null | undefined, ownerId?: string | null) => boolean;
  canCreateProject: boolean;
  /** System administrator (global role ADMIN, cloud mode only). */
  isSystemAdmin: boolean;
  /** Account suspended by a system admin: all project data is blocked server-side. */
  suspended: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const LOCAL_PROFILE: Profile = { id: "local", email: null, full_name: "ผู้ใช้ในเครื่องนี้", role: "ADMIN" };
const TABLES_TO_CLEAR = ["projects", "properties", "checklist_categories", "checklist_items", "defects", "defect_events", "photos", "photo_blobs", "outbox", "sync_state"] as const;

/** Makes the local DB belong to `userId`: adopts Local-mode data, or wipes another user's cache. */
async function bindLocalData(userId: string) {
  const db = getDB();
  const bound = await getMeta<string>("boundUser");
  if (bound === userId) return;
  if (bound && bound !== "local") {
    await db.transaction("rw", TABLES_TO_CLEAR.map((t) => db.table(t)), async () => {
      for (const t of TABLES_TO_CLEAR) await db.table(t).clear();
    });
    await db.meta.where("key").startsWith("pulled:").delete();
  } else {
    const orphans = await db.projects.filter((p) => p.owner_id === null).toArray();
    const at = new Date().toISOString();
    await db.transaction("rw", db.projects, db.outbox, async () => {
      for (const p of orphans) {
        await db.projects.put({ ...p, owner_id: userId, updated_at: at });
        await db.outbox.put({ key: `projects:${p.id}`, table: "projects", row_id: p.id, queued_at: at, attempts: 0, last_error: null });
      }
    });
  }
  await setMeta("boundUser", userId);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode = isSupabaseConfigured ? "cloud" : "local";
  const [status, setStatus] = React.useState<Status>("loading");
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [memberships, setMemberships] = React.useState<Record<string, Role>>({});
  const userId = session?.user.id ?? null;

  const loadProfile = React.useCallback(async (uid: string) => {
    const sb = getSupabase();
    const cachedP = await getMeta<Profile>(`profile:${uid}`);
    const cachedM = await getMeta<Record<string, Role>>(`memberships:${uid}`);
    if (cachedP) setProfile(cachedP);
    if (cachedM) setMemberships(cachedM);
    if (!sb || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    const [p, m] = await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(), // "*": tolerant of columns added by later migrations
      sb.from("project_members").select("project_id,role").eq("user_id", uid),
    ]);
    if (p.data) {
      const d = p.data as Profile;
      const next: Profile = { id: d.id, email: d.email, full_name: d.full_name, role: d.role, disabled_at: d.disabled_at ?? null };
      setProfile(next);
      await setMeta(`profile:${uid}`, next);
    }
    if (m.data) {
      const map = Object.fromEntries(m.data.map((r) => [r.project_id as string, r.role as Role]));
      setMemberships(map);
      await setMeta(`memberships:${uid}`, map);
    }
  }, []);

  // Local mode bootstrap.
  React.useEffect(() => {
    if (mode !== "local") return;
    let cancelled = false;
    (async () => {
      const bound = await getMeta<string>("boundUser");
      if (!bound) await setMeta("boundUser", "local");
      await seedDefaultData(null);
      if (cancelled) return;
      setProfile(LOCAL_PROFILE);
      setStatus("signed-in");
      syncEngine.startLocal();
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Cloud mode: follow Supabase session.
  React.useEffect(() => {
    const sb = getSupabase();
    if (mode !== "cloud" || !sb) return;
    let active = true;
    const apply = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      if (!s) {
        syncEngine.stop();
        setProfile(null);
        setMemberships({});
        setStatus("signed-out");
        return;
      }
      await bindLocalData(s.user.id);
      setStatus("signed-in");
      void loadProfile(s.user.id);
      // Cloud accounts start empty: a seeded demo house would use up the FREE plan's only slot.
      syncEngine.start(sb, s.user.id, async () => {
        await loadProfile(s.user.id);
      });
    };
    void sb.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(s);
        return;
      }
      void apply(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      syncEngine.stop();
    };
  }, [mode, loadProfile]);

  // Memberships change when projects are created/shared; refresh after each sync.
  React.useEffect(() => {
    if (!userId) return;
    let last: string | null = null;
    return syncEngine.subscribe((s) => {
      if (s.lastSyncedAt && s.lastSyncedAt !== last) {
        last = s.lastSyncedAt;
        void loadProfile(userId);
      }
    });
  }, [userId, loadProfile]);

  const value = React.useMemo<AuthContextValue>(() => {
    const roleFor: AuthContextValue["roleFor"] = (projectId, ownerId) => {
      if (mode === "local") return "ADMIN";
      if (!userId) return null;
      if (projectId && memberships[projectId]) return memberships[projectId];
      if (ownerId && ownerId === userId) return "ADMIN"; // created locally, membership not synced yet
      return null;
    };
    return {
      mode,
      status,
      userId: mode === "local" ? null : userId,
      email: session?.user.email ?? null,
      profile,
      roleFor,
      canEdit: (p, o) => {
        const r = roleFor(p, o);
        return r === "ADMIN" || r === "INSPECTOR";
      },
      isAdmin: (p, o) => roleFor(p, o) === "ADMIN",
      canCreateProject: mode === "local" || ((profile?.role ?? "INSPECTOR") !== "VIEWER" && !profile?.disabled_at),
      isSystemAdmin: mode === "cloud" && profile?.role === "ADMIN" && !profile.disabled_at,
      suspended: mode === "cloud" && !!profile?.disabled_at,
      refreshProfile: async () => {
        if (userId) await loadProfile(userId);
      },
      signOut: async () => {
        await getSupabase()?.auth.signOut();
      },
    };
  }, [mode, status, userId, session, profile, memberships, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
