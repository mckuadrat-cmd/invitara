import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type Role = "owner" | "staff" | "admin" | "scanner";

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
  const [globalRole, setGlobalRole] = useState<"owner" | "staff" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const session = sess.session;

        if (!session?.user?.id) {
          setHasSession(false);
          setGlobalRole(null);
          setLoading(false);
          return;
        }

        setHasSession(true);

        const uid = session.user.id;
        const { data, error } = await supabase
          .from("profiles")
          .select("role, role_global")
          .eq("user_id", uid)
          .maybeSingle();

        if (error) {
          setGlobalRole(null);
        } else {
          const nextRole =
            data?.role_global === "owner" || data?.role === "owner"
              ? "owner"
              : "staff";

          setGlobalRole(nextRole);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (!globalRole) {
    return <Navigate to="/forbidden" replace />;
  }

  const normalizedAllow = allow.map((r) => {
    if (r === "admin" || r === "scanner") return "staff";
    return r;
  });

  if (!normalizedAllow.includes(globalRole)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}