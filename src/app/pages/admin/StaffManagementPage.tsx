import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { UserPlus, Trash2, RefreshCw } from "lucide-react";

type AppRole = "owner" | "admin" | "scanner"; // enum app_role (supabase)
type EventStaffRole = "admin" | "scanner"; // event_staff.role (enum app_role) tapi kita batasi 2 ini

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  role: AppRole | null; // global role
};

type EventStaffRow = {
  event_id: string;
  user_id: string;
  role: EventStaffRole; // column: role (app_role)
  created_at?: string;
};

export default function StaffManagementPage() {
  const { eventId } = useParams();

  const [myRole, setMyRole] = useState<AppRole>("scanner");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [eventName, setEventName] = useState<string>("");

  const [staff, setStaff] = useState<(EventStaffRow & { profile?: ProfileRow | null })[]>([]);

  // add form
  const [identifier, setIdentifier] = useState(""); // username/email
  const [newRole, setNewRole] = useState<EventStaffRole>("scanner");
  const [adding, setAdding] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canOpenPage = myRole === "owner" || myRole === "admin";

  const roleOptions: EventStaffRole[] = useMemo(() => {
    // admin per-event hanya boleh assign scanner
    return myRole === "admin" ? ["scanner"] : ["admin", "scanner"];
  }, [myRole]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);

        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) return;

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle();

        if (error) throw error;

        setMyRole((prof?.role ?? "scanner") as AppRole);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load user profile");
      }
    })();
  }, []);

  async function load() {
    if (!eventId) {
      setErr("eventId tidak ada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      // event info
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventId)
        .maybeSingle();

      if (evErr) throw evErr;
      setEventName(ev?.name ?? "");

      // staff list
      const { data: staffRows, error: staffErr } = await supabase
        .from("event_staff")
        .select("event_id,user_id,role,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;

      const ids = (staffRows ?? []).map((s: any) => s.user_id).filter(Boolean);

      let profilesMap = new Map<string, ProfileRow>();
      if (ids.length) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("user_id,full_name,email,username,role")
          .in("user_id", ids);

        if (profErr) throw profErr;
        (profs ?? []).forEach((p: any) => profilesMap.set(p.user_id, p as ProfileRow));
      }

      const merged = (staffRows ?? []).map((s: any) => ({
        ...(s as EventStaffRow),
        profile: profilesMap.get(s.user_id) ?? null,
      }));

      setStaff(merged);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function findUserByIdentifier(id: string) {
    const input = id.trim();
    if (!input) throw new Error("Isi username atau email dulu.");

    if (input.includes("@")) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,full_name,email,username,role")
        .eq("email", input.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      if (!data?.user_id) throw new Error("User tidak ditemukan (email).");
      return data as ProfileRow;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,full_name,email,username,role")
      .ilike("username", input);

    if (error) throw error;

    const list = (data ?? []) as ProfileRow[];
    const exact = list.find((x) => (x.username ?? "").toLowerCase() === input.toLowerCase());
    const pick = exact ?? list[0];

    if (!pick?.user_id) throw new Error("User tidak ditemukan (username).");
    return pick;
  }

  async function addStaff() {
    if (!eventId) return;
    setAdding(true);
    setErr(null);

    try {
      if (!canOpenPage) throw new Error("Tidak punya akses.");

      const prof = await findUserByIdentifier(identifier);

      if (myRole === "admin" && newRole !== "scanner") {
        throw new Error("Admin hanya boleh menambahkan Scanner.");
      }

      const ok = confirm(
        `Tambah staff ke event?\n\nUser: ${prof.username ?? prof.email ?? prof.user_id}\nRole: ${newRole}\nEvent: ${eventName || eventId}`
      );
      if (!ok) return;

      // NOTE: pakai column role (enum app_role). staff_role diabaikan.
      const { error } = await supabase
        .from("event_staff")
        .upsert(
          { event_id: eventId, user_id: prof.user_id, role: newRole },
          { onConflict: "event_id,user_id" }
        );

      if (error) throw error;

      setIdentifier("");
      setNewRole(myRole === "admin" ? "scanner" : "scanner");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add staff");
    } finally {
      setAdding(false);
    }
  }

  async function updateStaffRole(userId: string, role: EventStaffRole) {
    if (!eventId) return;
    setUpdatingId(userId);
    setErr(null);

    try {
      if (myRole !== "owner") throw new Error("Hanya Owner yang boleh ubah role admin/scanner.");

      const ok = confirm(`Ubah role staff menjadi "${role}"?`);
      if (!ok) return;

      const { error } = await supabase
        .from("event_staff")
        .update({ role })
        .eq("event_id", eventId)
        .eq("user_id", userId);

      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeStaff(userId: string, staffRole: EventStaffRole) {
    if (!eventId) return;
    setRemovingId(userId);
    setErr(null);

    try {
      if (myRole === "admin" && staffRole !== "scanner") {
        throw new Error("Admin hanya boleh menghapus Scanner.");
      }

      const ok = confirm("Yakin hapus staff dari event ini?");
      if (!ok) return;

      const { error } = await supabase
        .from("event_staff")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);

      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove staff");
    } finally {
      setRemovingId(null);
    }
  }

  if (!eventId) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-white p-4 text-sm text-gray-700">
          <b>eventId tidak ada.</b> Buka lewat:
          <div className="mt-2 font-mono text-xs bg-gray-100 p-2 rounded">
            /admin/event/:eventId/staff
          </div>
        </div>
      </div>
    );
  }

  if (!canOpenPage) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-white p-4 text-sm text-gray-700">
          <b>Access denied.</b> Halaman ini hanya untuk Owner / Admin.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#0F1C2E] font-semibold">Staff Management</h1>
          <p className="text-sm text-gray-600">
            Event: <span className="font-medium">{eventName || "—"}</span>{" "}
            <span className="ml-2 font-mono text-xs text-gray-500">({eventId})</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Kamu login sebagai: <b>{myRole}</b>
          </p>
        </div>

        <Button
          onClick={load}
          variant="outline"
          className="border-[#0F1C2E]/20"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
          {err}
        </div>
      )}

      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-700">Username / Email</label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="contoh: admin / admin@mail.com"
              />
            </div>

            <div className="w-full md:w-48">
              <label className="text-sm text-gray-700">Role</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as EventStaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {myRole === "admin" && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Admin hanya boleh menambahkan <b>scanner</b>.
                </p>
              )}
            </div>

            <Button
              onClick={addStaff}
              disabled={adding || loading}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {adding ? "Adding..." : "Add Staff"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F5F7FA]">
                  <TableHead className="text-[#0F1C2E]">User</TableHead>
                  <TableHead className="text-[#0F1C2E]">Email</TableHead>
                  <TableHead className="text-[#0F1C2E]">Global Role</TableHead>
                  <TableHead className="text-[#0F1C2E]">Event Role</TableHead>
                  <TableHead className="text-[#0F1C2E] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      Belum ada staff di event ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((s) => {
                    const p = s.profile;
                    const display = p?.username || p?.email || s.user_id;

                    return (
                      <TableRow key={s.user_id} className="hover:bg-[#F5F7FA]/50">
                        <TableCell className="font-medium text-[#0F1C2E]">
                          {display}
                        </TableCell>
                        <TableCell className="text-gray-600">{p?.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className="bg-gray-200 text-gray-800">{p?.role ?? "—"}</Badge>
                        </TableCell>

                        <TableCell>
                          {myRole === "owner" ? (
                            <div className="flex items-center gap-2">
                              <Select
                                value={s.role}
                                onValueChange={(v) => updateStaffRole(s.user_id, v as EventStaffRole)}
                                disabled={updatingId === s.user_id}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">admin</SelectItem>
                                  <SelectItem value="scanner">scanner</SelectItem>
                                </SelectContent>
                              </Select>
                              {updatingId === s.user_id && (
                                <span className="text-xs text-gray-500">saving...</span>
                              )}
                            </div>
                          ) : (
                            <Badge className={s.role === "admin" ? "bg-[#D6C6A5] text-[#0F1C2E]" : "bg-[#22C55E] text-white"}>
                              {s.role}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={removingId === s.user_id}
                            onClick={() => removeStaff(s.user_id, s.role)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {removingId === s.user_id ? "Removing..." : "Remove"}
                          </Button>
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
          Total staff: {staff.length}
        </div>
      )}
    </div>
  );
}