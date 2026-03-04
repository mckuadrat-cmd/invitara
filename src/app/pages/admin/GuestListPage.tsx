import { useEffect, useMemo, useState } from "react";
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

type GuestStatus = "registered" | "confirmed" | "checked_in";

type GuestRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  unique_code: string;
  status: GuestStatus;
  checkin_time: string | null;
  created_at: string;
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

export default function GuestListPage() {
  const { eventId } = useParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "checked-in" | "confirmed" | "registered"
  >("all");

  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Manual add
  const [adding, setAdding] = useState(false);
  const [newGuest, setNewGuest] = useState({
    full_name: "",
    email: "",
    organization: "",
    status: "confirmed" as GuestStatus,
    phoneCountry: "+62",
    phoneRaw: "",
  });
  const [deletingAll, setDeletingAll] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"one" | "all">("one");
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

  function openTicket(uniqueCode: string) {
    window.open(`/ticket/${encodeURIComponent(uniqueCode)}`, "_blank");
  }

  function onDeleteAll() {
    setConfirmMode("all");
    setTargetGuest(null);
    setConfirmOpen(true);
  }

  async function runDeleteConfirmed() {
    if (!eventId) return;

    setErr(null);

    try {
      if (confirmMode === "one") {
        if (!targetGuest) return;
        const { error } = await supabase.from("guests").delete().eq("id", targetGuest.id);
        if (error) throw error;
      } else {
        setDeletingAll(true);
        const { error } = await supabase.from("guests").delete().eq("event_id", eventId);
        if (error) throw error;
      }

      setConfirmOpen(false);
      setTargetGuest(null);
      await loadGuests();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setDeletingAll(false);
    }
  }

  async function loadGuests() {
    if (!eventId) {
      setGuests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
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
    setLoading(false);
  }

  useEffect(() => {
    loadGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        full_name,
        email: newGuest.email.trim() || null,
        phone,
        organization: newGuest.organization.trim() || null,
        status: newGuest.status,
        // kalau DB lo sudah auto-generate unique_code via trigger, HAPUS ini.
        unique_code: makeCode(),
      };

      const { error } = await supabase.from("guests").insert(payload);
      if (error) throw error;

      setNewGuest({
        full_name: "",
        email: "",
        organization: "",
        status: "confirmed",
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
      full_name: String(r.full_name ?? "").trim(),
      email: String(r.email ?? "").trim() || null,
      phone: String(r.phone ?? "").trim() || null,
      organization: String(r.organization ?? "").trim() || null,
      unique_code:
        String(r.unique_code ?? "").trim().toUpperCase() || makeCode(),
      status: (String(r.status ?? "confirmed").trim() as any) || "confirmed",
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
        (g.full_name ?? "").toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.organization ?? "").toLowerCase().includes(q) ||
        (g.unique_code ?? "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || uiStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [guests, searchQuery, statusFilter]);

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
      "full_name",
      "email",
      "phone",
      "organization",
      "unique_code",
      "status",
      "checkin_time",
    ];

    const rows = filteredGuests.map((g) => [
      g.full_name,
      g.email ?? "",
      g.phone ?? "",
      g.organization ?? "",
      g.unique_code,
      g.status,
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

  const total = guests.length;
  const checkedIn = guests.filter((g) => g.status === "checked_in").length;
  const confirmed = guests.filter((g) => g.status === "confirmed").length;
  const registered = guests.filter((g) => g.status === "registered").length;

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

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={loadGuests}
            variant="outline"
            className="border-[#0F1C2E]/20"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={exportToCSV}
            className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            disabled={loading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>

          <label className="inline-flex items-center">
            <input
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
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          </label>

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
            {bulkSending ? "Sending..." : "Send All (Filtered)"}
          </Button>

          <Button
            onClick={onDeleteAll}
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            disabled={loading || deletingAll}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deletingAll ? "Deleting..." : "Delete All"}
          </Button>
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
              {confirmMode === "all" ? "Delete all guests?" : "Delete guest?"}
            </DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-600">
            {confirmMode === "all" ? (
              <>
                Ini akan menghapus <b>SEMUA</b> guest untuk event ini. Aksi ini tidak bisa dibatalkan.
              </>
            ) : (
              <>
                Hapus guest: <b>{targetGuest?.full_name}</b>? Aksi ini tidak bisa dibatalkan.
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={runDeleteConfirmed}
              disabled={deletingAll}
            >
              Delete
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="Full name *"
              value={newGuest.full_name}
              onChange={(e) => setNewGuest((p) => ({ ...p, full_name: e.target.value }))}
            />
            <Input
              placeholder="Email"
              value={newGuest.email}
              onChange={(e) => setNewGuest((p) => ({ ...p, email: e.target.value }))}
            />

            {/* Phone: country + number */}
            <div className="flex gap-2">
              <Select
                value={newGuest.phoneCountry}
                onValueChange={(v) => setNewGuest((p) => ({ ...p, phoneCountry: v }))}
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
                onChange={(e) => setNewGuest((p) => ({ ...p, phoneRaw: e.target.value }))}
              />
            </div>

            <Input
              placeholder="Organization"
              value={newGuest.organization}
              onChange={(e) => setNewGuest((p) => ({ ...p, organization: e.target.value }))}
            />

            <Select
              value={newGuest.status}
              onValueChange={(v) => setNewGuest((p) => ({ ...p, status: v as GuestStatus }))}
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
                placeholder="Search by name, email, organization, or code..."
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#0F1C2E]">Name</TableHead>
                  <TableHead className="text-[#0F1C2E]">Email</TableHead>
                  <TableHead className="text-[#0F1C2E]">Phone</TableHead>
                  <TableHead className="text-[#0F1C2E]">Organization</TableHead>
                  <TableHead className="text-[#0F1C2E]">Unique Code</TableHead>
                  <TableHead className="text-[#0F1C2E]">Status</TableHead>
                  <TableHead className="text-[#0F1C2E]">Check-in Time</TableHead>
                  <TableHead className="text-[#0F1C2E] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                      Loading guests...
                    </TableCell>
                  </TableRow>
                ) : filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                      No guests found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((g) => {
                    const uiStatus = statusToUi(g.status);
                    const hasEmail = !!g.email;

                    return (
                      <TableRow key={g.id} className="hover:bg-[#F5F7FA]/50">
                        <TableCell className="font-medium text-[#0F1C2E]">
                          {g.full_name}
                        </TableCell>
                        <TableCell className="text-gray-600">{g.email ?? "—"}</TableCell>
                        <TableCell className="text-gray-600">{g.phone ?? "—"}</TableCell>
                        <TableCell className="text-gray-600">{g.organization ?? "—"}</TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {g.unique_code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 hover:opacity-90 active:scale-[0.99] transition"
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
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#0F1C2E]/20"
                              onClick={() => openTicket(g.unique_code)}
                              title="Open digital ticket"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#0F1C2E]/20"
                              disabled={!hasEmail || sendingId === g.id || bulkSending}
                              onClick={() => sendTicket(g)}
                              title={!hasEmail ? "Guest belum ada email" : "Send ticket email"}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              {sendingId === g.id ? "Sending..." : "Send"}
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
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
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
        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {filteredGuests.length} of {guests.length} guests
        </div>
      )}
    </div>
  );
}