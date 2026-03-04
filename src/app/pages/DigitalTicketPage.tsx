import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

type GuestRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  unique_code: string;
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
};

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_date: string | null;
  location: string | null;
  status: string;
  theme?: any; // jsonb
  event_code?: string | null;
};

type EventSettingsRow = {
  event_id: string;
  qr_format: "QR Code v1" | "QR Code v2" | "QR Code v3" | string;
};

function statusBadge(status: GuestRow["status"]) {
  if (status === "checked_in") return <Badge className="bg-[#22C55E] text-white">Checked In</Badge>;
  if (status === "confirmed") return <Badge className="bg-[#D6C6A5] text-[#0F1C2E]">Confirmed</Badge>;
  return <Badge className="bg-gray-400 text-white">Pending</Badge>;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "TBA";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "TBA";
  }
}

export default function DigitalTicketPage() {
  const { id } = useParams(); // unique_code
  const code = useMemo(() => String(id ?? "").trim().toUpperCase(), [id]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [guest, setGuest] = useState<GuestRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [qrFormat, setQrFormat] = useState<string>("QR Code v1");

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!code) throw new Error("Missing ticket code.");

        // 1) guest by unique_code
        const { data: g, error: gErr } = await supabase
          .from("guests")
          .select("id,event_id,full_name,email,phone,organization,unique_code,status,checkin_time")
          .eq("unique_code", code)
          .single();

        if (gErr || !g) throw new Error(gErr?.message ?? "Ticket not found.");
        const guestRow = g as GuestRow;
        setGuest(guestRow);

        // 2) event (include theme)
        const { data: ev, error: evErr } = await supabase
          .from("events")
          .select("id,name,slug,event_date,location,status,theme,event_code")
          .eq("id", guestRow.event_id)
          .single();

        if (evErr || !ev) throw new Error(evErr?.message ?? "Event not found.");
        const eventRow = ev as EventRow;
        setEvent(eventRow);

        // 3) settings (optional)
        const { data: st } = await supabase
          .from("event_settings")
          .select("event_id,qr_format")
          .eq("event_id", guestRow.event_id)
          .maybeSingle();

        const fmt = (st as EventSettingsRow | null)?.qr_format ?? "QR Code v1";
        setQrFormat(fmt);

        // 4) decide QR payload
        const origin = window.location.origin;

        // v1 = url scanner admin (debug style lama)
        let payloadText = `${origin}/admin/event/${guestRow.event_id}/scanner?code=${encodeURIComponent(code)}`;

        if (fmt === "QR Code v2") {
          payloadText = JSON.stringify({ v: 2, eventId: guestRow.event_id, code });
        }

        if (fmt === "QR Code v3") {
          const { data, error } = await supabase.functions.invoke("ticket_sign", {
            body: { eventId: guestRow.event_id, code },
          });
          if (error) throw new Error(error.message);

          const token = data?.token;
          if (!token) throw new Error("No token returned from ticket_sign.");

          payloadText = `${origin}/admin/event/${guestRow.event_id}/scanner?t=${encodeURIComponent(token)}`;
        }

        // 5) generate QR image
        const qr = await QRCode.toDataURL(payloadText, { margin: 2, width: 640 });
        setQrDataUrl(qr);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load ticket.");
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert("Kode tiket tersalin");
    } catch {
      alert("Gagal copy. Copy manual ya.");
    }
  };

  if (loading) return <div className="p-8">Loading ticket…</div>;
  if (err) return <div className="p-8 text-red-600">{err}</div>;
  if (!guest || !event) return <div className="p-8">Ticket not found.</div>;

  const theme = event.theme ?? {};
  const brand = theme.brand ?? theme ?? {};
  const primary = brand.primary ?? "#0F1C2E";
  const accent = brand.accent ?? "#D6C6A5";
  const logoUrl = brand.logoUrl ?? brand.logo ?? "/Invitara.png";

  return (
    <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-[0_16px_60px_rgba(0,0,0,0.45)]">
          {/* header */}
          <div
            className="p-6"
            style={{
              background: `linear-gradient(135deg, ${primary}, ${accent}33)`,
              borderBottom: `1px solid ${accent}33`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 w-auto mb-3"
                  onError={(e) => ((e.currentTarget.style.display = "none") as any)}
                />
                <div className="text-2xl font-semibold">{event.name}</div>
                <div className="text-sm text-white/75 mt-1">
                  {event.location ?? "—"} • {fmtDateTime(event.event_date)}
                </div>
              </div>
              <div className="shrink-0">{statusBadge(guest.status)}</div>
            </div>
          </div>

          {/* body */}
          <div className="p-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Nama Tamu</div>
              <div className="text-lg font-semibold mt-1">{guest.full_name}</div>
              <div className="text-sm text-white/70">{guest.organization ?? "—"}</div>

              {(guest.email || guest.phone) ? (
                <div className="text-xs text-white/60 mt-2">
                  {guest.email ?? ""}{guest.email && guest.phone ? " • " : ""}{guest.phone ?? ""}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Ticket" className="w-64 h-64" />
                ) : null}
              </div>

              <div className="mt-4 text-xs text-white/60">
                Scan QR ini saat registrasi • Format: <span className="font-mono">{qrFormat}</span>
              </div>

              <div className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-white/60">Kode Tiket</div>
                  <div className="font-mono text-lg">{guest.unique_code}</div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-white/20 text-white hover:bg-white/10"
                  onClick={copyCode}
                >
                  Copy
                </Button>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  asChild
                  className="rounded-xl"
                  style={{ backgroundColor: accent, color: "#0B1220" }}
                >
                  <a href={`/event/${event.slug}`}>Buka Undangan</a>
                </Button>

                <Button
                  variant="outline"
                  className="rounded-xl border-white/20 text-white hover:bg-white/10"
                  asChild
                >
                  <a href="/">Lihat Semua Event</a>
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 text-center text-xs text-white/50">
            Powered by Invitara • {event.event_code ?? ""}
          </div>
        </div>
      </div>
    </div>
  );
}