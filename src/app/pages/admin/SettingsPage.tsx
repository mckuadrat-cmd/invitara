import { useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  Save,
  Mail,
  Calendar,
  MapPin,
  QrCode,
  Palette,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
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

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
  theme: any; // jsonb
};

type EventSettingsRow = {
  event_id: string;
  qr_format: string;
  auto_email: boolean;
  allow_reentry: boolean;
  vip_badge_color: string;
};

type AgendaItem = {
  time: string;
  title: string;
  note?: string;
};

type FaqItem = {
  q: string;
  a: string;
};

export default function SettingsPage() {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(""); // datetime-local string
  const [location, setLocation] = useState("");

  const [qrFormat, setQrFormat] = useState("QR Code v1");
  const [autoEmail, setAutoEmail] = useState(false);
  const [allowReentry, setAllowReentry] = useState(false);
  const [vipBadgeColor, setVipBadgeColor] = useState("#D6C6A5");

  // Invitation Theme (events.theme)
  const [themePrimary, setThemePrimary] = useState("#0F1C2E");
  const [themeAccent, setThemeAccent] = useState("#D6C6A5");
  const [themeLogoUrl, setThemeLogoUrl] = useState("/Invitara.png");
  const [themeHeroUrl, setThemeHeroUrl] = useState("");
  const [themeTagline, setThemeTagline] = useState("PELEPASAN & APRESIASI");
  const [themeHeadline, setThemeHeadline] = useState("");
  const [themeAbout, setThemeAbout] = useState("");
  const [themeDresscode, setThemeDresscode] = useState("Formal / Batik");

  // Builder arrays (no JSON)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);

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
    setEventName(e.name ?? "");
    setLocation(e.location ?? "");

    // ISO -> datetime-local (YYYY-MM-DDTHH:mm)
    if (e.event_date) {
      const d = new Date(e.event_date);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setEventDate(local);
    } else {
      setEventDate("");
    }

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

    // Theme
    const t = (e as any).theme ?? {};
    const brand = t.brand ?? t ?? {};

    setThemePrimary(brand.primary ?? "#0F1C2E");
    setThemeAccent(brand.accent ?? "#D6C6A5");
    setThemeLogoUrl(brand.logoUrl ?? "/Invitara.png");
    setThemeHeroUrl(brand.heroImageUrl ?? "");

    setThemeTagline(t.tagline ?? "PELEPASAN & APRESIASI");
    setThemeHeadline(t.headline ?? e.name ?? "");
    setThemeAbout(
      t.about ??
        "Dengan hormat, kami mengundang Bapak/Ibu untuk menghadiri acara ini."
    );
    setThemeDresscode(t.dresscode ?? "Formal / Batik");

    setAgendaItems(Array.isArray(t.agenda) ? t.agenda : []);
    setFaqItems(Array.isArray(t.faqs) ? t.faqs : []);

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
      const isoDate = eventDate ? new Date(eventDate).toISOString() : null;

      const themeToSave = {
        brand: {
          primary: themePrimary,
          accent: themeAccent,
          logoUrl: themeLogoUrl,
          heroImageUrl: themeHeroUrl || null,
        },
        tagline: themeTagline,
        headline: themeHeadline || eventName,
        about: themeAbout,
        dresscode: themeDresscode,
        agenda: agendaItems,
        faqs: faqItems,
      };

      const upEv = await supabase
        .from("events")
        .update({
          name: eventName,
          event_date: isoDate,
          location: location,
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

      toast.success("Settings saved successfully!");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Builder helpers ----------
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
    setAgendaItems((prev) => [...prev, { time: "", title: "", note: "" }]);
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
  // -----------------------------------

  if (!eventId) return <div className="p-4">Missing eventId in route.</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl text-[#0F1C2E] mb-2">Event Settings</h1>
        <p className="text-gray-600">Configure details & preferences (per event)</p>
      </div>

      <div className="space-y-6">
        {/* Event info */}
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

            <div>
              <Label htmlFor="eventDate">Event Date & Time</Label>
              <Input
                id="eventDate"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter event location"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invitation Theme */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Palette className="w-5 h-5 text-[#D6C6A5]" />
              Invitation Theme (Public Page)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Primary Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={themePrimary}
                    onChange={(e) => setThemePrimary(e.target.value)}
                    disabled={loading}
                    className="h-12 w-20 cursor-pointer p-1"
                  />
                  <div className="text-xs text-gray-600 font-mono">{themePrimary}</div>
                </div>
              </div>

              <div>
                <Label>Accent Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={themeAccent}
                    onChange={(e) => setThemeAccent(e.target.value)}
                    disabled={loading}
                    className="h-12 w-20 cursor-pointer p-1"
                  />
                  <div className="text-xs text-gray-600 font-mono">{themeAccent}</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Logo URL</Label>
                <Input
                  value={themeLogoUrl}
                  onChange={(e) => setThemeLogoUrl(e.target.value)}
                  placeholder="/Invitara.png atau https://..."
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Hero Image URL</Label>
                <Input
                  value={themeHeroUrl}
                  onChange={(e) => setThemeHeroUrl(e.target.value)}
                  placeholder="https://... (opsional)"
                  disabled={loading}
                />
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

            <div>
              <Label>Dresscode</Label>
              <Input
                value={themeDresscode}
                onChange={(e) => setThemeDresscode(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Agenda Builder */}
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
                          <Label className="text-xs">Time</Label>
                          <Input
                            value={it.time}
                            onChange={(e) => updateAgenda(idx, { time: e.target.value })}
                            placeholder="07.00"
                            disabled={loading}
                          />
                        </div>

                        <div className="md:col-span-6">
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

            {/* FAQ Builder */}
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

            {/* Quick Preview */}
            <div className="p-4 rounded-xl border border-gray-200 bg-[#F5F7FA]">
              <div className="text-sm text-[#0F1C2E] font-medium mb-2">Preview</div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  style={{ backgroundColor: themeAccent, color: "#0B1220" }}
                >
                  RSVP / Ambil Ticket
                </Button>
                <div
                  className="h-10 flex-1 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${themePrimary}, ${themeAccent}33)`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR settings */}
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

        {/* Email settings */}
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

        {/* (Optional) Badge/Access settings — kalau mau diaktifin tinggal uncomment di bawah */}
        {/* 
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0F1C2E]">
              <Palette className="w-5 h-5 text-[#D6C6A5]" />
              Badge & Access Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#F5F7FA] rounded-lg">
              <div>
                <Label htmlFor="allowReentry" className="cursor-pointer">
                  Allow Re-entry
                </Label>
                <p className="text-sm text-gray-600 mt-1">
                  Guests can check in multiple times
                </p>
              </div>
              <Switch
                id="allowReentry"
                checked={allowReentry}
                onCheckedChange={setAllowReentry}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="vipBadge">VIP Badge Color</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="vipBadge"
                  type="color"
                  value={vipBadgeColor}
                  onChange={(e) => setVipBadgeColor(e.target.value)}
                  className="w-20 h-12 cursor-pointer"
                  disabled={loading}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Current color: <span className="font-mono">{vipBadgeColor}</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        */}

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