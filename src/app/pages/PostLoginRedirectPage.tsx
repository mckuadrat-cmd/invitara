import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { getCurrentUserProfile, getMyEventAccess } from "../lib/access";

export default function PostLoginRedirectPage() {
  const nav = useNavigate();
  const [message, setMessage] = useState("Memeriksa akses...");

  useEffect(() => {
    (async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (!profile) {
          nav("/login", { replace: true });
          return;
        }

        if (profile.globalRole === "owner") {
          nav("/admin/events", { replace: true });
          return;
        }

        const accessRows = await getMyEventAccess();

        if (!accessRows.length) {
          nav("/forbidden", { replace: true });
          return;
        }

        if (accessRows.length === 1) {
          const only = accessRows[0];

          if (only.role === "admin") {
            nav(`/admin/event/${only.event_id}/dashboard`, { replace: true });
            return;
          }

          nav(`/scanner/${only.event_id}`, { replace: true });
          return;
        }

        nav("/my-events", { replace: true });
      } catch (e: any) {
        setMessage(e?.message || "Gagal memeriksa akses.");
      }
    })();
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardContent className="p-6 text-center">
          <div className="text-lg font-semibold text-[#0F1C2E]">Please wait</div>
          <div className="mt-2 text-sm text-gray-600">{message}</div>
        </CardContent>
      </Card>
    </div>
  );
}