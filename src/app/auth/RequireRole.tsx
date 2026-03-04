import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Role = "admin" | "scanner" | "owner";

export default function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const loc = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const session = sess.session;

      if (!session?.user?.id) {
        setHasSession(false);
        setRole(null);
        setLoading(false);
        return;
      }

      setHasSession(true);

      const uid = session.user.id;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        setRole(null);
      } else {
        setRole((data?.role as Role) ?? null);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  // ✅ belum login -> ke login, BUKAN forbidden
  if (!hasSession) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  // ✅ sudah login tapi role tidak diizinkan -> forbidden
  if (!role || !allow.includes(role)) return <Navigate to="/forbidden" replace />;

  return <>{children}</>;
}