import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function ResetPasswordPage() {
  const nav = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checking, setChecking] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password) return "";
    if (password.length < 8) return "Password minimal 8 karakter.";
    if (confirmPassword && password !== confirmPassword) {
      return "Konfirmasi password tidak sama.";
    }
    return "";
  }, [password, confirmPassword]);

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      setChecking(true);
      setErr(null);

      try {
        const hash = window.location.hash || "";
        const hasRecoveryToken =
          hash.includes("access_token=") && hash.includes("type=recovery");

        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session) {
          setValidRecovery(true);
        } else if (hasRecoveryToken) {
          setValidRecovery(true);
        } else {
          setValidRecovery(false);
          setErr("Link reset password tidak valid atau sudah kedaluwarsa.");
        }
      } catch (e: any) {
        if (!mounted) return;
        setValidRecovery(false);
        setErr(e?.message ?? "Gagal memverifikasi link reset password.");
      } finally {
        if (mounted) setChecking(false);
      }
    }

    checkRecoverySession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setValidRecovery(true);
        setErr(null);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!validRecovery) {
      setErr("Session reset password tidak ditemukan. Buka ulang link dari email.");
      return;
    }

    if (!password || !confirmPassword) {
      setErr("Password baru dan konfirmasi password wajib diisi.");
      return;
    }

    if (password.length < 8) {
      setErr("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setOk("Password berhasil diubah. Kamu akan diarahkan ke halaman login.");

      setTimeout(async () => {
        await supabase.auth.signOut();
        nav("/login", { replace: true });
      }, 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal mengubah password.");
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
              Buat Password Baru
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Masukkan password baru untuk akun kamu
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

          {checking ? (
            <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600 text-center">
              Memverifikasi link reset password...
            </div>
          ) : !validRecovery ? (
            <div className="space-y-3">
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                Link reset password tidak bisa dipakai. Minta link baru dari halaman lupa password.
              </div>

              <Link
                to="/forgot-password"
                className="block w-full text-center rounded-md bg-[#0F1C2E] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F1C2E]/90"
              >
                Minta Link Baru
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm text-gray-700">Password Baru</label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="minimal 8 karakter"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700">
                  Konfirmasi Password Baru
                </label>
                <Input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ulang password baru"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              {passwordError && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  {passwordError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#0F1C2E] hover:bg-[#0F1C2E]/90 text-white mt-4"
                disabled={loading}
              >
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}