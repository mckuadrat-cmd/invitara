import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { getCurrentUserProfile, getMyEventAccess, MyEventAccessRow } from "../lib/access";

type GroupedEvent = {
  event_id: string;
  event: MyEventAccessRow["event"];
  roles: ("admin" | "scanner")[];
};

export default function MyEventsPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<MyEventAccessRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const profile = await getCurrentUserProfile();
        if (!profile) {
          nav("/login", { replace: true });
          return;
        }

        if (profile.globalRole === "owner") {
          nav("/admin/events", { replace: true });
          return;
        }

        const data = await getMyEventAccess();
        setRows(data);
      } catch (e: any) {
        setErr(e?.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  const grouped = useMemo<GroupedEvent[]>(() => {
    const map = new Map<string, GroupedEvent>();

    for (const row of rows) {
      const existing = map.get(row.event_id);

      if (!existing) {
        map.set(row.event_id, {
          event_id: row.event_id,
          event: row.event,
          roles: [row.role],
        });
      } else if (!existing.roles.includes(row.role)) {
        existing.roles.push(row.role);
      }
    }

    return Array.from(map.values());
  }, [rows]);

  function openEvent(ev: GroupedEvent) {
    if (ev.roles.includes("admin")) {
      nav(`/admin/event/${ev.event_id}/dashboard`);
      return;
    }

    nav(`/scanner/${ev.event_id}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C2E]">My Events</h1>
            {grouped.length > 1 && (
            <div className="text-xs text-gray-500">
                Kamu punya akses ke {grouped.length} event
            </div>
            )}
          <p className="text-sm text-gray-600">Pilih event yang ingin kamu buka.</p>
        </div>

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Accessible Events</CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : grouped.length === 0 ? (
              <div className="text-sm text-gray-500">
                Kamu belum terdaftar di event manapun.
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((item) => (
                  <div
                    key={item.event_id}
                    className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-[#0F1C2E]">
                        {item.event?.name ?? "Event tidak ditemukan"}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {item.event?.location || "Lokasi belum diatur"}
                      </div>

                      <div className="mt-2 flex gap-2 flex-wrap">
                        {item.roles.map((role) => (
                          <Badge
                            key={role}
                            className={
                              role === "admin"
                                ? "bg-[#D6C6A5] text-[#0F1C2E]"
                                : "bg-[#22C55E] text-white"
                            }
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {item.roles.includes("admin") && (
                        <Button
                          variant="outline"
                          onClick={() => nav(`/admin/event/${item.event_id}/staff`)}
                        >
                          Staff
                        </Button>
                      )}

                      <Button onClick={() => openEvent(item)}>
                        Open Event
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}