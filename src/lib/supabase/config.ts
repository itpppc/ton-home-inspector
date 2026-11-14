export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Without Supabase env the app runs in Local mode (single device, IndexedDB only). */
export const isSupabaseConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
export const PHOTO_BUCKET = "inspection-photos";
