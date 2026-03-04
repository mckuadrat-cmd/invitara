import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Calendar, MapPin } from "lucide-react";
import { Button } from "../components/ui/button";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: string;
  theme?: any; // jsonb
};

function fmtDate(iso: string | null) {
  if (!iso) return "TBA";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "TBA";
  }
}

export default function PublicLandingPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("events")
          .select("id,name,slug,event_date,location,status,theme")
          .eq("status", "published")
          .order("event_date", { ascending: true });

        if (error) throw error;
        setEvents((data ?? []) as EventRow[]);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasEvents = useMemo(() => events.length > 0, [events.length]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      {/* Top hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#D6C6A5]/25 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-[520px] h-[520px] rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/80 text-sm">
            Invitara • Public Invitations
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight">
            Undangan Digital Premium
          </h1>
          <p className="mt-4 text-white/70 max-w-2xl">
            Pilih acara yang tersedia di bawah. Undangan per event punya tema/brand masing-masing (bisa kamu edit via
            <span className="font-mono"> events.theme</span>).
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : err ? (
          <div className="text-red-300">{err}</div>
        ) : !hasEvents ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/70">
            Belum ada event yang dipublish.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {events.map((ev) => {
              const theme = ev.theme ?? {};
              const brand = theme.brand ?? theme;
              const primary = brand.primary ?? "#0F1C2E";
              const accent = brand.accent ?? "#D6C6A5";
              const hero = brand.heroImageUrl ?? brand.heroImage ?? null;

              return (
                <div
                  key={ev.id}
                  className="rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                  style={{ borderColor: `${accent}33` }}
                >
                  <div className="relative h-44">
                    {hero ? (
                      <ImageWithFallback
                        src={hero}
                        alt={ev.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          background: `linear-gradient(135deg, ${primary}, ${accent}55)`,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5">
                      <div className="text-lg font-semibold">{ev.name}</div>
                      <div className="mt-1 flex flex-wrap gap-4 text-sm text-white/80">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {fmtDate(ev.event_date)}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {ev.location ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="text-xs text-white/60">
                      URL: <span className="font-mono">/event/{ev.slug}</span>
                    </div>

                    <Button
                      asChild
                      className="h-10 rounded-xl"
                      style={{ backgroundColor: accent, color: "#0B1220" }}
                    >
                      <Link to={`/event/${ev.slug}`}>Buka Undangan</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}