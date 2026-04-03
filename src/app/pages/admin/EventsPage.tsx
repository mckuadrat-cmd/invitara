import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: "draft" | "published";
  event_code?: string | null;
  created_at?: string;
  theme?: any;
};

type GlobalRole = "owner" | "staff";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function makeUniqueSlug(baseName: string) {
  const baseSlug = slugify(baseName);
  if (!baseSlug) throw new Error("Nama event tidak valid untuk slug.");

  const { data, error } = await supabase
    .from("events")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (error) throw error;

  const existing = new Set((data ?? []).map((row: any) => String(row.slug || "").toLowerCase()));

  if (!existing.has(baseSlug)) return baseSlug;

  let counter = 2;
  while (existing.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}

function getDerivedEventState(
  status: "draft" | "published",
  startIso?: string | null,
  endIso?: string | null
) {
  if (status === "draft") return "draft";

  const now = Date.now();
  const start = startIso ? new Date(startIso).getTime() : NaN;
  const end = endIso ? new Date(endIso).getTime() : NaN;

  if (!Number.isNaN(start) && now < start) return "published";
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) {
    return "ongoing";
  }
  if (!Number.isNaN(end) && now > end) return "finished";

  return "published";
}

export default function EventsPage() {
  const nav = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [hostName, setHostName] = useState("");
  const autoSlugPreview = useMemo(() => slugify(name), [name]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [status, setStatus] = useState<EventRow["status"]>("draft");
  const [submitting, setSubmitting] = useState(false);

  const [eventCode, setEventCode] = useState("");
  useEffect(() => {
    const code = autoSlugPreview.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10);
    setEventCode(code || "");
  }, [autoSlugPreview]);

  const [role, setRole] = useState<GlobalRole | null>(null);

 useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) {
          setRole("staff");
          return;
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("role, role_global")
          .eq("user_id", uid)
          .maybeSingle();

        setRole(
          prof?.role_global === "owner" || prof?.role === "owner"
            ? "owner"
            : "staff"
        );
      } catch {
        setRole("staff");
      }
    })();
  }, []);

  async function refresh() {
    if (!role) return;

    setLoading(true);
    setErr(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;

      if (!uid) throw new Error("Not logged in");

      if (role === "owner") {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setEvents((data ?? []) as EventRow[]);
        return;
      }

      const { data, error } = await supabase
        .from("event_staff")
        .select(`
          event:events (*)
        `)
        .eq("user_id", uid);

      if (error) throw error;

      const mapped =
        (data ?? []).map((row: any) => row.event).filter(Boolean) ?? [];

      setEvents(mapped);
    } catch (e: any) {
      setErr(e.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    refresh();
  }, [role]);

  async function onCreate() {
    setSubmitting(true);
    setErr(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;

      if (!uid) throw new Error("Not logged in.");
      if (role !== "owner") throw new Error("Hanya owner yang boleh membuat event.");

      const safeName = name.trim();
      const safeHostName = hostName.trim();
      const safeVenueName = venueName.trim();
      const safeVenueAddress = venueAddress.trim();
      const cleanedEventCode = eventCode.replace(/[^a-z0-9]/gi, "").toUpperCase();

      if (!safeName) throw new Error("Event name wajib diisi.");
      if (!safeHostName) throw new Error("Nama penyelenggara wajib diisi.");
      if (!startDate) throw new Error("Tanggal mulai wajib diisi.");
      if (!cleanedEventCode) throw new Error("Event code wajib diisi.");
      if (cleanedEventCode.length < 3) {
        throw new Error("Event code minimal 3 karakter.");
      }

      if (endDate) {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();

        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) {
          throw new Error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
        }
      }

      const finalSlug = await makeUniqueSlug(name);

      const finalLocation = [safeVenueName, safeVenueAddress].filter(Boolean).join(", ");

      const payload = {
        owner_id: uid,
        event_code: cleanedEventCode.slice(0, 10) || "EVT",
        name: safeName,
        slug: finalSlug,
        event_date: startDate ? new Date(startDate).toISOString() : null,
        location: finalLocation || null,
        status,
        theme: {
          hostName: safeHostName,
          eventEndDate: endDate ? new Date(endDate).toISOString() : null,
          locationData: {
            name: safeVenueName,
            address: safeVenueAddress,
          },
        },
      };

      const { data, error } = await supabase
        .from("events")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      const created = data as EventRow;
      nav(`/admin/event/${created.id}/dashboard`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function setEventStatus(eventId: string, nextStatus: EventRow["status"]) {
    setUpdatingId(eventId);
    setErr(null);

    try {
      if (role !== "owner") throw new Error("Hanya owner yang boleh mengubah status event.");

      const { data, error } = await supabase
        .from("events")
        .update({ status: nextStatus })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) throw error;

      setEvents((prev) => prev.map((e) => (e.id === eventId ? (data as EventRow) : e)));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">
            {role === null
              ? "Loading role..."
              : role === "owner"
              ? "Create and manage events."
              : "Daftar event yang bisa kamu akses."}
          </p>
        </div>

        <Button variant="outline" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {err && <div className="rounded-md border p-3 text-sm text-red-600">{err}</div>}

      {role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle>Create new event</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Event name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama event yang diadakan"
              />
            </div>

            <div className="space-y-2">
              <Label>Host Name / Nama Penyelenggara</Label>
              <Input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Nama penyelenggara acara, bisa berupa nama individu atau organisasi"
              />
              <p className="text-xs text-muted-foreground">
                Nama ini akan tampil di undangan sebagai penyelenggara.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Tempat</Label>
              <Input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Tempat acara diadakan, bisa ditulis 'Online' jika acara daring"
              />
            </div>

            <div className="space-y-2">
              <Label>Alamat</Label>
              <Input
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Alamat lengkap tempat acara diadakan, bisa ditulis 'Online' jika acara daring"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EventRow["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="published">published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Event Code</Label>
              <Input
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                placeholder="EVT"
              />
              <p className="text-xs text-muted-foreground">
                Format ticket: <span className="font-mono">{eventCode || "EVT"}-000001</span>
              </p>
            </div>

            <div className="flex items-end md:col-span-2">
              <Button
                onClick={onCreate}
                disabled={!name.trim() || !hostName.trim() || !startDate || !eventCode.trim() || submitting}
              >
                {submitting ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{role === "owner" ? "All events" : "My accessible events"}</CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events yet.</div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => {
                const evHostName = ev.theme?.hostName ?? "-";
                const derivedStatus = getDerivedEventState(
                  ev.status,
                  ev.event_date,
                  ev.theme?.eventEndDate ?? null
                );

                return (
                  <div
                    key={ev.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-medium">{ev.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Host: {evHostName} • Status: {derivedStatus} • Code: {ev.event_code ?? "-"}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {role === "owner" &&
                        (ev.status === "published" ? (
                          <Button
                            variant="outline"
                            disabled={updatingId === ev.id}
                            onClick={() => setEventStatus(ev.id, "draft")}
                          >
                            {updatingId === ev.id ? "Updating..." : "Unpublish"}
                          </Button>
                        ) : (
                          <Button
                            disabled={updatingId === ev.id}
                            onClick={() => setEventStatus(ev.id, "published")}
                          >
                            {updatingId === ev.id ? "Publishing..." : "Publish"}
                          </Button>
                        ))}

                      <Button variant="outline" onClick={() => nav(`/event/${ev.slug}`)}>
                        Open Public
                      </Button>

                      <Button onClick={() => nav(`/admin/event/${ev.id}/dashboard`)}>
                        Open Admin
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}