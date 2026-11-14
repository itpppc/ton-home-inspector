"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB, setMeta } from "@/lib/db/local";
import { alive } from "@/lib/db/mutations";
import type { Project, Property } from "@/lib/domain/types";

export interface Workspace {
  loading: boolean;
  projects: Project[];
  properties: Property[];
  property: Property | null;
  project: Project | null;
}

/** Current property (persisted) with a safe fallback to the first available one. */
export function useWorkspace(): Workspace {
  const data = useLiveQuery(async () => {
    const db = getDB();
    const [projects, properties, current] = await Promise.all([
      db.projects.filter(alive).toArray(),
      db.properties.filter(alive).toArray(),
      db.meta.get("currentPropertyId"),
    ]);
    projects.sort((a, b) => a.name.localeCompare(b.name, "th"));
    properties.sort((a, b) => a.name.localeCompare(b.name, "th"));
    const liveProjectIds = new Set(projects.map((p) => p.id));
    const visible = properties.filter((p) => liveProjectIds.has(p.project_id));
    const property = visible.find((p) => p.id === current?.value) ?? visible[0] ?? null;
    const project = property ? projects.find((p) => p.id === property.project_id) ?? null : projects[0] ?? null;
    return { projects, properties: visible, property, project };
  }, []);
  return data ? { loading: false, ...data } : { loading: true, projects: [], properties: [], property: null, project: null };
}

export const selectProperty = (id: string) => setMeta("currentPropertyId", id);
