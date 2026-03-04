import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type GlobalRole = "owner" | "admin" | "scanner";
type StaffRole = "admin" | "scanner";

export default function RequireEventAccess({
  allowStaff,
  children,
}: {
  allowStaff: StaffRole[];
  children: React.ReactNode;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const { eventId } = useParams();

  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) {
          nav("/login", { replace: true, state: { from: loc.pathname } });
          return;
        }

        // ambil role global
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        const role = (prof?.role ?? null) as GlobalRole | null;
            if (!role) {
            nav("/forbidden", { replace: true });
            return;
            }

        // owner: always ok (global)
        if (role === "owner") {
          setOk(true);
          return;
        }

        // kalau halaman butuh eventId tapi eventId kosong => forbidden
        if (!eventId) {
          nav("/forbidden", { replace: true });
          return;
        }

        // cek membership event_staff
        const { data: staff, error: staffErr } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (staffErr) throw staffErr;

        const staffRole = (staff?.role ?? null) as StaffRole | null;

        if (!staffRole || !allowStaff.includes(staffRole)) {
          nav("/forbidden", { replace: true });
          return;
        }

        setOk(true);
      } catch {
        nav("/forbidden", { replace: true });
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (checking) return null;
  if (!ok) return null;

  return <>{children}</>;
}