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
  status: "draft" | "published" | "ongoing" | "finished";
  created_at?: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function EventsPage() {
  const nav = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const autoSlug = useMemo(() => slugify(name), [name]);
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<EventRow["status"]>("draft");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setSlug(autoSlug), [autoSlug]);

  const [eventCode, setEventCode] = useState("");
  useEffect(() => {
    // auto generate event_code dari slug: ambil huruf/angka, uppercase, max 10
    const code = (slug || autoSlug).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10);
    setEventCode(code || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, autoSlug]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as EventRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  // tambah state role
    type GlobalRole = "owner" | "admin" | "scanner";
    const [role, setRole] = useState<GlobalRole>("admin");

    useEffect(() => {
      (async () => {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle();
        setRole((prof?.role ?? "scanner") as GlobalRole);
      })();
    }, []);

  async function onCreate() {
    setSubmitting(true);
    setErr(null);

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setErr("Not logged in.");
      setSubmitting(false);
      return;
    }

    const payload = {
      owner_id: uid,
      event_code: (eventCode || slug).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10) || "EVT",
      name,
      slug,
      event_date: date ? new Date(date).toISOString() : null,
      location: location || null,
      status,
    };

    const { data, error } = await supabase.from("events").insert(payload).select("*").single();

    if (error) {
      setErr(error.message);
      setSubmitting(false);
      return;
    }

    const created = data as EventRow;
    setSubmitting(false);
    nav(`/admin/event/${created.id}/dashboard`);
  }

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function setEventStatus(eventId: string, nextStatus: EventRow["status"]) {
    setUpdatingId(eventId);
    setErr(null);
    try {
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
          <p className="text-sm text-muted-foreground">Create and manage events.</p>
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama event yang diadakan" />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug-event" />
            <p className="text-xs text-muted-foreground">
              Public URL: <span className="font-mono">/event/{slug || "..."}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Gedung Artadinata Jakarta" />
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
                <SelectItem value="ongoing">ongoing</SelectItem>
                <SelectItem value="finished">finished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Event Code</Label>
            <Input value={eventCode} onChange={(e) => setEventCode(e.target.value.toUpperCase())} placeholder="EVT" />
            <p className="text-xs text-muted-foreground">
              Format ticket: <span className="font-mono">{eventCode || "EVT"}-000001</span>
            </p>
          </div>

          <div className="flex items-end">
            <Button onClick={onCreate} disabled={!name || !slug || submitting}>
              {submitting ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-muted-foreground">No events yet.</div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{ev.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      slug: {ev.slug} • status: {ev.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {role === "owner" && (
                      ev.status === "published" ? (
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
                      )
                    )}
                    <Button variant="outline" onClick={() => nav(`/event/${ev.slug}`)}>
                      Open Public
                    </Button>

                    <Button onClick={() => nav(`/admin/event/${ev.id}/dashboard`)}>
                      Open Admin
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}