import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Papa from "papaparse";
import {
  Search,
  Filter,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Mail,
  Send,
  ExternalLink,
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { generateGuestTicketPdf } from "../../lib/pdf/generateGuestTicketPdf";
import { toast } from "sonner";

type GuestStatus = "registered" | "confirmed" | "checked_in";

type GuestType = "regular" | "vip";

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
  photo_url: string | null;
  guest_type?: GuestType;
  status: GuestStatus;
  checkin_time: string | null;
  created_at: string;
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

function statusToUi(status: GuestRow["status"]) {
  if (status === "checked_in") return "checked-in";
  if (status === "confirmed") return "confirmed";
  return "registered";
}

function makeCode() {
  return (
    Math.random().toString(36).slice(2, 10).toUpperCase() +
    Date.now().toString().slice(-4)
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// normalize phone jadi E.164 sederhana: +62xxxxxxxx
function normalizePhone(countryCode: string, raw: string) {
  const ccDigits = countryCode.replace("+", "").trim(); // "62"
  let s = (raw ?? "").trim();
  if (!s) return null;

  s = s.replace(/[^\d+]/g, ""); // keep digits and +
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);

  if (s.startsWith("0")) return ccDigits + s.slice(1);
  if (s.startsWith(ccDigits)) return s;

  // Indo shortcut: 8xxx -> 628xxx
  if (ccDigits === "62" && s.startsWith("8")) return ccDigits + s;

  return ccDigits + s;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function buildGuestPhotoUrl(eventCode: string, uniqueCode: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/guest-photos/${eventCode}/${uniqueCode}.jpg`;
}

async function convertImageToJpg(file: File, quality = 0.82, maxSize = 1000): Promise<File> {
  const bitmap = await createImageBitmap(file);

  let targetWidth = bitmap.width;
  let targetHeight = bitmap.height;

  if (bitmap.width > bitmap.height) {
    if (bitmap.width > maxSize) {
      targetWidth = maxSize;
      targetHeight = Math.round((bitmap.height / bitmap.width) * maxSize);
    }
  } else {
    if (bitmap.height > maxSize) {
      targetHeight = maxSize;
      targetWidth = Math.round((bitmap.width / bitmap.height) * maxSize);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal convert ke JPG"))),
      "image/jpeg",
      quality
    );
  });

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export default function GuestListPage() {
  const [role, setRole] = useState<"owner" | "admin" | "scanner">("admin");
    useEffect(() => {
      (async () => {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle();

        setRole((data?.role ?? "scanner") as any);
      })();
    }, []);

  const { eventId } = useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [qrFormat, setQrFormat] = useState<string>("QR Code v1");
  const [downloadingAllPdf, setDownloadingAllPdf] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "checked-in" | "confirmed" | "registered"
  >("all");

  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof GuestRow;
    direction: "asc" | "desc";
  } | null>(null);

  const sortedGuests = useMemo(() => {
    // 👉 DEFAULT (belum klik header)
    if (!sortConfig) {
      return [...guests].sort((a, b) => {
        // PRIORITAS: checkin_time → created_at → id
        const dateA = new Date(a.checkin_time || 0).getTime();
        const dateB = new Date(b.checkin_time || 0).getTime();

        return dateB - dateA;
      });
    }

    // 👉 SORT BY HEADER
    const sorted = [...guests].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [guests, sortConfig]);

  const handleSort = (key: keyof GuestRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  function getSortableValue(guest: GuestRow, key: keyof GuestRow) {
    const value = guest[key];

    if (key === "created_at" || key === "checkin_time") {
      return value ? new Date(value as string).getTime() : 0;
    }

    if (typeof value === "string") {
      return value.toLowerCase();
    }

    return value ?? "";
  }

  const renderSortIcon = (key: keyof GuestRow) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="ml-1 inline h-4 w-4" />;
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-1 inline h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 inline h-4 w-4" />
    );
  };

  // Manual add
  const [adding, setAdding] = useState(false);
  const [newGuest, setNewGuest] = useState({
    identity_no: "",
    full_name: "",
    email: "",
    organization: "",
    dept_class: "",
    guest_type: "regular" as GuestType,
    status: "confirmed" as GuestStatus,
    phoneCountry: "+62",
    phoneRaw: "",
  });
  const [deletingAll, setDeletingAll] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<
      "one" | "all" | "confirm_all" | "unconfirm_all" | "delete_all_photos"
    >("one");
  const [targetGuest, setTargetGuest] = useState<GuestRow | null>(null);

  // Email sending state
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // Status update state
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingZip, setUploadingZip] = useState(false);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadGuestPhoto(file: File, guest: GuestRow) {
    if (!event?.event_code) {
      setErr("event_code belum ada di event ini.");
      return;
    }

    try {
      setErr(null);
      setUploadingPhotoId(guest.id);

      const jpgFile = await convertImageToJpg(file);
      const filePath = `${event.event_code}/${guest.unique_code}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("guest-photos")
        .upload(filePath, jpgFile, { upsert: true });

      if (uploadError) throw uploadError;

      const photoUrl = buildGuestPhotoUrl(event.event_code, guest.unique_code);

      const { error: dbError } = await supabase
        .from("guests")
        .update({ photo_url: photoUrl })
        .eq("id", guest.id);

      if (dbError) throw dbError;

      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id ? { ...g, photo_url: photoUrl } : g
        )
      );
    } catch (e: any) {
      setErr(e?.message ?? "Gagal upload foto.");
    } finally {
      setUploadingPhotoId(null);
    }
  }

  async function uploadGuestZip(file: File) {
    if (!event?.event_code) {
      setErr("event_code belum ada di event ini.");
      return;
    }

    try {
      setErr(null);
      setUploadingZip(true);
      toast.loading("Sedang upload ZIP foto...", { id: "zip-photo" });

      const zip = await JSZip.loadAsync(file);

      let success = 0;
      let failed = 0;
      let notMatched = 0;
      let skipped = 0;

      const guestMap = new Map(
        guests.map((g) => [String(g.unique_code).trim().toUpperCase(), g])
      );

      const entries = Object.keys(zip.files);

      for (const name of entries) {
        const entry = zip.files[name];
        if (entry.dir) continue;

        const base = name.split("/").pop() || "";
        if (!base) continue;

        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(base);
        if (!isImage) {
          skipped++;
          continue;
        }

        const code = base.replace(/\.[^.]+$/, "").trim().toUpperCase();
        const guest = guestMap.get(code);

        if (!guest) {
          notMatched++;
          continue;
        }

        try {
          const blob = await entry.async("blob");
          const originalFile = new File([blob], base, { type: blob.type || "image/*" });

          const jpgFile = await convertImageToJpg(originalFile);
          const filePath = `${event.event_code}/${guest.unique_code}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("guest-photos")
            .upload(filePath, jpgFile, { upsert: true });

          if (uploadError) throw uploadError;

          const photoUrl = buildGuestPhotoUrl(event.event_code, guest.unique_code);

          const { error: dbError } = await supabase
            .from("guests")
            .update({ photo_url: photoUrl })
            .eq("id", guest.id);

          if (dbError) throw dbError;

          success++;
        } catch {
          failed++;
        }
      }

      await loadGuests();

      toast.success(
        `ZIP selesai. Success: ${success}, Failed: ${failed}, Not matched: ${notMatched}, Skipped: ${skipped}`,
        { id: "zip-photo" }
      );
    } catch (e: any) {
      setErr(e?.message ?? "Gagal upload ZIP foto.");
      toast.error(e?.message ?? "Gagal upload ZIP foto.", { id: "zip-photo" });
    } finally {
      setUploadingZip(false);
    }
  }

  async function deleteGuestPhoto(guest: GuestRow) {
    if (!event?.event_code) {
      setErr("event_code belum ada di event ini.");
      return;
    }

    try {
      setErr(null);
      setUploadingPhotoId(guest.id);

      const filePath = `${event.event_code}/${guest.unique_code}.jpg`;

      await supabase.storage
        .from("guest-photos")
        .remove([filePath]);

      const { error: dbError } = await supabase
        .from("guests")
        .update({ photo_url: null })
        .eq("id", guest.id);

      if (dbError) throw dbError;

      setGuests((prev) =>
        prev.map((x) =>
          x.id === guest.id ? { ...x, photo_url: null } : x
        )
      );

      setPhotoDeleteOpen(false);
      setTargetPhotoGuest(null);
      toast.success("Foto berhasil dihapus.");
    } catch (e: any) {
      setErr(e?.message ?? "Gagal hapus foto.");
    } finally {
      setUploadingPhotoId(null);
    }
  }

  async function deleteAllGuestPhotos() {
    if (!event?.event_code) {
      setErr("event_code belum ada di event ini.");
      return;
    }

    const targets = guests.filter((g) => !!g.photo_url);

    if (targets.length === 0) {
      toast.info("Tidak ada foto yang perlu dihapus.");
      setConfirmOpen(false);
      return;
    }

    try {
      setErr(null);
      setUploadingZip(true);

      const paths = targets.map(
        (g) => `${event.event_code}/${g.unique_code}.jpg`
      );

      const { error: removeError } = await supabase.storage
        .from("guest-photos")
        .remove(paths);

      if (removeError) throw removeError;

      const { error: dbError } = await supabase
        .from("guests")
        .update({ photo_url: null })
        .eq("event_id", eventId)
        .not("photo_url", "is", null);

      if (dbError) throw dbError;

      setGuests((prev) => prev.map((g) => ({ ...g, photo_url: null })));

      setConfirmOpen(false);
      toast.success(`${targets.length} foto berhasil dihapus.`);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal hapus semua foto.");
    } finally {
      setUploadingZip(false);
    }
  }

  function openTicket(uniqueCode: string) {
    window.open(`/u/${encodeURIComponent(uniqueCode)}`, "_blank");
  }

  function onDeleteAll() {
    setConfirmMode("all");
    setTargetGuest(null);
    setConfirmOpen(true);
  }

  async function runConfirmedAction() {
    if (!eventId) return;

    setErr(null);

    try {
      if (confirmMode === "one") {
        if (!targetGuest) return;

        const { error } = await supabase.from("guests").delete().eq("id", targetGuest.id);
        if (error) throw error;

        setConfirmOpen(false);
        setTargetGuest(null);
        await loadGuests();
        return;
      }

      if (confirmMode === "all") {
        setDeletingAll(true);

        const { error } = await supabase.from("guests").delete().eq("event_id", eventId);
        if (error) throw error;

        setConfirmOpen(false);
        setTargetGuest(null);
        await loadGuests();
        return;
      }

      if (confirmMode === "confirm_all") {
        await confirmAllGuests();
        return;
      }

      if (confirmMode === "unconfirm_all") {
        await unconfirmAllGuests();
        return;
      }

      if (confirmMode === "delete_all_photos") {
        await deleteAllGuestPhotos();
        return;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Action failed");
    } finally {
      setDeletingAll(false);
    }
  }

  async function loadGuests(showLoading = true) {
    if (!eventId) {
      setGuests([]);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setGuests([]);
    } else {
      setGuests((data ?? []) as GuestRow[]);
    }

    if (showLoading) setLoading(false);
  }

  useEffect(() => {
    loadGuests(true);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`guest-list:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          await loadGuests(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function addGuestManual() {
    if (!eventId) return;

    const full_name = newGuest.full_name.trim();
    if (!full_name) {
      setErr("Nama wajib diisi.");
      return;
    }

    setAdding(true);
    setErr(null);

    try {
      const phone = normalizePhone(newGuest.phoneCountry, newGuest.phoneRaw);

      const payload: any = {
        event_id: eventId,
        identity_no: newGuest.identity_no.trim() || null,
        full_name,
        email: newGuest.email.trim() || null,
        phone,
        organization: newGuest.organization.trim() || null,
        dept_class: newGuest.dept_class.trim() || null,
        guest_type: newGuest.guest_type,
        status: newGuest.status,
        unique_code: makeCode(),
      };

      const { error } = await supabase.from("guests").insert(payload);
      if (error) throw error;

      setNewGuest({
        identity_no: "",
        full_name: "",
        email: "",
        organization: "",
        dept_class: "",
        status: "confirmed",
        guest_type: "regular",
        phoneCountry: "+62",
        phoneRaw: "",
      });

      await loadGuests();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal tambah guest.");
    } finally {
      setAdding(false);
    }
  }

  async function deleteGuest(g: GuestRow) {
    const ok = confirm(`Hapus guest: ${g.full_name} ?`);
    if (!ok) return;

    setErr(null);

    const { error } = await supabase.from("guests").delete().eq("id", g.id);
    if (error) {
      setErr(error.message);
      return;
    }

    await loadGuests();
  }

  async function importCsv(file: File) {
    if (!eventId) {
      alert("eventId tidak ada. Buka dari /admin/event/:eventId/guests");
      return;
    }

    setErr(null);
    setLoading(true);

    const parsed = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject,
      });
    });

    const rows = (parsed.data || []).map((r: any) => ({
      identity_no: String(r.identity_no ?? "").trim() || null,
      full_name: String(r.full_name ?? "").trim(),
      email: String(r.email ?? "").trim() || null,
      phone: String(r.phone ?? "").trim() || null,
      organization: String(r.organization ?? "").trim() || null,
      dept_class: String(r.dept_class ?? "").trim() || null,
      unique_code:
        String(r.unique_code ?? "").trim().toUpperCase() || makeCode(),
      status: (String(r.status ?? "registered").trim() as any) || "registered",
      guest_type: String(r.guest_type ?? "regular").trim().toLowerCase() === "vip"
        ? "vip"
        : "regular",
      photo_url: String(r.photo_url ?? "").trim() || null,
    }));

    const clean = rows.filter((r) => r.full_name);

    if (clean.length === 0) {
      setErr("CSV has no valid rows. Require column: full_name");
      setLoading(false);
      return;
    }

    const chunkSize = 200;
    for (let i = 0; i < clean.length; i += chunkSize) {
      const chunk = clean.slice(i, i + chunkSize).map((r) => ({
        event_id: eventId,
        ...r,
      }));

      const { error } = await supabase.from("guests").insert(chunk);
      if (error) {
        setErr(
          `Import failed rows ${i + 1}-${i + chunk.length}: ${error.message}`
        );
        setLoading(false);
        return;
      }
    }

    await loadGuests();
    setLoading(false);
  }

  const filteredGuests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return guests.filter((g) => {
      const uiStatus = statusToUi(g.status);

      const matchesSearch =
        (g.identity_no ?? "").toLowerCase().includes(q) ||
        (g.full_name ?? "").toLowerCase().includes(q) ||
        (g.organization ?? "").toLowerCase().includes(q) ||
        (g.unique_code ?? "").toLowerCase().includes(q) ||
        (g.guest_type ?? "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || uiStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [guests, searchQuery, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const sortedFilteredGuests = useMemo(() => {
    const list = [...filteredGuests];

    if (!sortConfig) {
      return list.sort((a, b) => {
        const dateA = new Date(a.checkin_time || 0).getTime();
        const dateB = new Date(b.checkin_time || 0).getTime();
        return dateB - dateA;
      });
    }

    return list.sort((a, b) => {
      const aVal = getSortableValue(a, sortConfig.key);
      const bVal = getSortableValue(b, sortConfig.key);

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredGuests, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));

  const paginatedGuests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedFilteredGuests.slice(start, start + pageSize);
  }, [sortedFilteredGuests, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const getStatusBadge = (uiStatus: string) => {
    switch (uiStatus) {
      case "checked-in":
        return (
          <Badge className="bg-[#22C55E] text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Checked In
          </Badge>
        );
      case "confirmed":
        return (
          <Badge className="bg-[#D6C6A5] text-[#0F1C2E]">
            <Clock className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-400 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            Registered
          </Badge>
        );
    }
  };

  const exportToCSV = () => {
    const headers = [
      "identity_no",
      "full_name",
      "email",
      "phone",
      "organization",
      "dept_class",
      "unique_code",
      "status",
      "guest_type",
      "checkin_time",
    ];

    const rows = filteredGuests.map((g) => [
      g.identity_no ?? "",
      g.full_name,
      g.email ?? "",
      g.phone ?? "",
      g.organization ?? "",
      g.dept_class ?? "",
      g.unique_code,
      g.status,
      g.guest_type ?? "",
      g.checkin_time ?? "",
    ]);

    const escapeCsv = (value: string) => {
      const s = String(value ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-list-${eventId ?? "event"}.csv`;
    a.click();
  };

  async function sendTicket(guest: GuestRow) {
    if (!guest.email) {
      alert("Guest ini belum punya email.");
      return;
    }

    try {
      setErr(null);
      setSendingId(guest.id);

      const { data, error } = await supabase.functions.invoke(
        "send_ticket_email",
        { body: { guestId: guest.id } }
      );

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      alert(`Ticket sent to: ${guest.email}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send ticket.");
    } finally {
      setSendingId(null);
    }
  }

  async function sendAllFiltered() {
    if (!eventId) {
      alert("eventId tidak ada. Buka dari /admin/event/:eventId/guests");
      return;
    }

    const list = filteredGuests.filter((g) => !!g.email);

    if (list.length === 0) {
      alert("Tidak ada guest (filtered) yang punya email.");
      return;
    }

    const ok = confirm(
      `Kirim ticket ke ${list.length} guest (sesuai filter + search sekarang)?`
    );
    if (!ok) return;

    setBulkSending(true);
    setBulkProgress({
      total: filteredGuests.length,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    setErr(null);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const g of filteredGuests) {
      if (!g.email) {
        skipped++;
        setBulkProgress({ total: filteredGuests.length, sent, skipped, failed });
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "send_ticket_email",
          { body: { guestId: g.id } }
        );

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        sent++;
      } catch {
        failed++;
      }

      setBulkProgress({ total: filteredGuests.length, sent, skipped, failed });
      await sleep(350);
    }

    setBulkSending(false);
    alert(`Done.\nSent: ${sent}\nSkipped (no email): ${skipped}\nFailed: ${failed}`);
  }

  async function loadEventMeta() {
    if (!eventId) return;

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,name,slug,event_date,location,status,theme,event_code")
      .eq("id", eventId)
      .single();

    if (evErr) throw evErr;
    setEvent(ev as EventRow);

    const { data: st } = await supabase
      .from("event_settings")
      .select("event_id,qr_format")
      .eq("event_id", eventId)
      .maybeSingle();

    setQrFormat((st as any)?.qr_format ?? "QR Code v1");
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadGuests(), loadEventMeta()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function buildQrPayloadForGuest(guest: GuestRow) {
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

  async function downloadAllPdf() {
    if (!eventId || !event) return;

    try {
      setErr(null);
      setDownloadingAllPdf(true);
      toast.loading("Sedang menyiapkan ZIP e-ticket...", { id: "zip-pdf" });

      const confirmedGuests = filteredGuests.filter(
        (g) => g.status === "confirmed" || g.status === "checked_in"
      );

      if (confirmedGuests.length === 0) {
        toast.error("Tidak ada guest yang sudah konfirmasi untuk didownload.", {
          id: "zip-pdf",
        });
        return;
      }

      const zip = new JSZip();

      for (const guest of confirmedGuests) {
        const pdfBlob = await generateGuestTicketPdf({
          guest,
          event,
          buildQrPayload: () => buildQrPayloadForGuest(guest),
          autoDownload: false,
        });

        if (pdfBlob) {
          zip.file(`e-ticket-${guest.unique_code}-${guest.full_name.replace(/\s/g, '-')}.pdf`, pdfBlob);
        }

        await sleep(120);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      saveAs(
        zipBlob,
        `e-ticket-${event.event_code ?? event.name ?? "event"}-${confirmedGuests.length}.zip`
      );

      toast.success(`ZIP berhasil dibuat (${confirmedGuests.length} file).`, {
        id: "zip-pdf",
      });
    } catch (e: any) {
      setErr(e?.message ?? "Gagal download PDF all");
      toast.error(e?.message ?? "Gagal download PDF all", {
        id: "zip-pdf",
      });
    } finally {
      setDownloadingAllPdf(false);
    }
  }

  async function confirmAllGuests() {
    if (!eventId) return;

    const targetGuests = guests.filter((g) => g.status === "registered");

    if (targetGuests.length === 0) {
      setErr(null);
      setConfirmOpen(false);
      alert("Tidak ada guest yang perlu dikonfirmasi.");
      return;
    }

    try {
      setErr(null);
      setConfirmingAll(true);

      const { error } = await supabase
        .from("guests")
        .update({ status: "confirmed" })
        .in(
          "id",
          targetGuests.map((g) => g.id)
        );

      if (error) throw error;

      setConfirmOpen(false);
      await loadGuests();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal confirm all");
    } finally {
      setConfirmingAll(false);
    }
  }

  async function unconfirmAllGuests() {
    if (!eventId) return;

    const targetGuests = guests.filter((g) => g.status === "confirmed");

    if (targetGuests.length === 0) {
      setErr(null);
      setConfirmOpen(false);
      alert("Tidak ada guest confirmed yang perlu dikembalikan ke registered.");
      return;
    }

    try {
      setErr(null);
      setConfirmingAll(true);

      const { error } = await supabase
        .from("guests")
        .update({ status: "registered" })
        .in(
          "id",
          targetGuests.map((g) => g.id)
        );

      if (error) throw error;

      setConfirmOpen(false);
      await loadGuests();
    } catch (e: any) {
      setErr(e?.message ?? "Gagal unconfirm all");
    } finally {
      setConfirmingAll(false);
    }
  }

  const total = guests.length;
  const checkedIn = guests.filter((g) => g.status === "checked_in").length;
  const confirmed = guests.filter((g) => g.status === "confirmed").length;
  const registered = guests.filter((g) => g.status === "registered").length;

  const hasRegisteredGuests = guests.some((g) => g.status === "registered");
  const hasConfirmedGuests = guests.some((g) => g.status === "confirmed");

  const [photoDeleteOpen, setPhotoDeleteOpen] = useState(false);
  const [targetPhotoGuest, setTargetPhotoGuest] = useState<GuestRow | null>(null);

  const guestsWithPhoto = guests.filter((g) => !!g.photo_url);
  const hasAnyPhoto = guestsWithPhoto.length > 0;

  const bulkConfirmAction =
    hasRegisteredGuests ? "confirm_all" : hasConfirmedGuests ? "unconfirm_all" : null;

  const bulkConfirmLabel =
    bulkConfirmAction === "confirm_all"
      ? "Confirm"
      : bulkConfirmAction === "unconfirm_all"
      ? "Unconfirm"
      : "Confirm";

  const filteredHasEmailCount = useMemo(
    () => filteredGuests.filter((g) => !!g.email).length,
    [filteredGuests]
  );

  if (!eventId) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-white p-4 text-sm text-gray-700">
          <b>eventId tidak ada.</b> Buka halaman ini lewat:
          <div className="mt-2 font-mono text-xs bg-gray-100 p-2 rounded">
            /admin/event/:eventId/guests
          </div>
        </div>
      </div>
    );
  }

  function nextStatus(s: GuestStatus): GuestStatus {
  // registered -> confirmed -> checked_in -> registered
  if (s === "registered") return "confirmed";
  if (s === "confirmed") return "checked_in";
  return "registered";
}

  async function cycleGuestStatus(g: GuestRow) {
    setErr(null);
    setUpdatingStatusId(g.id);

    const next = nextStatus(g.status);

    // aturan checkin_time:
    // - kalau jadi checked_in: set now
    // - kalau keluar dari checked_in: kosongkan
    const nextCheckinTime =
      next === "checked_in"
        ? new Date().toISOString()
        : g.status === "checked_in"
          ? null
          : g.checkin_time;

    try {
      const { data, error } = await supabase
        .from("guests")
        .update({ status: next, checkin_time: nextCheckinTime })
        .eq("id", g.id)
        .select("*")
        .single();

      if (error) throw error;

      // update local state (biar gak perlu reload)
      setGuests((prev) => prev.map((x) => (x.id === g.id ? (data as GuestRow) : x)));
    } catch (e: any) {
      setErr(e?.message ?? "Gagal update status");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <div className="overflow-hidden">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl text-[#0F1C2E] mb-1">Guest List</h1>
          <p className="text-gray-600">
            Manage and track all event attendees
          </p>
        </div>

        <div className="flex gap-1 flex-wrap">
          <Button
            onClick={() => loadGuests(true)}
            variant="outline"
            className="border-[#0F1C2E]/20"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {role === "owner" && (
            <Button
              onClick={exportToCSV}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
              disabled={loading || guests.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}

          <label className="inline-flex items-center">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              disabled={loading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await importCsv(f);
                e.currentTarget.value = "";
              }}
            />

            <Button
              type="button"
              variant="outline"
              className="border-[#0F1C2E]/20"
              disabled={loading}
              onClick={() => importFileRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </label>

          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await uploadGuestZip(file);
              e.currentTarget.value = "";
            }}
          />

          <Button
            type="button"
            variant="outline"
            className={
              hasAnyPhoto
                ? "border-red-200 text-red-700 hover:bg-red-50"
                : "border-[#0F1C2E]/20"
            }
            disabled={loading || uploadingZip || !event?.event_code || guests.length === 0}
            onClick={() => {
              if (hasAnyPhoto) {
                setConfirmMode("delete_all_photos" as any);
                setTargetGuest(null);
                setConfirmOpen(true);
              } else {
                zipInputRef.current?.click();
              }
            }}
            title={
              !event?.event_code
                ? "event_code belum ada"
                : hasAnyPhoto
                ? `Hapus ${guestsWithPhoto.length} foto`
                : "Upload photos"
            }
          >
            {hasAnyPhoto ? (
              <Trash2 className="w-4 h-4 mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}

            {hasAnyPhoto ? `Delete Photos (${guestsWithPhoto.length})` : uploadingZip ? "Uploading..." : "Upload Photos"}
          </Button>

          <Button
            onClick={sendAllFiltered}
            variant="outline"
            className="border-[#0F1C2E]/20"
            disabled={loading || bulkSending || filteredHasEmailCount === 0}
            title={
              filteredHasEmailCount === 0
                ? "Tidak ada guest filtered yang punya email"
                : `Send to ${filteredHasEmailCount} emails`
            }
          >
            <Send className="w-4 h-4 mr-2" />
            {bulkSending ? "Sending..." : "Send (Filter)"}
          </Button>

          {role === "owner" && (
            <Button
              onClick={() => {
                if (!bulkConfirmAction) return;
                setConfirmMode(bulkConfirmAction);
                setTargetGuest(null);
                setConfirmOpen(true);
              }}
              className="bg-[#0F1C2E] text-white hover:bg-[#0F1C2E]/90"
              disabled={loading || confirmingAll || !bulkConfirmAction}
            >
              <Check className="w-4 h-4 mr-2" />
              {confirmingAll
                ? bulkConfirmAction === "confirm_all"
                  ? "Confirming..."
                  : "Unconfirming..."
                : bulkConfirmLabel}
            </Button>
          )}

          {role === "owner" && (
            <Button
              onClick={downloadAllPdf}
              className="bg-[#D6C6A5] text-[#0F1C2E] hover:opacity-90"
              disabled={loading || downloadingAllPdf || !event || guests.filter((g) => g.status === "confirmed" || g.status === "checked_in").length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              {downloadingAllPdf ? "Preparing ZIP..." : "Download Ticket"}
            </Button>
          )}

          {role === "owner" && (
            <Button
              onClick={onDeleteAll}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={loading || deletingAll || guests.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deletingAll ? "Deleting..." : "Delete All"}
            </Button>
          )}
        </div>
      </div>

      {bulkProgress && (
        <div className="mb-4 rounded-md border bg-white p-3 text-sm text-gray-700">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="font-medium">
              Email progress:{" "}
              {bulkProgress.sent + bulkProgress.skipped + bulkProgress.failed}/
              {bulkProgress.total}
            </div>
            <div className="text-xs text-gray-500">
              Sent: <b>{bulkProgress.sent}</b> • Skipped: <b>{bulkProgress.skipped}</b> • Failed:{" "}
              <b>{bulkProgress.failed}</b>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmMode === "delete_all_photos"
                ? "Delete all guest photos?"
                : confirmMode === "all"
                ? "Delete all guests?"
                : confirmMode === "confirm_all"
                ? "Confirm all guests?"
                : confirmMode === "unconfirm_all"
                ? "Unconfirm all guests?"
                : "Delete guest?"}
            </DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-600">
            {confirmMode === "delete_all_photos" ? (
              <>
                Ini akan menghapus <b>{guestsWithPhoto.length}</b> foto guest dari
                Storage dan mengosongkan kolom <b>photo_url</b> di database.
                Aksi ini tidak bisa dibatalkan.
              </>
            ) : confirmMode === "all" ? (
              <>
                Ini akan menghapus <b>SEMUA</b> guest untuk event ini. Aksi ini tidak
                bisa dibatalkan.
              </>
            ) : confirmMode === "confirm_all" ? (
              <>
                Ini akan mengubah semua guest dengan status <b>registered</b> menjadi{" "}
                <b>confirmed</b>. Guest yang sudah <b>confirmed</b> atau{" "}
                <b>checked_in</b> tidak akan berubah.
              </>
            ) : confirmMode === "unconfirm_all" ? (
              <>
                Ini akan mengubah semua guest dengan status <b>confirmed</b> menjadi{" "}
                <b>registered</b>. Guest yang sudah <b>checked_in</b> tidak akan
                berubah.
              </>
            ) : (
              <>
                Hapus guest: <b>{targetGuest?.full_name}</b>? Aksi ini tidak bisa
                dibatalkan.
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>

            <Button
              className={
                confirmMode === "confirm_all" || confirmMode === "unconfirm_all"
                  ? "bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
              onClick={runConfirmedAction}
              disabled={deletingAll || confirmingAll || uploadingZip}
            >
              {confirmMode === "delete_all_photos"
                ? uploadingZip
                  ? "Deleting Photos..."
                  : `Delete Photos (${guestsWithPhoto.length})`
                : confirmMode === "confirm_all"
                ? confirmingAll
                  ? "Confirming..."
                  : "Confirm All"
                : confirmMode === "unconfirm_all"
                ? confirmingAll
                  ? "Unconfirming..."
                  : "Unconfirm All"
                : deletingAll
                ? "Deleting..."
                : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={photoDeleteOpen} onOpenChange={setPhotoDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus foto?</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-600">
            Foto milik <b>{targetPhotoGuest?.full_name}</b> akan dihapus dari Storage
            dan database.
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPhotoDeleteOpen(false)}>
              Batal
            </Button>

            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!targetPhotoGuest || uploadingPhotoId === targetPhotoGuest?.id}
              onClick={() => targetPhotoGuest && deleteGuestPhoto(targetPhotoGuest)}
            >
              {uploadingPhotoId === targetPhotoGuest?.id ? "Menghapus..." : "Hapus Foto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Manual Add */}
      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#0F1C2E]">Add Guest (Manual)</h2>
            <Button
              onClick={addGuestManual}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
              disabled={adding || loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              {adding ? "Adding..." : "Add Guest"}
            </Button>
          </div>

          <div className="space-y-3">

            {/* ROW 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="No Identity"
                value={newGuest.identity_no}
                onChange={(e) =>
                  setNewGuest((p) => ({ ...p, identity_no: e.target.value }))
                }
              />

              <Input
                placeholder="Full name *"
                value={newGuest.full_name}
                onChange={(e) =>
                  setNewGuest((p) => ({ ...p, full_name: e.target.value }))
                }
              />

              <Input
                placeholder="Email"
                value={newGuest.email}
                onChange={(e) =>
                  setNewGuest((p) => ({ ...p, email: e.target.value }))
                }
              />

              {/* Phone */}
              <div className="flex gap-2">
                <Select
                  value={newGuest.phoneCountry}
                  onValueChange={(v) =>
                    setNewGuest((p) => ({ ...p, phoneCountry: v }))
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+62">🇮🇩 +62</SelectItem>
                    <SelectItem value="+60">🇲🇾 +60</SelectItem>
                    <SelectItem value="+65">🇸🇬 +65</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="8231200xxxx"
                  value={newGuest.phoneRaw}
                  onChange={(e) =>
                    setNewGuest((p) => ({ ...p, phoneRaw: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* ROW 2 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Organization"
                value={newGuest.organization}
                onChange={(e) =>
                  setNewGuest((p) => ({ ...p, organization: e.target.value }))
                }
              />

              <Input
                placeholder="Dept / Class"
                value={newGuest.dept_class}
                onChange={(e) =>
                  setNewGuest((p) => ({ ...p, dept_class: e.target.value }))
                }
              />

              <Select
                value={newGuest.status}
                onValueChange={(v) =>
                  setNewGuest((p) => ({ ...p, status: v as GuestStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={newGuest.guest_type}
                onValueChange={(v) =>
                  setNewGuest((p) => ({ ...p, guest_type: v as GuestType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Guest Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <p className="text-xs text-gray-500 mt-3">
            Nomor akan disimpan dalam format <span className="font-mono">628231200XXXX</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Total Guests</p>
            <p className="text-2xl text-[#0F1C2E]">{loading ? "—" : total}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Checked In</p>
            <p className="text-2xl text-[#22C55E]">{loading ? "—" : checkedIn}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Confirmed</p>
            <p className="text-2xl text-[#D6C6A5]">{loading ? "—" : confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Registered</p>
            <p className="text-2xl text-gray-400">{loading ? "—" : registered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by identity number, name, organization, or code..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as any)}
              >
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked-in">Checked In</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-gray-500 flex items-center">
              <Mail className="w-4 h-4 mr-1" />
              Filtered with email: <b className="ml-1">{filteredHasEmailCount}</b>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Table */}
      <Card className="border-none shadow-lg">
        <CardContent className="mt-5 flex-1 overflow-y-auto pr-1 space-y-3">
          <div className="w-full overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead
                    onClick={() => handleSort("identity_no")}
                    className="w-[110px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    No Identity {renderSortIcon("identity_no")}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort("full_name")}
                    className="w-[150px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Name {renderSortIcon("full_name")}
                  </TableHead>
                  <TableHead className="w-[90px] text-[#0F1C2E]">Email</TableHead>
                  <TableHead className="w-[100px] text-[#0F1C2E]">Phone</TableHead>
                  <TableHead className="w-[140px] text-[#0F1C2E]">Organization</TableHead>
                  <TableHead
                    onClick={() => handleSort("dept_class")}
                    className="w-[110px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Dept/Class {renderSortIcon("dept_class")}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort("unique_code")}
                    className="w-[130px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Unique Code {renderSortIcon("unique_code")}
                  </TableHead>
                  <TableHead className="w-[70px] text-center text-[#0F1C2E]">Photo</TableHead>
                  <TableHead
                    onClick={() => handleSort("status")}
                    className="w-[120px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Status {renderSortIcon("status")}
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("guest_type")}
                    className="w-[90px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Type {renderSortIcon("guest_type")}
                  </TableHead>

                  <TableHead
                    onClick={() => handleSort("checkin_time")}
                    className="w-[120px] cursor-pointer select-none text-[#0F1C2E]"
                  >
                    Check-in {renderSortIcon("checkin_time")}
                  </TableHead>
                  <TableHead className="w-[150px] text-center text-[#0F1C2E]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      Loading guests...
                    </TableCell>
                  </TableRow>
                ) : filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No guests found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGuests.map((g) => {
                    const uiStatus = statusToUi(g.status);
                    const hasEmail = !!g.email;

                    return (
                      <TableRow key={g.id} className="hover:bg-[#F5F7FA]/50">
                        <TableCell className="font-medium text-[#0F1C2E] truncate">{g.identity_no ?? "—"}</TableCell>
                        <TableCell className="font-medium text-[#0F1C2E] truncate">
                          {g.full_name}
                        </TableCell>
                        <TableCell className="text-gray-600 truncate">{g.email ?? "—"}</TableCell>
                        <TableCell className="text-gray-600 truncate">{g.phone ?? "—"}</TableCell>
                        <TableCell className="text-gray-600 truncate">{g.organization ?? "—"}</TableCell>
                        <TableCell className="text-gray-600 truncate">{g.dept_class ?? "—"}</TableCell>
                        <TableCell>
                          <code className="block truncate bg-gray-100 px-2 py-1 rounded text-sm">
                            {g.unique_code}
                          </code>
                        </TableCell>

                        <TableCell className="text-center">
                          <input
                            ref={(el) => {
                              photoInputRefs.current[g.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await uploadGuestPhoto(file, g);
                              setTimeout(() => {
                                if (e.target) (e.target as HTMLInputElement).value = "";
                              }, 0);
                            }}
                          />

                          {uploadingPhotoId === g.id ? (
                            <div className="inline-flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                            </div>
                              ) : g.photo_url ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="group border-green-200 hover:border-red-200 hover:bg-red-50"
                                  title="Klik untuk hapus foto"
                                  disabled={uploadingPhotoId === g.id}
                                  onClick={() => {
                                    setTargetPhotoGuest(g);
                                    setPhotoDeleteOpen(true);
                                  }}
                                >
                                  {uploadingPhotoId === g.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-5 h-5 text-green-600 group-hover:hidden" />
                                      <X className="w-5 h-5 text-red-600 hidden group-hover:block" />
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#0F1C2E]/20"
                                  title="Upload foto"
                                  onClick={() => photoInputRefs.current[g.id]?.click()}
                                >
                                  <Upload className="w-4 h-4 text-[#0F1C2E]" />
                                </Button>
                              )}
                        </TableCell>

                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 hover:opacity-55 active:scale-[0.99] transition"
                            onClick={() => cycleGuestStatus(g)}
                            disabled={updatingStatusId === g.id}
                            title="Klik untuk ubah status: Registered → Confirmed → Checked In"
                          >
                            {getStatusBadge(uiStatus)}
                            {updatingStatusId === g.id ? (
                              <span className="text-xs text-gray-500">Updating...</span>
                            ) : null}
                          </button>
                        </TableCell>

                        <TableCell>
                          {g.guest_type === "vip" ? (
                            <Badge className="bg-amber-400 text-black">VIP</Badge>
                          ) : (
                            <Badge className="bg-slate-200 text-slate-800">Regular</Badge>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-gray-600">
                          {g.checkin_time
                            ? new Date(g.checkin_time).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#0F1C2E]/20"
                              onClick={() => openTicket(g.unique_code)}
                              title="Open digital ticket"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#0F1C2E]/20 px-2"
                              disabled={!hasEmail || sendingId === g.id || bulkSending}
                              onClick={() => sendTicket(g)}
                              title={!hasEmail ? "Guest belum ada email" : "Send ticket email"}
                            >
                              {sendingId === g.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setConfirmMode("one");
                                setTargetGuest(g);
                                setConfirmOpen(true);
                              }}
                              title="Delete guest"
                            >
                              <X className="w-4 h-4 mr-2" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!loading && (
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-gray-600">
          <div>
            Showing{" "}
            <b>{filteredGuests.length === 0 ? 0 : (page - 1) * pageSize + 1}</b>
            {" "}to{" "}
            <b>{Math.min(page * pageSize, filteredGuests.length)}</b>
            {" "}of <b>{filteredGuests.length}</b> guests
          </div>

          <div className="flex items-center gap-2">
            <span>Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[90px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>

            <span>
              Page <b>{page}</b> / <b>{totalPages}</b>
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}