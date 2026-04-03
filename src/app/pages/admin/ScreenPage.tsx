import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { ArrowLeft, Maximize, Minimize } from "lucide-react";

type GuestRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  organization: string | null;
  unique_code: string;
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
  photo_url?: string | null;
};

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
};

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function playDing() {
  // No asset file needed (WebAudio)
  try {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = 880; // A5
    g.gain.value = 0.0001;

    o.connect(g);
    g.connect(ctx.destination);

    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    o.start(now);
    o.stop(now + 0.28);

    o.onended = () => ctx.close?.();
  } catch {
    // ignore
  }
}

export default function ScreenPage() {
  const { eventId } = useParams();
  const nav = useNavigate();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);

  const [latestGuest, setLatestGuest] = useState<GuestRow | null>(null);
  const [recent, setRecent] = useState<GuestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [flash, setFlash] = useState(false);

  const brokenPhotoIds = useRef<Set<string>>(new Set());
  const latestGuestIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);

  const title = useMemo(() => event?.name ?? "Live Check-in", [event?.name]);
  const [displayCount, setDisplayCount] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const featuredGuest = recent[highlightIndex] ?? latestGuest;

  async function loadEvent() {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,name,location,event_date")
      .eq("id", eventId)
      .single();

    if (error) {
      setError(error.message);
      return;
    }
    setEvent((data ?? null) as EventRow | null);
  }

  async function loadCount() {
    if (!eventId) return;
    const { count } = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "checked_in");

    setCheckedCount(count ?? 0);
  }

  async function loadRecent() {
    if (!eventId) return;

    const tryWithPhoto =
      "id,event_id,full_name,email,organization,unique_code,status,checkin_time,photo_url";

    const r1 = await supabase
      .from("guests")
      .select(tryWithPhoto)
      .eq("event_id", eventId)
      .eq("status", "checked_in")
      .order("checkin_time", { ascending: false })
      .limit(12);

    const res = !r1.error ? r1 : await supabase
      .from("guests")
      .select("id,event_id,full_name,email,organization,unique_code,status,checkin_time")
      .eq("event_id", eventId)
      .eq("status", "checked_in")
      .order("checkin_time", { ascending: false })
      .limit(12);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    const list = (res.data ?? []) as GuestRow[];
    setRecent(list);

    const next = list[0] ?? null;

    // trigger animasi + sound kalau guest berubah
    const prevId = latestGuestIdRef.current;
    const nextId = next?.id ?? null;
    if (nextId && nextId !== prevId) {
      setFlash(true);
      playDing();
      window.setTimeout(() => setFlash(false), 900);
    }

    setLatestGuest(next);
    latestGuestIdRef.current = nextId;
  }

  useEffect(() => {
    setHighlightIndex(0);
  }, [recent.length, latestGuest?.id]);

  useEffect(() => {
    setError(null);
    loadEvent();
    loadCount();
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    document.title = `${title} • Invitara Live`;
  }, [title]);

  useEffect(() => {
    let frame = 0;
    const start = displayCount;
    const end = checkedCount;
    const duration = 500;
    const steps = 20;

    if (start === end) return;

    const diff = end - start;
    const tick = window.setInterval(() => {
      frame += 1;
      const progress = frame / steps;
      const value = Math.round(start + diff * progress);
      setDisplayCount(value);

      if (frame >= steps) {
        setDisplayCount(end);
        window.clearInterval(tick);
      }
    }, duration / steps);

    return () => window.clearInterval(tick);
  }, [checkedCount]);

  // realtime UPDATE + INSERT
  useEffect(() => {
    if (!eventId) return;

    const ch = supabase
      .channel(`screen-${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const n: any = payload.new;
          const o: any = payload.old;

          const becameCheckedIn = o?.status !== "checked_in" && n?.status === "checked_in";
          const checkinTimeChanged =
            o?.checkin_time !== n?.checkin_time && n?.status === "checked_in";

          if (becameCheckedIn || checkinTimeChanged) {
            await loadCount();
            await loadRecent();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const n: any = payload.new;
          if (n?.status === "checked_in") {
            await loadCount();
            await loadRecent();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // polling fallback
  useEffect(() => {
    if (!eventId) return;
    const t = window.setInterval(() => {
      loadCount();
      loadRecent();
    }, 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (recent.length <= 1) return;

    const t = window.setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % recent.length);
    }, 3000);

    return () => window.clearInterval(t);
  }, [recent]);

  // fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // hotkey: F toggle fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "Escape" && document.fullscreenElement) {
        // biar state rapi
        setIsFullscreen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
  }

  // Wake Lock biar layar gak tidur
  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      try {
        const anyNav: any = navigator as any;
        if (!anyNav?.wakeLock?.request) return;

        const lock = await anyNav.wakeLock.request("screen");
        if (cancelled) {
          try { await lock.release(); } catch {}
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener("release", () => (wakeLockRef.current = null));
      } catch {}
    }

    requestWakeLock();
    const onVis = () => document.visibilityState === "visible" && requestWakeLock();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      try { wakeLockRef.current?.release?.(); } catch {}
      wakeLockRef.current = null;
    };
  }, []);

  function canShowPhoto(g: GuestRow) {
    if (!g.photo_url) return false;
    return !brokenPhotoIds.current.has(g.id);
  }

  return (
      <div
        className="h-screen overflow-hidden text-white"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(31,41,55,0.85) 0%, rgba(31,41,55,0.35) 18%, rgba(11,18,32,0) 42%), linear-gradient(180deg, #0F172A 0%, #0B1220 45%, #08101C 100%)",
        }}
      >
      {/* Header */}
      <div className="px-10 pt-15 pb-6 flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {/* Back icon */}
          <button
            onClick={() => nav("/app", { replace: true })}
            className="mt-1 w-20 h-20 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-10 h-10" />
          </button>

          <div>
            <div className="text-sm text-white/70">INVITARA • LIVE</div>
            <div className="text-3xl font-semibold mt-1 line-clamp-2">{title}</div>
            <div className="text-white/70 mt-2">
              {event?.location ?? "—"}
              {event?.event_date ? (
                <span>
                  {" "}
                  •{" "}
                  {new Date(event.event_date).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              ) : null}
            </div>
            {error ? <div className="text-red-300 mt-2 text-sm">{error}</div> : null}
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-4">
          <div>
            <div className="text-sm text-white/70">Total:</div>
            <div
              className={`text-6xl font-bold tracking-tight transition-all duration-300 ${
                flash ? "scale-110 text-emerald-300" : "scale-100"
              }`}
            >
              {displayCount}
            </div>
          </div>

          {/* Fullscreen icon */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition"
            aria-label="Fullscreen"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Body (fix height, no page scroll) */}
      <div className="px-10 pb-10 h-[calc(100vh-120px)] grid grid-cols-12 gap-8">
        {/* Featured */}
        <div className="col-span-8 h-150">
          <div
            className={[
              "h-full rounded-3xl bg-white/5 border p-10 flex items-center transition",
              flash ? "border-emerald-300/60 shadow-[0_0_40px_rgba(16,185,129,0.25)]" : "border-white/10",
            ].join(" ")}
          >
            {featuredGuest ? (
              <div className={`w-full flex items-center gap-10 transition-all duration-500
                  ${flash ? "scale-[1.015]" : "scale-100"}
                `}>
                <div className="shrink-0">
                  {canShowPhoto(featuredGuest) ? (
                    <img
                      src={featuredGuest.photo_url!}
                      alt={featuredGuest.full_name}
                      className="w-70 h-70 rounded-3xl object-cover border border-white/15"
                      onError={() => brokenPhotoIds.current.add(featuredGuest.id)}
                    />
                  ) : (
                    <div className="w-70 h-70 rounded-3xl bg-white/10 border border-white/15 flex items-center justify-center text-6xl font-bold">
                      {initials(featuredGuest.full_name)}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="text-white/70 text-sm">SELAMAT DATANG</div>
                  <div className="text-6xl font-extrabold leading-[1.05] mt-2 line-clamp-2">
                    {featuredGuest.full_name}
                  </div>
                  <div className="text-2xl text-white/80 mt-4">
                    {featuredGuest.organization ?? "—"}
                  </div>

                  <div className="mt-8 flex items-center gap-4 text-white/80">
                    <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                      Check-in:{" "}
                      <span className="font-semibold">{fmtTime(featuredGuest.checkin_time)}</span>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 font-mono">
                      {featuredGuest.unique_code}
                    </div>
                  </div>

                  {/* small “live pulse” */}
                  <div className="mt-6 flex items-center gap-2 text-white/60 text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                    </span>
                    Live update
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full text-center text-white/70">
                <div className="text-2xl font-semibold">Menunggu check-in pertama…</div>
                <div className="mt-6 opacity-30 text-6xl">👥</div>
                <div className="text-sm mt-2">
                  Begitu scanner sukses, profil tamu akan tampil di sini.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent (only this scrolls) */}
        <div className="col-span-4 h-150">
          <div className="h-full rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col">
            <div>
              <div className="text-lg font-semibold">Recent Check-ins</div>
              <div className="text-white/60 text-sm mt-1">Terbaru di atas</div>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pr-1 space-y-3">
              {recent.length === 0 ? (
                <div className="text-white/60 text-sm">Belum ada check-in.</div>
              ) : (
                  recent.map((g, i) => (
                    <div
                      key={g.id}
                      className={[
                        "rounded-2xl p-4 flex items-center gap-4 border transition-all duration-300",
                        i === 0
                          ? "bg-emerald-500/10 border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                          : "bg-white/5 border-white/10",
                      ].join(" ")}
                    >
                    <div className="shrink-0">
                      {canShowPhoto(g) ? (
                        <img
                          src={g.photo_url!}
                          alt={g.full_name}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10"
                          onError={() => brokenPhotoIds.current.add(g.id)}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center font-bold">
                          {initials(g.full_name)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{g.full_name}</div>
                      <div className="text-xs text-white/60 truncate">{g.organization ?? "—"}</div>
                    </div>
                    <div className="text-xs text-white/70">{fmtTime(g.checkin_time)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Tips: tekan icon fullscreen atau tombol <span className="font-mono">F</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}