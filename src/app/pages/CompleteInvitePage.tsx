import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./../lib/supabaseClient";

export default function CompleteInvitePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Memproses invite...");

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          throw new Error("User belum login.");
        }

        const email = (user.email || "").trim().toLowerCase();
        if (!email) {
          throw new Error("Email user tidak ditemukan.");
        }

        const defaultRole = "scanner";

        const { error: profileErr } = await supabase.from("profiles").upsert(
          {
            user_id: user.id,
            email,
            full_name: user.user_metadata?.full_name ?? null,
            username: email.split("@")[0] ?? null,
            role: defaultRole,
          },
          { onConflict: "user_id" }
        );

        if (profileErr) throw profileErr;

        const { data: invites, error: inviteErr } = await supabase
          .from("staff_invites")
          .select("id,event_id,role,status")
          .eq("email", email)
          .eq("status", "pending");

        if (inviteErr) throw inviteErr;

        if (!invites || invites.length === 0) {
          setMessage("Tidak ada invite pending. Mengarahkan...");
          setTimeout(() => navigate("/events"), 1200);
          return;
        }

        for (const inv of invites) {
          const { error: staffErr } = await supabase
            .from("event_staff")
            .upsert(
              {
                event_id: inv.event_id,
                user_id: user.id,
                role: inv.role,
              },
              { onConflict: "event_id,user_id" }
            );

          if (staffErr) throw staffErr;

          const { error: updateInviteErr } = await supabase
            .from("staff_invites")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
            })
            .eq("id", inv.id);

          if (updateInviteErr) throw updateInviteErr;
        }

        setMessage("Invite berhasil diaktifkan. Mengarahkan...");
        setTimeout(() => navigate("/events"), 1200);
      } catch (e: any) {
        setMessage(e?.message || "Gagal menyelesaikan invite.");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border p-6 text-center">
        <h1 className="text-xl font-semibold text-[#0F1C2E] mb-3">Complete Invite</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}