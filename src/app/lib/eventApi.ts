import { supabase } from "./supabaseClient";

export type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: "draft" | "published" | "ongoing" | "finished";
  created_at?: string;
};

export async function listEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as EventRow[];
}

export async function createEvent(payload: Omit<EventRow, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as EventRow;
}

export async function getEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data as EventRow;
}