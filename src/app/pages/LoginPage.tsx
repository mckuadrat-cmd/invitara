// src/pages/LoginPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

async function resolveEmail(identifier: string) {
  const input = identifier.trim();
  if (!input) return "";

  // kalau email langsung
  if (input.includes("@")) return input.toLowerCase();

  // username -> lewat edge function (service role)
  const { data, error } = await supabase.functions.invoke(
    "resolve_login_identifier",
    { body: { identifier: input } }
  );

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  const email = String(data?.email ?? "").trim();
  if (!email) throw new Error("Username / email tidak ditemukan.");

  return email.toLowerCase();
}

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // kalau sudah login, redirect sesuai role
    useEffect(() => {
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.id) nav("/app", { replace: true });
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const email = await resolveEmail(identifier);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      nav("/app", { replace: true });

      } catch (e: any) {
        setErr(e?.message ?? "Login failed");
      } finally {
        setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <img
              src="/Invitara.png"
              alt="Invitara"
              className="mx-auto h-10 mb-2"
              onError={(e) => ((e.currentTarget.style.display = "none") as any)}
            />
            <p className="text-sm text-gray-600">Login untuk akses dashboard</p>
          </div>

          {err && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-sm text-gray-700">Username / Email</label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="masukkan username / email"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-sm text-gray-700">Password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white mt-4"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login"}
            </Button>

            <p className="text-xs text-center text-gray-500 mt-3">
              Gunakan email atau username yang terdaftar
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}