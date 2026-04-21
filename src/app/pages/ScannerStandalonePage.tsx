// src/pages/ScannerStandalonePage.tsx
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabaseClient";
import ScannerPage from "./admin/ScannerPage";

export default function ScannerStandalonePage() {
  const nav = useNavigate();
  const { eventId } = useParams();

  async function logout() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="sticky top-0 z-50 bg-white border-b">
        <div className="max-w-5xl mx-auto p-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Scanner Mode
          </div>
          <div className="flex gap-2">
            <Button className="bg-[#0F1C2E] text-white" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* reuse scanner yang udah ada */}
        <ScannerPage />
      </div>
    </div>
  );
}