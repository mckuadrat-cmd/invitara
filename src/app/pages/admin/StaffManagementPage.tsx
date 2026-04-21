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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  UserPlus,
  Trash2,
  RefreshCw,
  Mail,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";

type GlobalRole = "owner" | "staff";
type EventStaffRole = "admin" | "scanner";
type MyEventRole = EventStaffRole | null;

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  role_global?: GlobalRole | null;
};

type EventStaffRow = {
  event_id: string;
  user_id: string;
  role: EventStaffRole;
  created_at?: string;
};

type StaffInviteRow = {
  id: string;
  event_id: string;
  email: string;
  role: EventStaffRole;
  invited_by: string;
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
  accepted_at: string | null;
};

type ConfirmAction =
  | {
      type: "add";
      title: string;
      description: string;
      tone: "default";
    }
  | {
      type: "remove";
      userId: string;
      staffRole: EventStaffRole;
      title: string;
      description: string;
      tone: "danger";
    }
  | {
      type: "cancelInvite";
      inviteId: string;
      role: EventStaffRole;
      title: string;
      description: string;
      tone: "danger";
    }
  | {
      type: "activateInvite";
      inviteId: string;
      email: string;
      role: EventStaffRole;
      title: string;
      description: string;
      tone: "default";
    }
  | {
      type: "updateRole";
      userId: string;
      role: EventStaffRole;
      title: string;
      description: string;
      tone: "default";
    }
  | null;

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

export default function StaffManagementPage() {
  const { eventId } = useParams();

  const [myGlobalRole, setMyGlobalRole] = useState<GlobalRole>("staff");
  const [myEventRole, setMyEventRole] = useState<MyEventRole>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [eventName, setEventName] = useState<string>("");

  const [staff, setStaff] = useState<(EventStaffRow & { profile?: ProfileRow | null })[]>([]);
  const [pendingInvites, setPendingInvites] = useState<StaffInviteRow[]>([]);

  const [emailInput, setEmailInput] = useState("");
  const [newRole, setNewRole] = useState<EventStaffRole>("scanner");
  const [adding, setAdding] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelInviteId, setCancelInviteId] = useState<string | null>(null);
  const [activatingInviteId, setActivatingInviteId] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [registerInviteId, setRegisterInviteId] = useState<string | null>(null);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerRole, setRegisterRole] = useState<EventStaffRole>("scanner");
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    username: string;
    password: string;
  } | null>(null);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);

  const isOwner = myGlobalRole === "owner";
  const isEventAdmin = myEventRole === "admin";
  const canOpenPage = isOwner || isEventAdmin;

  const roleOptions: EventStaffRole[] = useMemo(() => {
    return isOwner ? ["admin", "scanner"] : ["scanner"];
  }, [isOwner]);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const uid = session?.user?.id;
        if (!uid) return;

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("role, role_global")
          .eq("user_id", uid)
          .maybeSingle();

        if (error) throw error;

        const resolvedGlobalRole: GlobalRole =
          prof?.role_global === "owner" || prof?.role === "owner" ? "owner" : "staff";

        setMyGlobalRole(resolvedGlobalRole);

        if (resolvedGlobalRole === "owner" || !eventId) {
          setMyEventRole(null);
          return;
        }

        const { data: myStaff, error: myStaffErr } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", eventId)
          .eq("user_id", uid)
          .maybeSingle();

        if (myStaffErr) throw myStaffErr;

        setMyEventRole((myStaff?.role as EventStaffRole | null) ?? null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load user profile");
      }
    })();
  }, [eventId]);

  async function load() {
    if (!eventId) {
      setErr("eventId tidak ada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const uid = session?.user?.id;
      if (!uid) throw new Error("Not logged in.");

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role, role_global")
        .eq("user_id", uid)
        .maybeSingle();

      if (profErr) throw profErr;

      const resolvedGlobalRole: GlobalRole =
        prof?.role_global === "owner" || prof?.role === "owner" ? "owner" : "staff";

      setMyGlobalRole(resolvedGlobalRole);

      if (resolvedGlobalRole !== "owner") {
        const { data: myStaff, error: myStaffErr } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", eventId)
          .eq("user_id", uid)
          .maybeSingle();

        if (myStaffErr) throw myStaffErr;

        const resolvedEventRole = (myStaff?.role as EventStaffRole | null) ?? null;
        setMyEventRole(resolvedEventRole);

        if (resolvedEventRole !== "admin") {
          setStaff([]);
          setPendingInvites([]);
          setEventName("");
          setLoading(false);
          return;
        }
      } else {
        setMyEventRole(null);
      }

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventId)
        .maybeSingle();

      if (evErr) throw evErr;
      setEventName(ev?.name ?? "");

      const { data: staffRows, error: staffErr } = await supabase
        .from("event_staff")
        .select("event_id,user_id,role,created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;

      const ids = (staffRows ?? []).map((s: any) => s.user_id).filter(Boolean);

      const profilesMap = new Map<string, ProfileRow>();
      if (ids.length) {
        const { data: profs, error: profErr2 } = await supabase
          .from("profiles")
          .select("user_id,full_name,email,username,role,role_global")
          .in("user_id", ids);

        if (profErr2) throw profErr2;
        (profs ?? []).forEach((p: any) => profilesMap.set(p.user_id, p as ProfileRow));
      }

      const merged = (staffRows ?? []).map((s: any) => ({
        ...(s as EventStaffRow),
        profile: profilesMap.get(s.user_id) ?? null,
      }));

      setStaff(merged);

      const { data: invites, error: inviteErr } = await supabase
        .from("staff_invites")
        .select("id,event_id,email,role,invited_by,status,created_at,accepted_at")
        .eq("event_id", eventId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (inviteErr) throw inviteErr;

      setPendingInvites((invites ?? []) as StaffInviteRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load staff");
      setStaff([]);
      setPendingInvites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventId]);

  function addStaff() {
    if (!eventId) return;

    try {
      if (!canOpenPage) throw new Error("Tidak punya akses.");

      const email = emailInput.trim().toLowerCase();

      if (!email || !email.includes("@")) {
        throw new Error("Masukkan email yang valid.");
      }

      if (!isOwner && newRole !== "scanner") {
        throw new Error("Admin event hanya boleh menambahkan scanner.");
      }

      setErr(null);

      setConfirmAction({
        type: "add",
        title: "Tambah / Invite Staff",
        description:
          `Email: ${email}\n` +
          `Role: ${newRole}\n` +
          `Event: ${eventName || eventId}\n\n` +
          `Kalau email sudah punya akun, user langsung ditambahkan ke event.\n` +
          `Kalau belum punya akun, email masuk ke pending.`,
        tone: "default",
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to prepare add staff";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function doAddStaff() {
    if (!eventId) return;

    setAdding(true);
    setConfirmLoading(true);
    setErr(null);

    try {
      const email = emailInput.trim().toLowerCase();

      if (!email || !email.includes("@")) {
        throw new Error("Masukkan email yang valid.");
      }

      if (!isOwner && newRole !== "scanner") {
        throw new Error("Admin event hanya boleh menambahkan scanner.");
      }

      const { data: existingProfile, error: existingErr } = await supabase
        .from("profiles")
        .select("user_id, email")
        .eq("email", email)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existingProfile?.user_id) {
        const { error: staffErr } = await supabase
          .from("event_staff")
          .upsert(
            {
              event_id: eventId,
              user_id: existingProfile.user_id,
              role: newRole,
            },
            { onConflict: "event_id,user_id" }
          );

        if (staffErr) throw staffErr;

        await supabase
          .from("staff_invites")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("event_id", eventId)
          .eq("email", email)
          .eq("status", "pending");

        toast.success("User sudah punya akun. Staff langsung ditambahkan.");
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUserId = session?.user?.id;
        if (!currentUserId) {
          throw new Error("Session tidak ditemukan. Silakan login ulang.");
        }

        const { error: inviteErr } = await supabase
          .from("staff_invites")
          .upsert(
            {
              event_id: eventId,
              email,
              role: newRole,
              invited_by: currentUserId,
              status: "pending",
            },
            { onConflict: "event_id,email" }
          );

        if (inviteErr) throw inviteErr;

        toast.success("Email belum punya akun. Disimpan sebagai pending.");
      }

      setEmailInput("");
      setNewRole("scanner");
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to add staff";
      setErr(msg);
      toast.error(msg);
    } finally {
      setAdding(false);
      setConfirmLoading(false);
    }
  }

  function updateStaffRole(userId: string, role: EventStaffRole) {
    if (!eventId) return;

    try {
      if (!isOwner) {
        throw new Error("Hanya Owner yang boleh ubah role admin/scanner.");
      }

      setConfirmAction({
        type: "updateRole",
        userId,
        role,
        title: "Ubah Role Staff",
        description: `Role staff akan diubah menjadi "${role}". Lanjutkan?`,
        tone: "default",
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to prepare update role";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function doUpdateStaffRole(userId: string, role: EventStaffRole) {
    if (!eventId) return;

    setUpdatingId(userId);
    setConfirmLoading(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("event_staff")
        .update({ role })
        .eq("event_id", eventId)
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Role staff berhasil diubah.");
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to update role";
      setErr(msg);
      toast.error(msg);
    } finally {
      setUpdatingId(null);
      setConfirmLoading(false);
    }
  }

  function removeStaff(userId: string, staffRole: EventStaffRole) {
    if (!eventId) return;

    try {
      if (!isOwner && staffRole !== "scanner") {
        throw new Error("Admin event hanya boleh menghapus scanner.");
      }

      setConfirmAction({
        type: "remove",
        userId,
        staffRole,
        title: "Hapus Staff",
        description: "Staff akan dihapus dari event ini. Lanjutkan?",
        tone: "danger",
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to prepare remove staff";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function doRemoveStaff(userId: string) {
    if (!eventId) return;

    setRemovingId(userId);
    setConfirmLoading(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("event_staff")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Staff berhasil dihapus.");
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to remove staff";
      setErr(msg);
      toast.error(msg);
    } finally {
      setRemovingId(null);
      setConfirmLoading(false);
    }
  }

  function cancelInvite(inviteId: string, role: EventStaffRole) {
    if (!eventId) return;

    try {
      if (!isOwner && role !== "scanner") {
        throw new Error("Admin event hanya boleh membatalkan invite scanner.");
      }

      setConfirmAction({
        type: "cancelInvite",
        inviteId,
        role,
        title: "Batalkan Invite",
        description: "Invite ini akan dibatalkan. Lanjutkan?",
        tone: "danger",
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to prepare cancel invite";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function doCancelInvite(inviteId: string) {
    if (!eventId) return;

    setCancelInviteId(inviteId);
    setConfirmLoading(true);
    setErr(null);

    try {
      const { error } = await supabase
        .from("staff_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId)
        .eq("event_id", eventId);

      if (error) throw error;

      toast.success("Invite dibatalkan.");
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to cancel invite";
      setErr(msg);
      toast.error(msg);
    } finally {
      setCancelInviteId(null);
      setConfirmLoading(false);
    }
  }

  function activateInvite(inviteId: string, email: string, role: EventStaffRole) {
    if (!eventId) return;

    try {
      if (!isOwner && role !== "scanner") {
        throw new Error("Admin event hanya boleh mengaktifkan scanner.");
      }

      setConfirmAction({
        type: "activateInvite",
        inviteId,
        email,
        role,
        title: "Aktifkan Invite",
        description: `Sistem akan cek apakah ${email} sudah punya akun. Kalau sudah, user akan langsung ditambahkan sebagai ${role}.`,
        tone: "default",
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to prepare activate invite";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function doActivateInvite(inviteId: string, email: string, role: EventStaffRole) {
    if (!eventId) return;

    setActivatingInviteId(inviteId);
    setConfirmLoading(true);
    setErr(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (!profile?.user_id) {
        throw new Error("User belum punya akun.");
      }

      const { error: staffErr } = await supabase
        .from("event_staff")
        .upsert(
          {
            event_id: eventId,
            user_id: profile.user_id,
            role,
          },
          { onConflict: "event_id,user_id" }
        );

      if (staffErr) throw staffErr;

      const { error: inviteErr } = await supabase
        .from("staff_invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .eq("event_id", eventId);

      if (inviteErr) throw inviteErr;

      toast.success("Pending invite berhasil diaktifkan.");
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to activate invite";
      setErr(msg);
      toast.error(msg);
    } finally {
      setActivatingInviteId(null);
      setConfirmLoading(false);
    }
  }

  function openRegisterUserDialog(invite: StaffInviteRow) {
    setRegisterInviteId(invite.id);
    setRegisterEmail(invite.email);
    setRegisterRole(invite.role);
    setRegisterFullName("");
    setRegisterUsername("");
    setRegisterPassword("");
  }

  async function submitRegisterUser() {
    if (!eventId || !registerInviteId) return;

    setRegisterLoading(true);
    setErr(null);

    try {
      if (!registerFullName.trim()) {
        throw new Error("Nama wajib diisi.");
      }

      if (!registerUsername.trim()) {
        throw new Error("Username wajib diisi.");
      }

      if (registerUsername.includes("@")) {
        throw new Error("Username tidak boleh berbentuk email.");
      }

      if (registerPassword.trim().length < 6) {
        throw new Error("Password minimal 6 karakter.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session tidak ditemukan. Silakan login ulang.");
      }

      console.log("SESSION:", session);
      console.log("ACCESS TOKEN:", session?.access_token);
      console.log("REGISTER DATA:", {
        inviteId: registerInviteId,
        eventId,
        email: registerEmail,
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log("AUTH HEADER:", `Bearer ${session.access_token}`);

      const res = await fetch(
        `${supabaseUrl}/functions/v1/create-event-staff-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            inviteId: registerInviteId,
            eventId,
            email: registerEmail,
            role: registerRole,
            fullName: registerFullName.trim(),
            username: registerUsername.trim().toLowerCase(),
            password: registerPassword.trim(),
          }),
        }
      );

      const data = await res.json();

      console.log("RESPONSE STATUS:", res.status);
      console.log("RESPONSE DATA:", data);
      console.log("create-event-staff-account status:", res.status);
      console.log("create-event-staff-account response:", data);

      if (!res.ok) {
        throw new Error(data?.error || `Gagal mendaftarkan user. HTTP ${res.status}`);
      }

      if (data?.credentials) {
        setCreatedCredential(data.credentials);
        setShowCredentialDialog(true);
      }

      toast.success(data?.message || "User berhasil didaftarkan.");

      setRegisterInviteId(null);
      setRegisterEmail("");
      setRegisterRole("scanner");
      setRegisterFullName("");
      setRegisterUsername("");
      setRegisterPassword("");

      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Gagal mendaftarkan user";
      setErr(msg);
      toast.error(msg);
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    switch (confirmAction.type) {
      case "add":
        await doAddStaff();
        break;
      case "remove":
        await doRemoveStaff(confirmAction.userId);
        break;
      case "cancelInvite":
        await doCancelInvite(confirmAction.inviteId);
        break;
      case "activateInvite":
        await doActivateInvite(
          confirmAction.inviteId,
          confirmAction.email,
          confirmAction.role
        );
        break;
      case "updateRole":
        await doUpdateStaffRole(confirmAction.userId, confirmAction.role);
        break;
    }
  }

  function formatDate(date?: string | null) {
    if (!date) return "—";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date));
    } catch {
      return date;
    }
  }

  function getGlobalRoleLabel(profile?: ProfileRow | null) {
    if (!profile) return "—";
    if (profile.role_global === "owner" || profile.role === "owner") return "owner";
    return "staff";
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

  if (!loading && !canOpenPage) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-white p-4 text-sm text-gray-700">
          <b>Access denied.</b> Halaman ini hanya untuk Owner atau Admin event.
        </div>
      </div>
    );
  }

  const isDangerAction = confirmAction?.tone === "danger";

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#0F1C2E] font-semibold">Staff Management</h1>
          <p className="text-sm text-gray-600">
            Event: <span className="font-medium">{eventName || "—"}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Global role: <b>{myGlobalRole}</b>
            {myEventRole ? (
              <>
                {" "}• Event role: <b>{myEventRole}</b>
              </>
            ) : isOwner ? (
              <>
                {" "}• Event role: <b>owner access</b>
              </>
            ) : null}
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
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-[#0F1C2E]" />
            <h2 className="text-base font-semibold text-[#0F1C2E]">Tambah / Invite Staff</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-700">Email Staff</label>
              <Input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="staff@email.com"
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
            </div>

            <Button
              onClick={addStaff}
              disabled={adding || loading || !canOpenPage}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {adding ? "Processing..." : "Add / Invite"}
            </Button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Kalau email sudah punya akun, staff langsung ditambahkan. Kalau belum, email masuk ke pending.
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-0">
          <div className="px-6 pt-6 pb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0F1C2E]" />
            <h2 className="text-base font-semibold text-[#0F1C2E]">Active Staff</h2>
            <Badge className="bg-[#0F1C2E] text-white">{staff.length}</Badge>
          </div>

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
                      Belum ada staff aktif di event ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((s) => {
                    const p = s.profile;
                    const display = p?.full_name || p?.username || p?.email || s.user_id;

                    return (
                      <TableRow key={s.user_id} className="hover:bg-[#F5F7FA]/50">
                        <TableCell className="font-medium text-[#0F1C2E]">
                          {display}
                        </TableCell>

                        <TableCell className="text-gray-600">{p?.email ?? "—"}</TableCell>

                        <TableCell>
                          <Badge className="bg-gray-200 text-gray-800">
                            {getGlobalRoleLabel(p)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          {isOwner ? (
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
                            <Badge
                              className={
                                s.role === "admin"
                                  ? "bg-[#D6C6A5] text-[#0F1C2E]"
                                  : "bg-[#22C55E] text-white"
                              }
                            >
                              {s.role}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={
                              removingId === s.user_id || (!isOwner && s.role !== "scanner")
                            }
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

      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="px-6 pt-6 pb-2 flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-[#0F1C2E]" />
            <h2 className="text-base font-semibold text-[#0F1C2E]">Pending Invites</h2>
            <Badge className="bg-amber-100 text-amber-800">{pendingInvites.length}</Badge>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F5F7FA]">
                  <TableHead className="text-[#0F1C2E]">Email</TableHead>
                  <TableHead className="text-[#0F1C2E]">Role</TableHead>
                  <TableHead className="text-[#0F1C2E]">Status</TableHead>
                  <TableHead className="text-[#0F1C2E]">Dikirim</TableHead>
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
                ) : pendingInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      Belum ada invite pending.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingInvites.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-[#F5F7FA]/50">
                      <TableCell className="font-medium text-[#0F1C2E]">
                        {inv.email}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            inv.role === "admin"
                              ? "bg-[#D6C6A5] text-[#0F1C2E]"
                              : "bg-[#22C55E] text-white"
                          }
                        >
                          {inv.role}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-800">pending</Badge>
                      </TableCell>

                      <TableCell className="text-gray-600">
                        {formatDate(inv.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRegisterUserDialog(inv)}
                          >
                            <UserRoundPlus className="w-4 h-4 mr-2" />
                            Buat Akun
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              activatingInviteId === inv.id || (!isOwner && inv.role !== "scanner")
                            }
                            onClick={() => activateInvite(inv.id, inv.email, inv.role)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {activatingInviteId === inv.id ? "Activating..." : "Aktifkan"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={
                              cancelInviteId === inv.id || (!isOwner && inv.role !== "scanner")
                            }
                            onClick={() => cancelInvite(inv.id, inv.role)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {cancelInviteId === inv.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!loading && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Total active staff: {staff.length} • Pending invites: {pendingInvites.length}
        </div>
      )}

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !confirmLoading) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={isDangerAction ? "text-red-700" : "text-[#0F1C2E]"}
            >
              {confirmAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmLoading}>
              Batal
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAction();
              }}
              disabled={confirmLoading}
              className={
                isDangerAction
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
              }
            >
              {confirmLoading
                ? "Memproses..."
                : isDangerAction
                ? "Ya, lanjutkan"
                : "Lanjutkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!registerInviteId}
        onOpenChange={(open) => {
          if (!open && !registerLoading) {
            setRegisterInviteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0F1C2E]">
              Buat Akun User Baru
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              Buat akun untuk email: {registerEmail}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-700">Nama</label>
              <Input
                value={registerFullName}
                onChange={(e) => setRegisterFullName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>

            <div>
              <label className="text-sm text-gray-700">Username</label>
              <Input
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                placeholder="username login"
              />
            </div>

            <div>
              <label className="text-sm text-gray-700">Password</label>
              <Input
                type="text"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="password awal"
              />
            </div>

            <div className="text-xs text-gray-500">
              Role event: <b>{registerRole}</b>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={registerLoading}>
              Batal
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                submitRegisterUser();
              }}
              disabled={registerLoading}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            >
              {registerLoading ? "Memproses..." : "Daftarkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCredentialDialog} onOpenChange={setShowCredentialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0F1C2E]">
              Akun Staff Berhasil Dibuat
            </AlertDialogTitle>
            <AlertDialogDescription>
              Simpan credential ini dan bagikan ke staff.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 rounded-md border bg-[#F8FAFC] p-4 text-sm">
            <div>
              <span className="font-semibold">Email:</span> {createdCredential?.email ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Username:</span> {createdCredential?.username ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Password:</span> {createdCredential?.password ?? "—"}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowCredentialDialog(false)}
              className="bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white"
            >
              Tutup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}