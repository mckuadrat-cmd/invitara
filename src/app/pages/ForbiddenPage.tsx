// src/pages/ForbiddenPage.tsx
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border p-6 text-center">
        <h1 className="text-2xl font-semibold text-[#0F1C2E] mb-2">Access denied</h1>
        <p className="text-sm text-gray-600 mb-4">
          Akun kamu tidak punya izin untuk halaman ini.
        </p>
        <div className="flex gap-2 justify-center">
          <Link to="/app">
            <Button className="bg-[#0F1C2E] text-white">Back</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}