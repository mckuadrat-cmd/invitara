import { supabase } from "./supabaseClient";

export type GlobalRole = "owner" | "staff";
export type EventStaffRole = "admin" | "scanner";

export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: "draft" | "published";
  theme?: any;
};

export type MyEventAccessRow = {
  event_id: string;
  role: EventStaffRole;
  event: EventSummary | null;
};

export async function getCurrentUserProfile() {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr) throw sessionErr;
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, role, role_global, full_name, email, username")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const globalRole: GlobalRole =
    data.role_global === "owner" || data.role === "owner" ? "owner" : "staff";

  return {
    ...data,
    globalRole,
  };
}

function normalizeEvent(raw: any): EventSummary | null {
  if (!raw) return null;

  // Kadang Supabase kasih object
  if (!Array.isArray(raw)) {
    return {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      slug: String(raw.slug ?? ""),
      event_date: raw.event_date ?? null,
      location: raw.location ?? null,
      status: raw.status === "published" ? "published" : "draft",
      theme: raw.theme ?? null,
    };
  }

  // Kadang kebaca array
  const first = raw[0];
  if (!first) return null;

  return {
    id: String(first.id ?? ""),
    name: String(first.name ?? ""),
    slug: String(first.slug ?? ""),
    event_date: first.event_date ?? null,
    location: first.location ?? null,
    status: first.status === "published" ? "published" : "draft",
    theme: first.theme ?? null,
  };
}

export async function getMyEventAccess(): Promise<MyEventAccessRow[]> {
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr) throw sessionErr;
  if (!session?.user?.id) return [];

  const { data, error } = await supabase
    .from("event_staff")
    .select(`
      event_id,
      role,
      event:events (
        id,
        name,
        slug,
        event_date,
        location,
        status,
        theme
      )
    `)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  return rows.map((row: any) => ({
    event_id: String(row.event_id),
    role: row.role as EventStaffRole,
    event: normalizeEvent(row.event),
  }));
}