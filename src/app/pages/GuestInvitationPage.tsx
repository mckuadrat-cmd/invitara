import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import QRCode from "qrcode";
import {
  Calendar,
  MapPin,
  Sparkles,
  Info,
  Copy,
  Ticket,
  Building2,
  Share2,
  Clock3,
  MapPinHouse,
  CheckCheck,
  BoxIcon,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { Badge } from "../components/ui/badge";
import { ThemedButton } from "../components/ThemedButton";
import { generateGuestTicketPdf } from "../lib/pdf/generateGuestTicketPdf";

type GuestRow = {
  id: string;
  event_id: string;
  identity_no: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  dept_class: string | null;
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
  theme?: any;
  event_code?: string | null;
};

type AgendaItem = {
  start_time?: string;
  end_time?: string;
  time?: string;
  title: string;
  note?: string;
};

type GradientStop = {
  color: string;
  position: number;
};

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

function fmtDateTime(iso: string | null) {
  if (!iso) return "Waktu menyusul";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "Waktu menyusul";
  }
}

function fmtTime(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "-";
  }
}

function fmtTimeRange(start: string | null, end: string | null) {
  if (!start) return "-";

  try {
    const startTime = new Date(start).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTime = end
      ? new Date(end).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    return endTime ? `${startTime} - ${endTime} WIB` : `${startTime} WIB`;
  } catch {
    return "-";
  }
}

function statusBadge(status: GuestRow["status"]) {
  if (status === "checked_in") {
    return <Badge className="bg-[#22C55E] text-white">Sudah Check-in</Badge>;
  }
  if (status === "confirmed") {
    return <Badge className="bg-[#D6C6A5] text-[#0F1C2E]">Sudah Konfirmasi</Badge>;
  }
  return <Badge className="bg-gray-400 text-white">Belum Konfirmasi</Badge>;
}

function greetingByHour() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function getCountdownParts(targetIso: string | null) {
  if (!targetIso) {
    return {
      isExpired: false,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (Number.isNaN(target)) {
    return {
      isExpired: false,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  if (diff <= 0) {
    return {
      isExpired: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return {
    isExpired: false,
    totalMs: diff,
    days,
    hours,
    minutes,
    seconds,
  };
}

function hexToRgb(hex: string, fallback = { r: 15, g: 28, b: 46 }) {
  const clean = String(hex || "").replace("#", "").trim();

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return fallback;
    return { r, g, b };
  }

  return fallback;
}

function rgbaFromHex(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex, { r: 15, g: 28, b: 46 });
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, amount = 0.1) {
  const { r, g, b } = hexToRgb(hex);
  const darken = (c: number) => Math.max(0, Math.floor(c * (1 - amount)));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
}

function buildGradientCss(
  gradient: any,
  fallbackPrimary: string,
  fallbackAccent: string,
  alpha?: number
) {
  const type = gradient?.type === "radial" ? "radial" : "linear";
  const angle = Number(gradient?.angle ?? 135);
  const rawStops = Array.isArray(gradient?.stops) ? gradient.stops : [];

  const stops: GradientStop[] =
    rawStops.length >= 2
      ? rawStops
          .map((s: any) => ({
            color: String(s?.color ?? fallbackPrimary),
            position: Number(s?.position ?? 0),
          }))
          .sort((a, b) => a.position - b.position)
      : [
          { color: fallbackPrimary, position: 0 },
          { color: fallbackAccent, position: 100 },
        ];

  const stopText = stops
    .map((s) => {
      const finalColor =
        typeof alpha === "number" ? rgbaFromHex(s.color, alpha) : s.color;
      return `${finalColor} ${s.position}%`;
    })
    .join(", ");

  if (type === "radial") {
    return `radial-gradient(circle, ${stopText})`;
  }

  return `linear-gradient(${Number.isNaN(angle) ? 135 : angle}deg, ${stopText})`;
}

function isDarkColor(hex: string) {
  const { r, g, b } = hexToRgb(hex, { r: 15, g: 28, b: 46 });
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 155;
}

function getAdaptiveTextColors(bgHex: string) {
  const dark = isDarkColor(bgHex);

  return {
    primary: dark ? "#FFFFFF" : "#111827",
    secondary: dark ? "rgba(255,255,255,0.82)" : "rgba(17,24,39,0.82)",
    muted: dark ? "rgba(255,255,255,0.64)" : "rgba(17,24,39,0.64)",
    soft: dark ? "rgba(255,255,255,0.54)" : "rgba(17,24,39,0.54)",
    border: dark ? "rgba(255,255,255,0.12)" : "rgba(17,24,39,0.12)",
    cardBorder: dark ? "rgba(255,255,255,0.10)" : "rgba(17,24,39,0.10)",
    cardSoft: dark ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.06)",
  };
}

function primaryFallback(hex: string) {
  return hex || "#0F1C2E";
}

function buildHeroBackground({
  mode,
  imageUrl,
  gradientCss,
  blendGradientCss,
  overlayColor,
  overlayOpacity,
  glowEnabled,
  glowColor,
  glowX,
  glowY,
  glowSizeX,
  glowSizeY,
  glowOpacityHex,
}: {
  mode: string;
  imageUrl: string | null;
  gradientCss: string;
  blendGradientCss: string;
  overlayColor: string;
  overlayOpacity: number;
  glowEnabled: boolean;
  glowColor: string;
  glowX: number;
  glowY: number;
  glowSizeX: number;
  glowSizeY: number;
  glowOpacityHex: string;
}) {
  const glowLayer = glowEnabled
    ? `radial-gradient(${glowSizeX}px ${glowSizeY}px at ${glowX}% ${glowY}%, ${glowColor}${glowOpacityHex}, transparent 60%)`
    : "";

  const overlayLayer = `linear-gradient(135deg, ${rgbaFromHex(
    overlayColor,
    overlayOpacity
  )}, ${rgbaFromHex(primaryFallback(overlayColor), overlayOpacity * 0.72)})`;

  if (mode === "gradient") {
    return [glowLayer, gradientCss].filter(Boolean).join(", ");
  }

  if (mode === "image" && imageUrl) {
    return [glowLayer, `url("${imageUrl}")`].filter(Boolean).join(", ");
  }

  if (mode === "image-overlay" && imageUrl) {
    return [glowLayer, overlayLayer, `url("${imageUrl}")`]
      .filter(Boolean)
      .join(", ");
  }

  if (mode === "image-gradient-blend" && imageUrl) {
    return [glowLayer, overlayLayer, blendGradientCss, `url("${imageUrl}")`]
      .filter(Boolean)
      .join(", ");
  }

  return [glowLayer, gradientCss].filter(Boolean).join(", ");
}

function getFriendlyInvitationError(message?: string | null) {
  const msg = String(message || "").toLowerCase();

  if (
    msg.includes("undangan belum tersedia") ||
    msg.includes("draft") ||
    msg.includes("forbidden") ||
    msg.includes("403")
  ) {
    return "Undangan belum tersedia. Silakan hubungi panitia.";
  }

  if (
    msg.includes("undangan tidak ditemukan") ||
    msg.includes("peserta tidak ditemukan") ||
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("kode undangan")
  ) {
    return "Kode undangan tidak ditemukan. Periksa kembali link undangan Anda.";
  }

  if (
    msg.includes("event tidak ditemukan") ||
    msg.includes("data acara") ||
    msg.includes("event")
  ) {
    return "Data acara belum lengkap. Silakan hubungi panitia.";
  }

  if (
    msg.includes("edge function returned a non-2xx status code") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch")
  ) {
    return "Terjadi kendala saat memuat undangan. Silakan coba lagi beberapa saat lagi.";
  }

  return "Terjadi kendala saat memuat undangan. Silakan coba lagi beberapa saat lagi.";
}

export default function GuestInvitationPage() {
  const { code } = useParams();
  const guestCode = useMemo(() => String(code ?? "").trim().toUpperCase(), [code]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [guest, setGuest] = useState<GuestRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [qrFormat, setQrFormat] = useState<string>("QR Code v1");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [countdown, setCountdown] = useState(() => getCountdownParts(null));

  const refreshTimerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  async function loadInvitation(showLoading = true) {
    if (!guestCode) {
      setErr("Kode undangan tidak ditemukan.");
      setGuest(null);
      setEvent(null);
      setQrDataUrl("");
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (showLoading) setLoading(true);
      setErr(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke("public-invitation", {
        body: { code: guestCode },
        headers,
      });

      if (error) {
        throw new Error(data?.error || error.message || "Gagal memuat undangan.");
      }

      if (!data?.guest || !data?.event) {
        throw new Error("Undangan tidak ditemukan.");
      }

      const guestRow = data.guest as GuestRow;
      const eventRow = data.event as EventRow;
      const fmt = String(data.qrFormat ?? "QR Code v1");

      setGuest(guestRow);
      setEvent(eventRow);
      setQrFormat(fmt);

      const origin = window.location.origin;

      let payloadText = `${origin}/admin/event/${guestRow.event_id}/scanner?code=${encodeURIComponent(
        guestCode
      )}`;

      if (fmt === "QR Code v2") {
        payloadText = JSON.stringify({
          v: 2,
          eventId: guestRow.event_id,
          code: guestCode,
        });
      }

      if (fmt === "QR Code v3") {
        const { data: signData, error: signErr } = await supabase.functions.invoke(
          "ticket_sign",
          {
            body: { eventId: guestRow.event_id, code: guestCode },
            headers,
          }
        );

        if (signErr) {
          throw new Error(signData?.error || signErr.message || "Gagal membuat token QR.");
        }

        const token = signData?.token;
        if (!token) throw new Error("Token QR tidak berhasil dibuat.");

        payloadText = `${origin}/admin/event/${guestRow.event_id}/scanner?t=${encodeURIComponent(
          token
        )}`;
      }

      const qr = await QRCode.toDataURL(payloadText, {
        margin: 2,
        width: 640,
      });

      setQrDataUrl(qr);
      lastFetchAtRef.current = Date.now();
    } catch (e: any) {
      setErr(getFriendlyInvitationError(e?.message ?? "Gagal memuat undangan."));
    } finally {
      isFetchingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }

  function scheduleRefresh(delay = 450) {
    const now = Date.now();

    if (now - lastFetchAtRef.current < 300) return;

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible" && !isFetchingRef.current) {
        loadInvitation(false);
      }
    }, delay);
  }

  useEffect(() => {
    loadInvitation(true);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCode]);

  useEffect(() => {
    const update = () => {
      setCountdown(getCountdownParts(event?.event_date ?? null));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [event?.event_date]);

  useEffect(() => {
    if (!guest?.id || !guest?.event_id) return;

    const guestChannel = supabase
      .channel(`invitation-guest:${guest.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
          filter: `id=eq.${guest.id}`,
        },
        () => {
          scheduleRefresh(250);
        }
      )
      .subscribe();

    const eventChannel = supabase
      .channel(`invitation-event:${guest.event_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `id=eq.${guest.event_id}`,
        },
        () => {
          scheduleRefresh(250);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_settings",
          filter: `event_id=eq.${guest.event_id}`,
        },
        () => {
          scheduleRefresh(250);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(guestChannel);
      supabase.removeChannel(eventChannel);
    };
  }, [guest?.id, guest?.event_id]);

  useEffect(() => {
    if (!guestCode) return;

    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
    }

    pollingRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible" && !isFetchingRef.current) {
        loadInvitation(false);
      }
    }, 5000);

    const onFocus = () => {
      scheduleRefresh(100);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh(100);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);

      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCode]);

  const theme = useMemo(() => event?.theme ?? {}, [event]);
  const brand = useMemo(() => theme.brand ?? theme ?? {}, [theme]);
  const colors = useMemo(() => theme.colors ?? {}, [theme]);
  const buttons = useMemo(() => theme.buttons ?? {}, [theme]);
  const locationData = useMemo(() => theme.locationData ?? {}, [theme]);

  const primary = brand.primary ?? "#0F1C2E";
  const accent = brand.accent ?? "#D6C6A5";
  const heroImageUrl = brand.imageUrl ?? brand.heroImageUrl ?? null;

  const pageBaseColor = colors.pageBaseColor ?? primary;
  const cardColorHex = colors.cardColorHex ?? "#FFFFFF";
  const cardOpacity =
    typeof colors.cardOpacity === "number"
      ? Math.min(100, Math.max(0, colors.cardOpacity))
      : 8;

  const textConfig = event?.theme?.text;

  const adaptiveText =
    textConfig?.mode === "manual"
      ? {
          primary: textConfig.primary,
          secondary: textConfig.secondary,
          muted: textConfig.muted,
          soft: textConfig.muted,
          border: "rgba(255,255,255,0.12)",
          cardBorder: "rgba(255,255,255,0.10)",
          cardSoft: "rgba(255,255,255,0.06)",
        }
      : getAdaptiveTextColors(pageBaseColor);

  const pageGradient = buildGradientCss(colors.gradient, primary, "#0B1220");

  const cardColor =
    colors.cardColor ?? rgbaFromHex(cardColorHex, cardOpacity / 100);

  const buttonPrimaryBg = buttons.primaryBg ?? accent;
  const buttonPrimaryText = buttons.primaryText ?? "#0B1220";
  const buttonSecondaryBg = buttons.secondaryBg ?? "#FFFFFF";
  const buttonSecondaryText = buttons.secondaryText ?? "#0F1C2E";

  const hero = useMemo(() => theme.hero ?? {}, [theme]);

  const heroMode = hero.mode ?? (heroImageUrl ? "image-overlay" : "gradient");
  const heroHeight = Number(hero.height ?? 520);

  const heroImage = hero.imageUrl ?? heroImageUrl ?? null;
  const heroImagePosition = hero.imagePosition ?? "center center";
  const heroImageSize = hero.imageSize ?? "cover";

  const heroOverlayColor = hero.overlayColor ?? pageBaseColor ?? primary;
  const heroOverlayOpacity =
    typeof hero.overlayOpacity === "number"
      ? Math.min(1, Math.max(0, hero.overlayOpacity))
      : 0.58;

  const heroGradientCss = buildGradientCss(
    hero.gradient ?? colors.gradient,
    primary,
    "#0B1220"
  );

  const heroBlendGradientCss = buildGradientCss(
    hero.gradient ?? colors.gradient,
    primary,
    "#0B1220",
    0.34
  );

  const heroGlow = hero.glow ?? {};
  const heroGlowEnabled = heroGlow.enabled ?? true;
  const heroGlowColor = heroGlow.color ?? accent;
  const heroGlowX = Number(heroGlow.x ?? 20);
  const heroGlowY = Number(heroGlow.y ?? 10);
  const heroGlowSizeX = Number(heroGlow.sizeX ?? 900);
  const heroGlowSizeY = Number(heroGlow.sizeY ?? 500);
  const heroGlowOpacityHex = heroGlow.opacityHex ?? "22";

  const heroBackground = useMemo(() => {
    return buildHeroBackground({
      mode: heroMode,
      imageUrl: heroImage,
      gradientCss: heroGradientCss,
      blendGradientCss: heroBlendGradientCss,
      overlayColor: heroOverlayColor,
      overlayOpacity: heroOverlayOpacity,
      glowEnabled: heroGlowEnabled,
      glowColor: heroGlowColor,
      glowX: heroGlowX,
      glowY: heroGlowY,
      glowSizeX: heroGlowSizeX,
      glowSizeY: heroGlowSizeY,
      glowOpacityHex: heroGlowOpacityHex,
    });
  }, [
    heroMode,
    heroImage,
    heroGradientCss,
    heroBlendGradientCss,
    heroOverlayColor,
    heroOverlayOpacity,
    heroGlowEnabled,
    heroGlowColor,
    heroGlowX,
    heroGlowY,
    heroGlowSizeX,
    heroGlowSizeY,
    heroGlowOpacityHex,
  ]);

  const shareButtonBg = adaptiveText.cardSoft;
  const shareButtonText = adaptiveText.primary;

  const headline = theme.headline ?? event?.name ?? "Undangan";
  const tagline = theme.tagline ?? "Undangan Kehadiran";
  const about =
    theme.about ??
    "Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri acara berikut.";
  const hostName = theme.hostName ?? "Panitia";
  const salam = theme.salam ?? "Assalamualaikum Wr. Wb.";
  const guestGreeting = theme.guestGreeting ?? "";
  const dresscodeMale = theme.dresscodeMale ?? "";
  const dresscodeFemale = theme.dresscodeFemale ?? "";
  const closingText =
    theme.closingText ??
    "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu berkenan hadir. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.";
  const eventEndDate = theme.eventEndDate ?? null;

  const venueName = locationData.name ?? "";
  const venueAddress = locationData.address ?? event?.location ?? "";
  const venueLat = locationData.lat ?? "";
  const venueLng = locationData.lng ?? "";

  const mapsUrl =
    venueLat && venueLng
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${venueLat},${venueLng}`
        )}`
      : venueAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddress)}`
      : null;

  const agenda: AgendaItem[] = Array.isArray(theme.agenda) ? theme.agenda : [];
  const faqs: Array<{ q: string; a: string }> = theme.faqs ?? [];

  async function confirmAttendance() {
    try {
      if (!guest) return;
      if (guest.status === "confirmed" || guest.status === "checked_in") return;

      setActionLoading(true);
      setErr(null);

      const { error } = await supabase
        .from("guests")
        .update({ status: "confirmed" })
        .eq("id", guest.id);

      if (error) throw error;

      await loadInvitation(false);
    } catch (e: any) {
      setErr(getFriendlyInvitationError(e?.message ?? "Gagal konfirmasi kehadiran."));
    } finally {
      setActionLoading(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(guestCode);
      alert("Kode undangan berhasil disalin.");
    } catch {
      alert("Gagal menyalin kode. Silakan copy manual.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link undangan berhasil disalin.");
    } catch {
      alert("Gagal menyalin link.");
    }
  }

  async function buildQrPayload() {
    if (!guest || !event) throw new Error("Data guest/event belum siap.");

    const origin = window.location.origin;

    let qrPayload = `${origin}/admin/event/${guest.event_id}/scanner?code=${encodeURIComponent(
      guest.unique_code
    )}`;

    if (qrFormat === "QR Code v2") {
      qrPayload = JSON.stringify({
        v: 2,
        eventId: guest.event_id,
        code: guest.unique_code,
      });
    }

    if (qrFormat === "QR Code v3") {
      const { data, error } = await supabase.functions.invoke("ticket_sign", {
        body: { eventId: guest.event_id, code: guest.unique_code },
      });

      if (error) throw new Error(error.message);

      const token = data?.token;
      if (!token) throw new Error("Token QR tidak tersedia.");

      qrPayload = `${origin}/admin/event/${guest.event_id}/scanner?t=${encodeURIComponent(token)}`;
    }

    return qrPayload;
  }

  async function downloadPremiumBoardingPassPDF() {
    if (!guest || !event) return;

    await generateGuestTicketPdf({
      guest,
      event,
      buildQrPayload,
    });
  }

  if (loading) {
    return (
      <div
        className="min-h-screen p-10"
        style={{ background: pageGradient, color: adaptiveText.primary }}
      >
        Memuat undangan…
      </div>
    );
  }

  if (err && !guest && !event) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: pageGradient, color: adaptiveText.primary }}
      >
        <div
          className="max-w-lg w-full rounded-3xl border p-8 text-center"
          style={{
            backgroundColor: cardColor,
            borderColor: adaptiveText.cardBorder,
          }}
        >
          <div className="text-2xl font-semibold" style={{ color: adaptiveText.primary }}>
            Undangan Belum Dapat Ditampilkan
          </div>
          <div className="mt-3 leading-relaxed" style={{ color: adaptiveText.secondary }}>
            {err}
          </div>
        </div>
      </div>
    );
  }

  if (!guest || !event) {
    return (
      <div
        className="min-h-screen p-10"
        style={{ background: pageGradient, color: adaptiveText.primary }}
      >
        Undangan tidak ditemukan.
      </div>
    );
  }

  const isHeroImageMode =
    heroMode === "image" ||
    heroMode === "image-overlay" ||
    heroMode === "image-gradient-blend";

  const contentBackground = isHeroImageMode ? pageGradient : primary;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: primary,
        color: adaptiveText.primary,
      }}
    >
      <section
        className="relative overflow-hidden"
        style={{ minHeight: `max(${heroHeight}px, 70vh)` }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: heroBackground,
            backgroundPosition: isHeroImageMode ? heroImagePosition : "center",
            backgroundSize: isHeroImageMode ? heroImageSize : "cover",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-16">
          <div className="mt-16 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: adaptiveText.border,
                    color: adaptiveText.secondary,
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  {tagline}
                </div>

                <ThemedButton
                  onClick={copyLink}
                  variant="outline"
                  className="h-11 rounded-xl overflow-hidden bg-transparent"
                  backgroundColor={shareButtonBg}
                  textColor={shareButtonText}
                  hoverColor={darkenHex(pageBaseColor, 0.08)}
                >
                  <Share2 className="m-1 h-4 w-4" />
                </ThemedButton>
              </div>

              <div className="mt-4 flex items-center gap-5">
                {brand.logoUrl && (
                  <div className="bg-white/5 backdrop-blur-md p-1 px-4 object-cover rounded-xl border border-white/10">
                    <img
                      src={brand.logoUrl}
                      alt="Logo"
                      className="h-30 md:h-30 w-auto object-contain"
                    />
                  </div>
                )}

                <h1
                  className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight"
                  style={{ color: adaptiveText.primary }}
                >
                  {headline}
                </h1>
              </div>

              <div
                className="mt-4 flex flex-wrap gap-6"
                style={{ color: adaptiveText.secondary }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" style={{ color: accent }} />
                  {fmtDate(event.event_date)}
                </div>

                <div className="flex items-center gap-2">
                  <Clock3 className="w-5 h-5" style={{ color: accent }} />
                  {fmtTimeRange(event.event_date, eventEndDate)}
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: accent }} />
                  {venueName || venueAddress || "Lokasi menyusul"}
                </div>
              </div>

              <div className="mt-8">
                <div className="text-sm mb-3" style={{ color: adaptiveText.muted }}>
                  Hitung mundur acara
                </div>

                {countdown.isExpired ? (
                  <div className="rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-4 text-green-200">
                    Acara sedang berlangsung atau waktu acara sudah lewat.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                    {[
                      { label: "Hari", value: countdown.days },
                      { label: "Jam", value: countdown.hours },
                      { label: "Menit", value: countdown.minutes },
                      { label: "Detik", value: countdown.seconds },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border p-4 text-center"
                        style={{
                          backgroundColor: cardColor,
                          borderColor: adaptiveText.cardBorder,
                        }}
                      >
                        <div className="text-2xl md:text-3xl font-semibold">{item.value}</div>
                        <div className="text-xs mt-1" style={{ color: adaptiveText.muted }}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="mt-6 text-lg leading-relaxed"
                style={{ color: adaptiveText.secondary }}
              >
                Kepada Yth.
                <br />
                {guestGreeting ? (
                  <div className="text-base md:text-[13px]" style={{ color: adaptiveText.soft }}>
                    {guestGreeting}
                  </div>
                ) : null}
                <span
                  className="text-2xl md:text-3xl font-semibold"
                  style={{ color: adaptiveText.primary }}
                >
                  {guest.full_name}
                </span>
              </div>

              {guest.organization ? (
                <div
                  className="mt-3 inline-flex items-center gap-2"
                  style={{ color: adaptiveText.secondary }}
                >
                  <Building2 className="w-4 h-4" style={{ color: accent }} />
                  {guest.organization}
                  {guest.dept_class && (
                    <>
                      {" "}
                      • <BoxIcon className="w-4 h-4" style={{ color: accent }} />{" "}
                      {guest.dept_class}
                    </>
                  )}
                </div>
              ) : null}

              <p className="mt-8 text-md" style={{ color: adaptiveText.secondary }}>
                {salam} {greetingByHour()},
              </p>
              <p
                className="mt-2 max-w-2xl leading-relaxed"
                style={{ color: adaptiveText.secondary }}
              >
                {about}
              </p>
            </div>

            <div
              className="rounded-3xl overflow-hidden border shadow-[0_16px_60px_rgba(0,0,0,0.45)]"
              style={{
                backgroundColor: cardColor,
                borderColor: adaptiveText.cardBorder,
              }}
            >
              <div className="flex flex-wrap gap-2 p-5 justify-end">
                {guest.status === "registered" ? (
                  <ThemedButton
                    onClick={confirmAttendance}
                    disabled={actionLoading}
                    className="h-11 rounded-xl px-6"
                    backgroundColor={buttonSecondaryBg}
                    textColor={buttonSecondaryText}
                  >
                    {actionLoading ? "Memproses…" : "Konfirmasi"}
                  </ThemedButton>
                ) : (
                  <ThemedButton
                    onClick={downloadPremiumBoardingPassPDF}
                    variant="outline"
                    className="h-11 rounded-xl"
                    backgroundColor={buttonPrimaryBg}
                    textColor={buttonPrimaryText}
                  >
                    Download E-Ticket
                  </ThemedButton>
                )}

                {mapsUrl ? (
                  <ThemedButton
                    asChild
                    variant="outline"
                    className="h-11 rounded-xl"
                    backgroundColor={buttonPrimaryBg}
                    textColor={buttonPrimaryText}
                  >
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-11 items-center justify-center px-4 rounded-xl"
                    >
                      <MapPinHouse className="w-4 h-4 mr-2" />
                      Lihat Lokasi
                    </a>
                  </ThemedButton>
                ) : null}
              </div>

              <div
                className="p-5 border-b"
                style={{
                  background: `linear-gradient(135deg, ${rgbaFromHex(
                    primary,
                    0.88
                  )}, ${rgbaFromHex(accent, 0.15)})`,
                  borderColor: adaptiveText.cardBorder,
                }}
              >
                <div className="mt-auto grid grid-cols-2 gap-3 text-sm">
                  <div className="p-4">
                    <div className="text-xs" style={{ color: adaptiveText.muted }}>
                      Peserta:
                    </div>
                    <div className="mt-1 font-medium" style={{ color: adaptiveText.primary }}>
                      {guest.identity_no}
                    </div>
                    <div className="mt-1 font-medium" style={{ color: adaptiveText.primary }}>
                      {guest.full_name}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      backgroundColor: adaptiveText.cardSoft,
                      borderColor: adaptiveText.cardBorder,
                    }}
                  >
                    <div className="text-xs" style={{ color: adaptiveText.muted }}>
                      Status:
                    </div>
                    <div className="mt-1 font-medium">{statusBadge(guest.status)}</div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-2xl bg-white p-3 flex justify-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Ticket" className="w-60 h-60" />
                  ) : (
                    <div className="w-60 h-60 flex items-center justify-center text-black/60">
                      QR tidak tersedia
                    </div>
                  )}
                </div>

                <div
                  className="mt-4 text-center text-xs"
                  style={{ color: adaptiveText.muted }}
                >
                  Tunjukkan QR ini saat registrasi
                </div>

                <div
                  className="mt-4 rounded-2xl border p-4 flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: adaptiveText.cardSoft,
                    borderColor: adaptiveText.cardBorder,
                  }}
                >
                  <div>
                    <div className="text-xs" style={{ color: adaptiveText.muted }}>
                      Kode Undangan
                    </div>
                    <div
                      className="font-mono text-lg"
                      style={{ color: adaptiveText.primary }}
                    >
                      {guest.unique_code}
                    </div>
                  </div>

                  <ThemedButton
                    variant="outline"
                    className="rounded-xl"
                    backgroundColor={buttonPrimaryBg}
                    textColor={buttonPrimaryText}
                    onClick={copyCode}
                  >
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  </ThemedButton>
                </div>

                {guest.checkin_time ? (
                  <div className="mt-4 rounded-2xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-4 text-sm text-green-200">
                    Check-in tercatat pada {fmtDateTime(guest.checkin_time)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className="min-h-screen"
        style={{
          background: contentBackground,
          color: adaptiveText.primary,
        }}
      >
        <section className="mt-4 max-w-6xl mx-auto px-6 pb-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: cardColor,
                borderColor: adaptiveText.cardBorder,
              }}
            >
              <div
                className="text-sm flex items-center gap-2"
                style={{ color: adaptiveText.secondary }}
              >
                <Info className="w-4 h-4" style={{ color: accent }} />
                Acara
              </div>
              <div className="mt-2 font-semibold" style={{ color: adaptiveText.primary }}>
                {event.name}
              </div>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: cardColor,
                borderColor: adaptiveText.cardBorder,
              }}
            >
              <div
                className="text-sm flex items-center gap-2"
                style={{ color: adaptiveText.secondary }}
              >
                <Calendar className="w-4 h-4" style={{ color: accent }} />
                Waktu Acara
              </div>
              <div className="mt-2 font-semibold" style={{ color: adaptiveText.primary }}>
                {fmtDate(event.event_date)}
              </div>
              <div className="text-sm mt-1" style={{ color: adaptiveText.muted }}>
                Mulai: {fmtTime(event.event_date)}
              </div>
              <div className="text-sm" style={{ color: adaptiveText.muted }}>
                Selesai: {fmtTime(eventEndDate)}
              </div>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: cardColor,
                borderColor: adaptiveText.cardBorder,
              }}
            >
              <div
                className="text-sm flex items-center gap-2"
                style={{ color: adaptiveText.secondary }}
              >
                <MapPin className="w-4 h-4" style={{ color: accent }} />
                Lokasi
              </div>
              <div className="mt-2 font-semibold" style={{ color: adaptiveText.primary }}>
                {venueName || "Lokasi acara"}
              </div>
              <div className="text-sm mt-1" style={{ color: adaptiveText.muted }}>
                {venueAddress || "Lokasi menyusul"}
              </div>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: cardColor,
                borderColor: adaptiveText.cardBorder,
              }}
            >
              <div
                className="text-sm flex items-center gap-2"
                style={{ color: adaptiveText.secondary }}
              >
                <Ticket className="w-4 h-4" style={{ color: accent }} />
                Dresscode
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span style={{ color: adaptiveText.muted }}>Laki-laki:</span>{" "}
                  <span className="font-semibold" style={{ color: adaptiveText.primary }}>
                    {dresscodeMale || "-"}
                  </span>
                </div>
                <div>
                  <span style={{ color: adaptiveText.muted }}>Perempuan:</span>{" "}
                  <span className="font-semibold" style={{ color: adaptiveText.primary }}>
                    {dresscodeFemale || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {agenda.length > 0 ? (
          <section className="max-w-6xl mx-auto px-6 pt-12">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold" style={{ color: adaptiveText.primary }}>
                Susunan Acara
              </h2>
            </div>

            <div className="mt-6 space-y-3">
              {agenda.map((a, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border p-5 flex gap-4"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: adaptiveText.cardBorder,
                  }}
                >
                  <div
                    className="shrink-0 w-36 text-sm font-mono"
                    style={{ color: adaptiveText.secondary }}
                  >
                    {a.start_time || a.time || "-"}
                    {a.end_time ? ` - ${a.end_time}` : ""}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold" style={{ color: adaptiveText.primary }}>
                      {a.title}
                    </div>
                    {a.note ? (
                      <div className="text-sm mt-1" style={{ color: adaptiveText.muted }}>
                        {a.note}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {faqs.length > 0 ? (
          <section className="max-w-6xl mx-auto px-6 pt-12">
            <h2 className="text-2xl font-semibold" style={{ color: adaptiveText.primary }}>
              Informasi Tambahan
            </h2>

            <div className="mt-6 space-y-3">
              {faqs.map((f, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border p-5"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: adaptiveText.cardBorder,
                  }}
                >
                  <div className="font-semibold" style={{ color: adaptiveText.primary }}>
                    {f.q}
                  </div>
                  <div
                    className="mt-2 leading-relaxed"
                    style={{ color: adaptiveText.secondary }}
                  >
                    {f.a}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div
            className="rounded-3xl border p-8 text-center"
            style={{
              backgroundColor: cardColor,
              borderColor: adaptiveText.cardBorder,
            }}
          >
            <div className="inline-flex items-center" style={{ color: adaptiveText.secondary }}>
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="Logo" className="h-25" />
              ) : (
                <span>
                  <CheckCheck className="w-5 h-5" style={{ color: accent }} />
                </span>
              )}
            </div>

            <div
              className="mt-6 leading-relaxed max-w-2xl mx-auto"
              style={{ color: adaptiveText.secondary }}
            >
              {closingText}
            </div>

            <div
              className="mt-6 leading-relaxed max-w-2xl mx-auto"
              style={{ color: adaptiveText.muted }}
            >
              Hormat kami,
              <br />
              <span className="font-medium" style={{ color: adaptiveText.primary }}>
                {hostName || "-"}
              </span>
            </div>

            <div className="mt-6 text-xs" style={{ color: adaptiveText.soft }}>
              Powered by Invitara • Mental Coaching Character
            </div>
          </div>
        </section>

        {err ? (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <div className="rounded-xl border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200 backdrop-blur">
              {err}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}