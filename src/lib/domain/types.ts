/**
 * Core domain model. Field names are snake_case so local (IndexedDB) rows and
 * Supabase rows share one shape — no mapping layer to drift out of sync.
 */

export const ROLES = ["ADMIN", "INSPECTOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ITEM_STATUSES = ["NOT_CHECKED", "PASS", "FAIL", "NEEDS_REINSPECTION", "NOT_APPLICABLE"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DEFECT_STATUSES = ["OPEN", "SUBMITTED", "IN_PROGRESS", "FIXED", "VERIFIED", "REOPENED"] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const CONSTRUCTION_STATUSES = ["UNDER_CONSTRUCTION", "READY_FOR_INSPECTION", "INSPECTING", "DEFECT_FIXING", "READY_TO_TRANSFER", "TRANSFERRED"] as const;
export type ConstructionStatus = (typeof CONSTRUCTION_STATUSES)[number];

export const INSPECTION_SCOPES = ["GENERAL", "ENGINEERING"] as const;
/** ENGINEERING items are screening only — a licensed engineer must confirm; the app never certifies safety. */
export type InspectionScope = (typeof INSPECTION_SCOPES)[number];

/** PROPERTY = house-level photo (front of house, floor plan, documents; migration 0008). */
export const PHOTO_KINDS = ["DEFECT", "AFTER_FIX", "ITEM", "PROPERTY"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Columns every synced row carries. */
export interface SyncedRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Project extends SyncedRow {
  owner_id: string | null;
  name: string;
  developer: string | null;
  developer_contact: string | null;
  location: string | null;
  description: string | null;
  inspection_date: string | null; // YYYY-MM-DD
  reinspection_date: string | null; // YYYY-MM-DD
}

export interface Property extends SyncedRow {
  project_id: string;
  name: string;
  plot_number: string | null;
  house_model: string | null;
  property_type: string | null;
  land_area_sqw: number | null;
  usable_area_sqm: number | null;
  floors: number | null;
  construction_status: ConstructionStatus;
  inspection_type: string | null;
  inspection_owner: string | null;
  transfer_date_planned: string | null; // from booking docs — reference only
  transfer_date_actual: string | null; // entered by the user; drives the claim deadline
  claim_window_days: number;
  warranty_info: string | null;
  price: number | null;
  booking_fee: number | null;
  cashback: number | null;
  notes: string | null;
}

export interface Room extends SyncedRow {
  project_id: string;
  property_id: string;
  name: string;
  floor: string | null;
  sort_order: number;
}

export interface ChecklistCategory extends SyncedRow {
  project_id: string;
  property_id: string;
  name: string;
  sort_order: number;
}

export interface ChecklistItem extends SyncedRow {
  project_id: string;
  property_id: string;
  category_id: string;
  room_id: string | null;
  code: string;
  /** Text snapshot of the room label (kept for reports and for items without a room). */
  location: string | null;
  title: string;
  description: string | null;
  method: string | null;
  acceptance_criteria: string | null;
  priority: Priority;
  scope: InspectionScope;
  sort_order: number;
  status: ItemStatus;
  note: string | null;
  checked_at: string | null;
  checked_by: string | null;
}

export interface Defect extends SyncedRow {
  project_id: string;
  property_id: string;
  item_id: string | null;
  room_id: string | null;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  severity: Severity;
  status: DefectStatus;
  requires_engineer: boolean;
  recommendation: string | null;
  found_at: string;
  due_date: string | null;
  fixed_at: string | null;
  verified_at: string | null;
  created_by: string | null;
}

export interface DefectEvent extends SyncedRow {
  project_id: string;
  defect_id: string;
  from_status: DefectStatus | null;
  to_status: DefectStatus;
  note: string | null;
  actor: string | null;
}

export interface Photo extends SyncedRow {
  project_id: string;
  property_id: string;
  defect_id: string | null;
  item_id: string | null;
  kind: PhotoKind;
  caption: string | null;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  taken_at: string;
}

/** Local-only photo binary, kept out of the synced row. */
export interface PhotoBlob {
  photo_id: string;
  blob: Blob;
  uploaded: 0 | 1;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  /** Global role. ADMIN = system administrator (manages accounts, not customers' data). */
  role: Role;
  /** Set when a system admin suspends the account (migration 0006). */
  disabled_at?: string | null;
}

/** Row returned by the admin_list_users() RPC. */
export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
  disabled_at: string | null;
  project_count: number;
  property_count: number;
  /** Migration 0007 (absent before it is applied). */
  plan?: "FREE" | "PRO" | "BUSINESS";
  plan_expires_at?: string | null;
}

export type SyncedTable = "projects" | "properties" | "rooms" | "checklist_categories" | "checklist_items" | "defects" | "defect_events" | "photos";

/** Push order respects foreign keys. */
export const SYNC_TABLES: readonly SyncedTable[] = ["projects", "properties", "rooms", "checklist_categories", "checklist_items", "defects", "defect_events", "photos"];

export interface TableRowMap {
  projects: Project;
  properties: Property;
  rooms: Room;
  checklist_categories: ChecklistCategory;
  checklist_items: ChecklistItem;
  defects: Defect;
  defect_events: DefectEvent;
  photos: Photo;
}
