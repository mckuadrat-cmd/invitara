import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  Save,
  Mail,
  Calendar,
  QrCode,
  Palette,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Upload,
  Image as ImageIcon,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "sonner";

const STORAGE_BUCKET = "event-assets";

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
  theme: any;
};

type EventSettingsRow = {
  event_id: string;
  qr_format: string;
  auto_email: boolean;
  allow_reentry: boolean;
  vip_badge_color: string;
};

type AgendaItem = {
  start_time: string;
  end_time: string;
  title: string;
  note?: string;
};

type FaqItem = {
  q: string;
  a: string;
};

type GradientStop = {
  id: string;
  color: string;
  position: number;
};

function isoToLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

function buildGradientCss(
  type: "linear" | "radial",
  angle: number,
  stops: GradientStop[]
) {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopText = sorted.map((s) => `${s.color} ${s.position}%`).join(", ");

  if (type === "radial") {
    return `radial-gradient(circle, ${stopText})`;
  }

  return `linear-gradient(${angle}deg, ${stopText})`;
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

function isDarkColor(hex: string) {
  const { r, g, b } = hexToRgb(hex, { r: 15, g: 28, b: 46 });
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 155;
}

export default function SettingsPage() {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");

  const [location, setLocation] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");

  const [qrFormat, setQrFormat] = useState("QR Code v1");
  const [autoEmail, setAutoEmail] = useState(false);
  const [allowReentry, setAllowReentry] = useState(false);
  const [vipBadgeColor, setVipBadgeColor] = useState("#D6C6A5");

  const [themePrimary, setThemePrimary] = useState("#0F1C2E");
  const [themeAccent, setThemeAccent] = useState("#D6C6A5");

  const [themeGradientType, setThemeGradientType] = useState<"linear" | "radial">("linear");
  const [themeGradientAngle, setThemeGradientAngle] = useState("135");
  const [themeGradientStops, setThemeGradientStops] = useState<GradientStop[]>([
    { id: uid(), color: "#0F1C2E", position: 0 },
    { id: uid(), color: "#0B1220", position: 100 },
  ]);

  const [themePageBaseColor, setThemePageBaseColor] = useState("#0F1C2E");
  const [themeCardColorHex, setThemeCardColorHex] = useState("#FFFFFF");
  const [themeCardOpacity, setThemeCardOpacity] = useState("8");

  const [themeLogoUrl, setThemeLogoUrl] = useState("/Invitara.png");
  const [themeHeroUrl, setThemeHeroUrl] = useState("");

  const [themeButtonPrimaryBg, setThemeButtonPrimaryBg] = useState("#D6C6A5");
  const [themeButtonPrimaryText, setThemeButtonPrimaryText] = useState("#0B1220");
  const [themeButtonSecondaryBg, setThemeButtonSecondaryBg] = useState("#FFFFFF");
  const [themeButtonSecondaryText, setThemeButtonSecondaryText] = useState("#0F1C2E");

  const [themeTagline, setThemeTagline] = useState("PELEPASAN & APRESIASI");
  const [themeHeadline, setThemeHeadline] = useState("");
  const [themeAbout, setThemeAbout] = useState("");

  const [themeHostName, setThemeHostName] = useState("");
  const [themeSalam, setThemeSalam] = useState("Assalamualaikum Wr. Wb.");
  const [themeGuestGreeting, setThemeGuestGreeting] = useState("Orang Tua/Wali Murid");
  const [themeDresscodeMale, setThemeDresscodeMale] = useState("Kemeja batik / formal");
  const [themeDresscodeFemale, setThemeDresscodeFemale] = useState("Busana sopan / formal");
  const [themeClosingText, setThemeClosingText] = useState(
    "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu berkenan hadir. Atas perhatian dan kehadirannya, kami ucapkan terima kasih."
  );

  const [themeHeroMode, setThemeHeroMode] = useState<
    "image" | "gradient" | "image-overlay" | "image-gradient-blend"
  >("image-overlay");

  const [themeHeroHeight, setThemeHeroHeight] = useState("560");
  const [themeHeroOverlayColor, setThemeHeroOverlayColor] = useState("#0F1C2E");
  const [themeHeroOverlayOpacity, setThemeHeroOverlayOpacity] = useState("58");
  const [themeHeroImagePosition, setThemeHeroImagePosition] = useState("center center");
  const [themeHeroImageSize, setThemeHeroImageSize] = useState("cover");

  const [themeHeroGlowEnabled, setThemeHeroGlowEnabled] = useState(true);
  const [themeHeroGlowColor, setThemeHeroGlowColor] = useState("#D6C6A5");
  const [themeHeroGlowX, setThemeHeroGlowX] = useState("20");
  const [themeHeroGlowY, setThemeHeroGlowY] = useState("10");
  const [themeHeroGlowSizeX, setThemeHeroGlowSizeX] = useState("900");
  const [themeHeroGlowSizeY, setThemeHeroGlowSizeY] = useState("500");
  const [themeHeroGlowOpacityHex, setThemeHeroGlowOpacityHex] = useState("22");

  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);

  const gradientPreview = useMemo(() => {
    return buildGradientCss(
      themeGradientType,
      Number(themeGradientAngle || 135),
      themeGradientStops
    );
  }, [themeGradientType, themeGradientAngle, themeGradientStops]);

  const cardPreview = useMemo(() => {
    const opacity = clamp(Number(themeCardOpacity || 8), 0, 100) / 100;
    return rgbaFromHex(themeCardColorHex, opacity);
  }, [themeCardColorHex, themeCardOpacity]);

  const autoTextMode = useMemo(() => isDarkColor(themePageBaseColor), [themePageBaseColor]);

  async function uploadAsset(file: File, folder: "logos" | "heroes") {
    if (!eventId) throw new Error("Event ID tidak ditemukan.");

    const ext = file.name.split(".").pop() || "png";
    const safeExt = ext.toLowerCase();
    const fileName = `${eventId}/${folder}/${Date.now()}-${uid()}.${safeExt}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleLogoUpload(file?: File | null) {
    if (!file) return;
    try {
      setUploadingLogo(true);
      const publicUrl = await uploadAsset(file, "logos");
      setThemeLogoUrl(publicUrl);
      toast.success("Logo berhasil diupload");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload logo gagal");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleHeroUpload(file?: File | null) {
    if (!file) return;
    try {
      setUploadingHero(true);
      const publicUrl = await uploadAsset(file, "heroes");
      setThemeHeroUrl(publicUrl);
      toast.success("Backgrounq image berhasil diupload");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload background image gagal");
    } finally {
      setUploadingHero(false);
    }
  }

  function addGradientStop() {
    setThemeGradientStops((prev) => {
      const sorted = [...prev].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      const nextPos = last ? clamp(last.position - 10, 0, 100) : 50;

      return [
        ...prev,
        {
          id: uid(),
          color: "#ffffff",
          position: nextPos,
        },
      ].sort((a, b) => a.position - b.position);
    });
  }

  function updateGradientStop(id: string, patch: Partial<GradientStop>) {
    setThemeGradientStops((prev) =>
      prev
        .map((stop) =>
          stop.id === id
            ? {
                ...stop,
                ...patch,
                position:
                  patch.position !== undefined
                    ? clamp(Number(patch.position), 0, 100)
                    : stop.position,
              }
            : stop
        )
        .sort((a, b) => a.position - b.position)
    );
  }

  function removeGradientStop(id: string) {
    setThemeGradientStops((prev) => {
      if (prev.length <= 2) {
        toast.message("Minimal harus ada 2 titik gradasi");
        return prev;
      }
      return prev.filter((s) => s.id !== id).sort((a, b) => a.position - b.position);
    });
  }

  async function loadAll() {
    if (!eventId) return;

    setLoading(true);

    const ev = await supabase
      .from("events")
      .select("id,name,event_date,location,theme")
      .eq("id", eventId)
      .single();

    if (ev.error) {
      toast.error(ev.error.message);
      setLoading(false);
      return;
    }

    const e = ev.data as EventRow;
    const t = (e as any).theme ?? {};
    const brand = t.brand ?? t ?? {};
    const colors = t.colors ?? {};
    const buttons = t.buttons ?? {};
    const locationData = t.locationData ?? {};
    const gradient = colors.gradient ?? {};
    const hero = t.hero ?? {};

    setEventName(e.name ?? "");
    setEventStartDate(isoToLocalInput(e.event_date));
    setEventEndDate(isoToLocalInput(t.eventEndDate));

    setLocation(e.location ?? "");
    setLocationName(locationData.name ?? "");
    setLocationAddress(locationData.address ?? e.location ?? "");

    setThemePrimary(brand.primary ?? "#0F1C2E");
    setThemeAccent(brand.accent ?? "#D6C6A5");
    setThemeLogoUrl(brand.logoUrl ?? "/Invitara.png");

    setThemeGradientType(gradient.type ?? "linear");
    setThemeGradientAngle(String(gradient.angle ?? 135));
    setThemeGradientStops(
      Array.isArray(gradient.stops) && gradient.stops.length >= 2
        ? gradient.stops.map((stop: any) => ({
            id: uid(),
            color: stop.color ?? "#000000",
            position: clamp(Number(stop.position ?? 0), 0, 100),
          }))
        : [
            { id: uid(), color: "#0F1C2E", position: 0 },
            { id: uid(), color: "#0B1220", position: 100 },
          ]
    );

    setThemePageBaseColor(colors.pageBaseColor ?? brand.primary ?? "#0F1C2E");
    setThemeCardColorHex(colors.cardColorHex ?? "#FFFFFF");
    setThemeCardOpacity(String(colors.cardOpacity ?? 8));

    setThemeButtonPrimaryBg(buttons.primaryBg ?? "#D6C6A5");
    setThemeButtonPrimaryText(buttons.primaryText ?? "#0B1220");
    setThemeButtonSecondaryBg(buttons.secondaryBg ?? "#FFFFFF");
    setThemeButtonSecondaryText(buttons.secondaryText ?? "#0F1C2E");

    setThemeTagline(t.tagline ?? "PELEPASAN & APRESIASI");
    setThemeHeadline(t.headline ?? e.name ?? "");
    setThemeAbout(
      t.about ?? "Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri acara ini."
    );

    setThemeHostName(t.hostName ?? "");
    setThemeSalam(t.salam ?? "Assalamualaikum Wr. Wb.");
    setThemeGuestGreeting(t.guestGreeting ?? "Orang Tua/Wali Murid");
    setThemeDresscodeMale(t.dresscodeMale ?? "Kemeja batik / formal");
    setThemeDresscodeFemale(t.dresscodeFemale ?? "Busana sopan / formal");
    setThemeClosingText(
      t.closingText ??
        "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu berkenan hadir. Atas perhatian dan kehadirannya, kami ucapkan terima kasih."
    );

    setThemeHeroUrl(hero.imageUrl ?? brand.heroImageUrl ?? "");
    setThemeHeroMode(hero.mode ?? (hero.imageUrl || brand.heroImageUrl ? "image-overlay" : "gradient"));
    setThemeHeroHeight(String(hero.height ?? 560));
    setThemeHeroOverlayColor(hero.overlayColor ?? colors.pageBaseColor ?? brand.primary ?? "#0F1C2E");
    setThemeHeroOverlayOpacity(
      String(
        typeof hero.overlayOpacity === "number"
          ? Math.round(hero.overlayOpacity * 100)
          : 58
      )
    );
    setThemeHeroImagePosition(hero.imagePosition ?? "center center");
    setThemeHeroImageSize(hero.imageSize ?? "cover");

    setThemeHeroGlowEnabled(hero.glow?.enabled ?? true);
    setThemeHeroGlowColor(hero.glow?.color ?? brand.accent ?? "#D6C6A5");
    setThemeHeroGlowX(String(hero.glow?.x ?? 20));
    setThemeHeroGlowY(String(hero.glow?.y ?? 10));
    setThemeHeroGlowSizeX(String(hero.glow?.sizeX ?? 900));
    setThemeHeroGlowSizeY(String(hero.glow?.sizeY ?? 500));
    setThemeHeroGlowOpacityHex(hero.glow?.opacityHex ?? "22");

    setAgendaItems(
      Array.isArray(t.agenda)
        ? t.agenda.map((item: any) => ({
            start_time: item.start_time ?? "",
            end_time: item.end_time ?? "",
            title: item.title ?? "",
            note: item.note ?? "",
          }))
        : []
    );

    setFaqItems(Array.isArray(t.faqs) ? t.faqs : []);

    const st = await supabase
      .from("event_settings")
      .select("event_id,qr_format,auto_email,allow_reentry,vip_badge_color")
      .eq("event_id", eventId)
      .maybeSingle();

    if (!st.error && st.data) {
      const s = st.data as EventSettingsRow;
      setQrFormat(s.qr_format ?? "QR Code v1");
      setAutoEmail(!!s.auto_email);
      setAllowReentry(!!s.allow_reentry);
      setVipBadgeColor(s.vip_badge_color ?? "#D6C6A5");
    } else {
      setQrFormat("QR Code v1");
      setAutoEmail(false);
      setAllowReentry(false);
      setVipBadgeColor("#D6C6A5");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleSave() {
    if (!eventId) return;
    setSaving(true);

    try {
      const isoStartDate = eventStartDate ? new Date(eventStartDate).toISOString() : null;
      const isoEndDate = eventEndDate ? new Date(eventEndDate).toISOString() : null;

      const finalLocation = locationAddress || location || "";
      const gradientAngleNum = Number(themeGradientAngle || 135);
      const finalCardOpacity = clamp(Number(themeCardOpacity || 8), 0, 100);

      const finalHeroHeight = clamp(Number(themeHeroHeight || 560), 280, 1200);
      const finalHeroOverlayOpacity = clamp(Number(themeHeroOverlayOpacity || 58), 0, 100) / 100;

      const themeToSave = {
        brand: {
          primary: themePrimary,
          accent: themeAccent,
          logoUrl: themeLogoUrl,
        },
        hero: {
          mode: themeHeroMode,
          imageUrl: themeHeroUrl || null,
          height: finalHeroHeight,
          overlayColor: themeHeroOverlayColor,
          overlayOpacity: finalHeroOverlayOpacity,
          imagePosition: themeHeroImagePosition || "center center",
          imageSize: themeHeroImageSize,
          glow: {
            enabled: themeHeroGlowEnabled,
            color: themeHeroGlowColor,
            x: clamp(Number(themeHeroGlowX || 20), 0, 100),
            y: clamp(Number(themeHeroGlowY || 10), 0, 100),
            sizeX: clamp(Number(themeHeroGlowSizeX || 900), 100, 3000),
            sizeY: clamp(Number(themeHeroGlowSizeY || 500), 100, 3000),
            opacityHex: themeHeroGlowOpacityHex || "22",
          },
        },
        colors: {
          pageBaseColor: themePageBaseColor,
          gradient: {
            type: themeGradientType,
            angle: Number.isNaN(gradientAngleNum) ? 135 : gradientAngleNum,
            stops: themeGradientStops
              .map((s) => ({
                color: s.color,
                position: clamp(Number(s.position), 0, 100),
              }))
              .sort((a, b) => a.position - b.position),
          },
          cardColorHex: themeCardColorHex,
          cardOpacity: finalCardOpacity,
          cardColor: rgbaFromHex(themeCardColorHex, finalCardOpacity / 100),
        },
        buttons: {
          primaryBg: themeButtonPrimaryBg,
          primaryText: themeButtonPrimaryText,
          secondaryBg: themeButtonSecondaryBg,
          secondaryText: themeButtonSecondaryText,
        },
        tagline: themeTagline,
        headline: themeHeadline || eventName,
        about: themeAbout,
        hostName: themeHostName,
        salam: themeSalam,
        guestGreeting: themeGuestGreeting,
        dresscodeMale: themeDresscodeMale,
        dresscodeFemale: themeDresscodeFemale,
        closingText: themeClosingText,
        eventEndDate: isoEndDate,
        locationData: {
          name: locationName,
          address: locationAddress || finalLocation,
        },
        agenda: agendaItems,
        faqs: faqItems,
      };

      const upEv = await supabase
        .from("events")
        .update({
          name: eventName,
          event_date: isoStartDate,
          location: finalLocation || null,
          theme: themeToSave,
        })
        .eq("id", eventId);

      if (upEv.error) throw new Error(upEv.error.message);

      const upSt = await supabase
        .from("event_settings")
        .upsert(
          {
            event_id: eventId,
            qr_format: qrFormat,
            auto_email: autoEmail,
            allow_reentry: allowReentry,
            vip_badge_color: vipBadgeColor,
          },
          { onConflict: "event_id" }
        );

      if (upSt.error) throw new Error(upSt.error.message);

      toast.success("Settings berhasil disimpan");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function move<T>(arr: T[], from: number, to: number) {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [it] = copy.splice(from, 1);
    copy.splice(to, 0, it);
    return copy;
  }

  function updateAgenda(idx: number, patch: Partial<AgendaItem>) {
    setAgendaItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function addAgenda() {
    setAgendaItems((prev) => [
      ...prev,
      { start_time: "", end_time: "", title: "", note: "" },
    ]);
  }

  function removeAgenda(idx: number) {
    setAgendaItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function upAgenda(idx: number) {
    setAgendaItems((prev) => move(prev, idx, idx - 1));
  }

  function downAgenda(idx: number) {
    setAgendaItems((prev) => move(prev, idx, idx + 1));
  }

  function updateFaq(idx: number, patch: Partial<FaqItem>) {
    setFaqItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function addFaq() {
    setFaqItems((prev) => [...prev, { q: "", a: "" }]);
  }

  function removeFaq(idx: number) {
    setFaqItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function upFaq(idx: number) {
    setFaqItems((prev) => move(prev, idx, idx - 1));
  }

  function downFaq(idx: number) {
    setFaqItems((prev) => move(prev, idx, idx + 1));
  }

  if (!eventId) return <div className="p-4">Missing eventId in route.</div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl text-[#0F1C2E] mb-2">Event Settings</h1>
        <p className="text-gray-600">Configure details & preferences (per event)</p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Calendar className="w-5 h-5 text-[#D6C6A5]" />
              Event Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Enter event name"
                disabled={loading}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eventStartDate">Waktu Mulai Acara</Label>
                <Input
                  id="eventStartDate"
                  type="datetime-local"
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="eventEndDate">Waktu Selesai Acara</Label>
                <Input
                  id="eventEndDate"
                  type="datetime-local"
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Lokasi Acara</Label>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nama Tempat</Label>
                  <Input
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Contoh: Gedung Tio Ma"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label>Alamat Lokasi</Label>
                  <Input
                    value={locationAddress}
                    onChange={(e) => {
                      setLocationAddress(e.target.value);
                      setLocation(e.target.value);
                    }}
                    placeholder="Contoh: Jl. Raya ..."
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Palette className="w-5 h-5 text-[#D6C6A5]" />
              Invitation Theme (Public Page)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-6 gap-4 items-end">
              <div>
                <Label>Primary</Label>
                <Input
                  type="color"
                  value={themePrimary}
                  onChange={(e) => setThemePrimary(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Accent</Label>
                <Input
                  type="color"
                  value={themeAccent}
                  onChange={(e) => setThemeAccent(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Page Base</Label>
                <Input
                  type="color"
                  value={themePageBaseColor}
                  onChange={(e) => setThemePageBaseColor(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Primary Btn BG</Label>
                <Input
                  type="color"
                  value={themeButtonPrimaryBg}
                  onChange={(e) => setThemeButtonPrimaryBg(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Primary Btn Text</Label>
                <Input
                  type="color"
                  value={themeButtonPrimaryText}
                  onChange={(e) => setThemeButtonPrimaryText(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Secondary Btn BG</Label>
                <Input
                  type="color"
                  value={themeButtonSecondaryBg}
                  onChange={(e) => setThemeButtonSecondaryBg(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-6 gap-4 items-end">
              <div>
                <Label>Secondary Btn Text</Label>
                <Input
                  type="color"
                  value={themeButtonSecondaryText}
                  onChange={(e) => setThemeButtonSecondaryText(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div>
                <Label>Card Color</Label>
                <Input
                  type="color"
                  value={themeCardColorHex}
                  onChange={(e) => setThemeCardColorHex(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Card Opacity ({themeCardOpacity}%)</Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={themeCardOpacity}
                  onChange={(e) => setThemeCardOpacity(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Preview Auto Text</Label>
                <div
                  className="h-12 rounded-xl border px-3 flex items-center text-sm"
                  style={{
                    background: themePageBaseColor,
                    color: autoTextMode ? "#FFFFFF" : "#111827",
                  }}
                >
                  {autoTextMode ? "Background gelap → text terang" : "Background terang → text gelap"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[#0F1C2E]">Gradient Editor</div>
                <Button type="button" variant="outline" onClick={addGradientStop} disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stop
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Gradient Type</Label>
                  <Select
                    value={themeGradientType}
                    onValueChange={(v) => setThemeGradientType(v as "linear" | "radial")}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">linear</SelectItem>
                      <SelectItem value="radial">radial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Angle</Label>
                  <Input
                    type="number"
                    value={themeGradientAngle}
                    onChange={(e) => setThemeGradientAngle(e.target.value)}
                    placeholder="135"
                    disabled={loading || themeGradientType === "radial"}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Gradient Bar</Label>

                <div className="relative h-16 rounded-xl border border-gray-200 overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{ background: gradientPreview }}
                  />
                  {[...themeGradientStops]
                    .sort((a, b) => a.position - b.position)
                    .map((stop) => (
                      <div
                        key={stop.id}
                        className="absolute -bottom-0.5 -translate-x-1/2"
                        style={{ left: `${stop.position}%` }}
                      >
                        <div className="w-0.5 h-10 bg-white/80 mx-auto" />
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: stop.color }}
                        />
                      </div>
                    ))}
                </div>

                <div className="space-y-3">
                  {[...themeGradientStops]
                    .sort((a, b) => a.position - b.position)
                    .map((stop, idx) => (
                      <div
                        key={stop.id}
                        className="grid md:grid-cols-12 gap-3 items-center rounded-lg border border-gray-200 p-3"
                      >
                        <div className="md:col-span-2 text-sm font-medium text-[#0F1C2E]">
                          Stop {idx + 1}
                        </div>

                        <div className="md:col-span-2">
                          <Input
                            type="color"
                            value={stop.color}
                            onChange={(e) =>
                              updateGradientStop(stop.id, { color: e.target.value })
                            }
                            disabled={loading}
                            className="h-11"
                          />
                        </div>

                        <div className="md:col-span-6">
                          <Input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={stop.position}
                            onChange={(e) =>
                              updateGradientStop(stop.id, {
                                position: Number(e.target.value),
                              })
                            }
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={stop.position}
                            onChange={(e) =>
                              updateGradientStop(stop.id, {
                                position: Number(e.target.value),
                              })
                            }
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => removeGradientStop(stop.id)}
                            disabled={loading || themeGradientStops.length <= 2}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <Label>Preview Card</Label>
                <div
                  className="rounded-2xl border p-4 mt-2"
                  style={{
                    background: gradientPreview,
                    borderColor: "#E5E7EB",
                  }}
                >
                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      backgroundColor: cardPreview,
                      borderColor: "rgba(255,255,255,0.15)",
                      color: autoTextMode ? "#FFFFFF" : "#111827",
                    }}
                  >
                    Ini preview warna card.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Logo Event</Label>
                <div className="flex gap-2">
                  <Input
                    value={themeLogoUrl}
                    onChange={(e) => setThemeLogoUrl(e.target.value)}
                    placeholder="Upload or input URL"
                    disabled={loading || uploadingLogo}
                  />
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      disabled={loading || uploadingLogo}
                    />
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingLogo ? "Uploading..." : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
                {themeLogoUrl ? (
                  <div className="rounded-lg border border-gray-200 p-3 inline-block">
                    <img src={themeLogoUrl} alt="Logo preview" className="h-12 w-auto object-contain" />
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label>Background Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={themeHeroUrl}
                    onChange={(e) => setThemeHeroUrl(e.target.value)}
                    placeholder="Upload or input URL"
                    disabled={loading || uploadingHero}
                  />
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroUpload(e.target.files?.[0])}
                      disabled={loading || uploadingHero}
                    />
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        {uploadingHero ? "Uploading..." : "Upload"}
                      </span>
                    </Button>
                  </label>
                </div>
                {themeHeroUrl ? (
                  <div className="rounded-lg border border-gray-200 p-2">
                    <img
                      src={themeHeroUrl}
                      alt="Hero preview"
                      className="h-32 w-full object-cover rounded"
                    />
                  </div>
                ) : null}
              </div>
            </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                <div className="font-semibold text-[#0F1C2E]">Background Theme</div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Background Mode</Label>
                    <Select
                      value={themeHeroMode}
                      onValueChange={(v) =>
                        setThemeHeroMode(v as "image" | "gradient" | "image-overlay" | "image-gradient-blend")
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gradient">Gradient only</SelectItem>
                        <SelectItem value="image">Image only</SelectItem>
                        <SelectItem value="image-overlay">Image + overlay</SelectItem>
                        <SelectItem value="image-gradient-blend">Image + gradient blend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Background Height (px)</Label>
                    <Input
                      type="number"
                      value={themeHeroHeight}
                      onChange={(e) => setThemeHeroHeight(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label>Image Position</Label>
                    <Select
                      value={themeHeroImagePosition}
                      onValueChange={setThemeHeroImagePosition}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select image position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center center">Center</SelectItem>
                        <SelectItem value="top center">Top Center</SelectItem>
                        <SelectItem value="bottom center">Bottom Center</SelectItem>
                        <SelectItem value="center left">Center Left</SelectItem>
                        <SelectItem value="center right">Center Right</SelectItem>
                        <SelectItem value="top left">Top Left</SelectItem>
                        <SelectItem value="top right">Top Right</SelectItem>
                        <SelectItem value="bottom left">Bottom Left</SelectItem>
                        <SelectItem value="bottom right">Bottom Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <Label>Overlay Color</Label>
                    <Input
                      type="color"
                      value={themeHeroOverlayColor}
                      onChange={(e) => setThemeHeroOverlayColor(e.target.value)}
                      disabled={loading}
                      className="h-12"
                    />
                  </div>

                  <div>
                    <Label>Overlay Opacity ({themeHeroOverlayOpacity}%)</Label>
                    <Input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={themeHeroOverlayOpacity}
                      onChange={(e) => setThemeHeroOverlayOpacity(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label>Image Size</Label>
                    <Select
                      value={themeHeroImageSize}
                      onValueChange={setThemeHeroImageSize}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cover">cover</SelectItem>
                        <SelectItem value="contain">contain</SelectItem>
                        <SelectItem value="auto">auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2 w-full">
                      <span className="text-sm">Glow</span>
                      <Switch
                        checked={themeHeroGlowEnabled}
                        onCheckedChange={setThemeHeroGlowEnabled}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Tagline</Label>
                <Input
                  value={themeTagline}
                  onChange={(e) => setThemeTagline(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Headline (Judul)</Label>
                <Input
                  value={themeHeadline}
                  onChange={(e) => setThemeHeadline(e.target.value)}
                  placeholder="Judul besar di undangan"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label>About (Deskripsi)</Label>
              <Textarea
                value={themeAbout}
                onChange={(e) => setThemeAbout(e.target.value)}
                disabled={loading}
                rows={4}
                placeholder="Deskripsi undangan..."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Host Name / Nama Penyelenggara</Label>
                <Input
                  value={themeHostName}
                  onChange={(e) => setThemeHostName(e.target.value)}
                  placeholder="Contoh: Panitia Wisuda SMA Pesat"
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Salam</Label>
                <Input
                  value={themeSalam}
                  onChange={(e) => setThemeSalam(e.target.value)}
                  placeholder="Contoh: Assalamualaikum Wr. Wb."
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Sapaan Tamu</Label>
                <Input
                  value={themeGuestGreeting}
                  onChange={(e) => setThemeGuestGreeting(e.target.value)}
                  placeholder="Contoh: Orang Tua/Wali Murid"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Dresscode Laki-laki</Label>
                <Input
                  value={themeDresscodeMale}
                  onChange={(e) => setThemeDresscodeMale(e.target.value)}
                  placeholder="Contoh: Kemeja batik / formal"
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Dresscode Perempuan</Label>
                <Input
                  value={themeDresscodeFemale}
                  onChange={(e) => setThemeDresscodeFemale(e.target.value)}
                  placeholder="Contoh: Busana sopan / formal"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label>Closing Text / Kalimat Penutup</Label>
              <Textarea
                value={themeClosingText}
                onChange={(e) => setThemeClosingText(e.target.value)}
                disabled={loading}
                rows={4}
                placeholder="Kalimat penutup undangan..."
              />
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#0F1C2E]">Agenda</div>
                  <div className="text-sm text-gray-600">
                    Susunan acara yang tampil di halaman undangan.
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={addAgenda}
                  disabled={loading}
                  className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {agendaItems.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Belum ada agenda. Klik <span className="font-semibold">Add</span>.
                  </div>
                ) : (
                  agendaItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-[#F5F7FA] p-4"
                    >
                      <div className="grid md:grid-cols-12 gap-3 items-start">
                        <div className="md:col-span-2">
                          <Label className="text-xs">Mulai</Label>
                          <Input
                            type="time"
                            value={it.start_time}
                            onChange={(e) => updateAgenda(idx, { start_time: e.target.value })}
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-xs">Selesai</Label>
                          <Input
                            type="time"
                            value={it.end_time}
                            onChange={(e) => updateAgenda(idx, { end_time: e.target.value })}
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-4">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={it.title}
                            onChange={(e) => updateAgenda(idx, { title: e.target.value })}
                            placeholder="Registrasi"
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-4">
                          <Label className="text-xs">Note (optional)</Label>
                          <Input
                            value={it.note ?? ""}
                            onChange={(e) => updateAgenda(idx, { note: e.target.value })}
                            placeholder="Keterangan kecil"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => upAgenda(idx)}
                          disabled={loading || idx === 0}
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => downAgenda(idx)}
                          disabled={loading || idx === agendaItems.length - 1}
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeAgenda(idx)}
                          disabled={loading}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#0F1C2E]">FAQ / Info</div>
                  <div className="text-sm text-gray-600">
                    Q&A / informasi penting di undangan.
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={addFaq}
                  disabled={loading}
                  className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {faqItems.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    Belum ada FAQ. Klik <span className="font-semibold">Add</span>.
                  </div>
                ) : (
                  faqItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-[#F5F7FA] p-4"
                    >
                      <div className="grid md:grid-cols-12 gap-3">
                        <div className="md:col-span-5">
                          <Label className="text-xs">Question</Label>
                          <Input
                            value={it.q}
                            onChange={(e) => updateFaq(idx, { q: e.target.value })}
                            placeholder="Dresscode?"
                            disabled={loading}
                          />
                        </div>
                        <div className="md:col-span-7">
                          <Label className="text-xs">Answer</Label>
                          <Input
                            value={it.a}
                            onChange={(e) => updateFaq(idx, { a: e.target.value })}
                            placeholder="Formal / Batik"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => upFaq(idx)}
                          disabled={loading || idx === 0}
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gray-300"
                          onClick={() => downFaq(idx)}
                          disabled={loading || idx === faqItems.length - 1}
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeFaq(idx)}
                          disabled={loading}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <QrCode className="w-5 h-5 text-[#D6C6A5]" />
              QR Code Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="qrFormat">QR Code Format</Label>
              <Select value={qrFormat} onValueChange={setQrFormat} disabled={loading}>
                <SelectTrigger id="qrFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QR Code v1">QR Code v1 (Standard)</SelectItem>
                  <SelectItem value="QR Code v2">QR Code v2 (Enhanced)</SelectItem>
                  <SelectItem value="QR Code v3">QR Code v3 (High Security)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-[#F5F7FA] rounded-lg">
              <h4 className="text-sm mb-2 text-[#0F1C2E]">QR Code Preview</h4>
              <div className="bg-white p-6 rounded-lg inline-block border-2 border-[#D6C6A5]">
                <div className="w-32 h-32 bg-gray-100 flex items-center justify-center rounded">
                  <QrCode className="w-12 h-12 text-[#D6C6A5]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Mail className="w-5 h-5 text-[#D6C6A5]" />
              Email Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#F5F7FA] rounded-lg">
              <div>
                <Label htmlFor="autoEmail" className="cursor-pointer">
                  Auto Send Email
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically send confirmation email to guests
                </p>
              </div>
              <Switch
                id="autoEmail"
                checked={autoEmail}
                onCheckedChange={setAutoEmail}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline" className="border-gray-300" disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            disabled={loading || saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}