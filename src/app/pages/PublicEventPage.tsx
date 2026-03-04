import { useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { getEventBySlug } from "../lib/eventApi";
import { supabase } from "../lib/supabaseClient";
import { Calendar, MapPin, Users, Info, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

function makeCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase() + Date.now().toString().slice(-4);
}

function fmtDate(iso: string | null) {
  if (!iso) return "Tanggal menyusul";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Tanggal menyusul";
  }
}

export default function PublicEventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState<any>(null);

  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [loadingRsvp, setLoadingRsvp] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
  });

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        if (!slug) return;
        const ev = await getEventBySlug(slug);
        setEvent(ev);
      } catch (e: any) {
        setErr(e?.message ?? "Event tidak ditemukan");
      }
    })();
  }, [slug]);

  const theme = useMemo(() => (event?.theme ?? {}), [event]);
  const brand = useMemo(() => (theme.brand ?? theme ?? {}), [theme]);

  const primary = brand.primary ?? "#0F1C2E";
  const accent = brand.accent ?? "#D6C6A5";
  const heroImageUrl = brand.heroImageUrl ?? brand.heroImage ?? null;
  const logoUrl = brand.logoUrl ?? brand.logo ?? "/Invitara.png";

  const headline = theme.headline ?? event?.name ?? "Undangan";
  const tagline = theme.tagline ?? "Undangan Kehadiran";
  const about = theme.about ?? "Kami mengundang Bapak/Ibu untuk hadir pada acara berikut.";
  const dresscode = theme.dresscode ?? "Rapi & sopan (sesuai ketentuan sekolah).";

  const agenda: Array<{ time: string; title: string; note?: string }> = theme.agenda ?? [];
  const faqs: Array<{ q: string; a: string }> = theme.faqs ?? [];

  async function rsvp() {
    try {
      setLoadingRsvp(true);
      setErr(null);

      if (!event?.id) throw new Error("Event not found");

      const unique_code = makeCode();

      const { data, error } = await supabase
        .from("guests")
        .insert({
          event_id: event.id,
          full_name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          organization: formData.organization || null,
          unique_code,
          status: "confirmed",
        })
        .select("unique_code")
        .single();

      if (error) throw error;

      window.location.href = `/ticket/${data.unique_code}`;
    } catch (e: any) {
      setErr(e?.message ?? "Gagal RSVP");
    } finally {
      setLoadingRsvp(false);
    }
  }

  if (!event && !err) return <div className="min-h-screen p-10">Loading…</div>;
  if (err) return <div className="min-h-screen p-10 text-red-600">{err}</div>;
  if (!event) return <div className="min-h-screen p-10">Event tidak ditemukan.</div>;

  return (
    <div className="min-h-screen bg-[#0B1220] text-white" style={{ ["--pri" as any]: primary, ["--acc" as any]: accent }}>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {heroImageUrl ? (
            <>
              <ImageWithFallback src={heroImageUrl} alt={headline} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0B1220]" />
            </>
          ) : (
            <>
              <div
                className="w-full h-full"
                style={{ background: `radial-gradient(900px 500px at 20% 10%, ${accent}33, transparent 60%), linear-gradient(180deg, ${primary}, #0B1220)` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-[#0B1220]" />
            </>
          )}
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-14 pb-12">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Logo"
                className="h-10 w-auto"
                onError={(e) => ((e.currentTarget.style.display = "none") as any)}
              />
              <div className="text-sm text-white/70">Premium School Invitation</div>
            </div>

            <Button
              onClick={() => setRsvpOpen(true)}
              className="h-11 rounded-xl px-6"
              style={{ backgroundColor: accent, color: "#0B1220" }}
            >
              RSVP / Ambil Ticket
            </Button>
          </div>

          <div className="mt-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/80 text-sm">
              <Sparkles className="w-4 h-4" />
              {tagline}
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight leading-tight">
              {headline}
            </h1>

            <div className="mt-6 flex flex-wrap gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" style={{ color: accent }} />
                {fmtDate(event.event_date)}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: accent }} />
                {event.location ?? "—"}
              </div>
            </div>

            <p className="mt-8 text-white/75 max-w-2xl leading-relaxed">
              {about}
            </p>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        {/* Info cards */}
        <div className="grid md:grid-cols-3 gap-4 -mt-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/70 flex items-center gap-2">
              <Info className="w-4 h-4" style={{ color: accent }} /> Lokasi
            </div>
            <div className="mt-2 font-semibold">{event.location ?? "—"}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/70 flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: accent }} /> Tanggal
            </div>
            <div className="mt-2 font-semibold">{fmtDate(event.event_date)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-white/70 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: accent }} /> Dresscode
            </div>
            <div className="mt-2 font-semibold">{dresscode}</div>
          </div>
        </div>

        {/* Agenda (optional) */}
        {agenda.length > 0 ? (
          <div className="mt-14">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Susunan Acara</h2>
              <div className="text-sm text-white/60">* bisa kamu edit di events.theme</div>
            </div>

            <div className="mt-6 space-y-3">
              {agenda.map((a, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex gap-4">
                  <div className="shrink-0 w-24 text-sm font-mono text-white/80">{a.time}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{a.title}</div>
                    {a.note ? <div className="text-sm text-white/60 mt-1">{a.note}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* FAQ (optional) */}
        {faqs.length > 0 ? (
          <div className="mt-14">
            <h2 className="text-2xl font-semibold">Informasi</h2>
            <div className="mt-6 space-y-3">
              {faqs.map((f, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="font-semibold">{f.q}</div>
                  <div className="text-white/70 mt-2 leading-relaxed">{f.a}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/60 text-sm">
          Powered by Invitara • {event.event_code ?? ""}
        </div>
      </section>

      {/* RSVP Modal */}
      <Dialog open={rsvpOpen} onOpenChange={setRsvpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#0F1C2E]">Konfirmasi Kehadiran</DialogTitle>
            <DialogDescription>
              Isi data untuk mendapatkan ticket digital.
            </DialogDescription>
          </DialogHeader>

          {err ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                placeholder="Nama tamu"
                value={formData.name}
                onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="org">Instansi / Kelas</Label>
              <Input
                id="org"
                placeholder="SMA Pesat / Orang Tua / Tamu"
                value={formData.organization}
                onChange={(e) => setFormData((s) => ({ ...s, organization: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="email">Email (opsional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={formData.email}
                onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="phone">No HP (opsional)</Label>
              <Input
                id="phone"
                placeholder="08xxxx"
                value={formData.phone}
                onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
              />
            </div>

            <Button
              onClick={rsvp}
              disabled={loadingRsvp || !formData.name.trim()}
              className="w-full h-11 rounded-xl"
              style={{ backgroundColor: accent, color: "#0B1220" }}
            >
              {loadingRsvp ? "Memproses…" : "Dapatkan Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}