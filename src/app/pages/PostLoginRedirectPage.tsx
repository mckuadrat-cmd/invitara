import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type GlobalRole = "owner" | "admin" | "scanner";

export default function PostLoginRedirectPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessRes, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) return setErr(sessErr.message);

      const uid = sessRes.session?.user?.id;
      if (!uid) return nav("/login", { replace: true });

      // 1) ambil role global
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      if (profErr) return setErr(profErr.message);

      if (!prof?.role) {
        // profile gak kebaca -> jangan nebak jadi scanner
        return nav("/forbidden", { replace: true });
        }
        const role = prof.role as GlobalRole;

      // OWNER -> Events page
      if (role === "owner") {
        return nav("/admin/events", { replace: true });
      }

      // 2) ambil daftar event yang user punya akses (RLS harus sudah bener)
      const { data: staffRows, error: staffErr } = await supabase
        .from("event_staff")
        .select("event_id, role, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });

      if (staffErr) return setErr(staffErr.message);

      const rows = staffRows ?? [];

      if (rows.length === 0) {
        return nav("/forbidden", { replace: true });
      }

      // ADMIN -> ke /admin/event/:eventId/dashboard
      if (role === "admin") {
        // prioritas event yang role-nya admin
        const adminRow = rows.find((r) => r.role === "admin") ?? rows[0];

        // kalau dia punya 1 event, langsung masuk event itu
        if (rows.length === 1) {
          return nav(`/admin/event/${adminRow.event_id}/dashboard`, { replace: true });
        }

        // kalau banyak event: lempar ke pemilih event (pakai EventsPage)
        return nav("/admin/events", { replace: true });
      }

      // SCANNER -> ke /scanner/:eventId (kalau 1 event), kalau banyak -> landing /scanner
      const first = rows[0];
      if (rows.length === 1) {
        return nav(`/scanner/${first.event_id}`, { replace: true });
      }
      return nav("/scanner", { replace: true });
    })();
  }, [nav]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-xl p-4">
          <div className="font-semibold mb-2">Redirect error</div>
          <div className="text-sm text-red-600">{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-gray-500">Mengalihkan...</div>
    </div>
  );
}