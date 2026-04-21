import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

async function resolveEmail(identifier: string) {
  const input = identifier.trim();
  if (!input) return "";

  if (input.includes("@")) return input.toLowerCase();

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

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const email = await resolveEmail(identifier);

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setOk(
        "Link reset password sudah dikirim. Silakan cek email kamu, lalu klik link-nya."
      );
    } catch (e: any) {
      setErr(e?.message ?? "Gagal mengirim email reset password.");
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
            <h1 className="text-xl font-semibold text-[#0F1C2E]">
              Lupa Password
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Masukkan username atau email untuk menerima link reset password
            </p>
          </div>

          {err && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {ok && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {ok}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm text-gray-700">Username / Email</label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="masukkan username / email"
                autoComplete="username"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white mt-4"
              disabled={loading}
            >
              {loading ? "Mengirim..." : "Kirim Link Reset"}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-sm text-[#0F1C2E] hover:underline"
              >
                Kembali ke login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}