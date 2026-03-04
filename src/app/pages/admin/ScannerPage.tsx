import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { supabase } from "../../lib/supabaseClient";

type GuestRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  organization: string | null;
  unique_code: string;
  status: "registered" | "confirmed" | "checked_in";
  checkin_time: string | null;
};

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
};

export default function ScannerPage() {
  const { eventId } = useParams();
  const location = useLocation();

  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; guest?: GuestRow; message: string } | null>(null);

  const qrRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ value: string; at: number } | null>(null);

  const [checkedCount, setCheckedCount] = useState(0);
  const [event, setEvent] = useState<EventRow | null>(null);

  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    successSoundRef.current = new Audio("/sounds/success.mp3");
    errorSoundRef.current = new Audio("/sounds/error.mp3");
  }, []);

  const normalizedCode = useMemo(() => manualCode.trim().toUpperCase(), [manualCode]);

  function playSuccess() {
    const a = successSoundRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function playError() {
    const a = errorSoundRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  async function loadEvent() {
    if (!eventId) return;
    const { data } = await supabase
      .from("events")
      .select("id,name,event_date,location")
      .eq("id", eventId)
      .single();
    if (data) setEvent(data as EventRow);
  }

  async function loadCheckedCount() {
    if (!eventId) return;
    const { count, error } = await supabase
      .from("guests")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "checked_in");
    if (!error) setCheckedCount(count ?? 0);
  }

  // realtime sync (counter)
  useEffect(() => {
    if (!eventId) return;

    loadEvent();
    loadCheckedCount();

    const channel = supabase
      .channel(`checkins:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        async () => {
          await loadCheckedCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // cleanup kamera saat pindah page/unmount
  useEffect(() => {
    return () => {
      if (qrRef.current) {
        qrRef.current.stop().catch(() => {});
        qrRef.current.clear();
        qrRef.current = null;
      }
    };
  }, []);

  // -----------------------------
  // CHECK IN LOGIC
  // -----------------------------
  async function handleScanCode(codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();

    if (!eventId) {
      playError();
      setResult({ success: false, message: "Missing Event Context." });
      return;
    }

    if (!code) {
      playError();
      setResult({ success: false, message: "Invalid Code." });
      return;
    }

    // debounce duplicate scans (same code within 2s)
    const now = Date.now();
    const last = lastScannedRef.current;
    if (last && last.value === code && now - last.at < 2000) return;
    lastScannedRef.current = { value: code, at: now };

    const { data: guest, error } = await supabase
      .from("guests")
      .select("id,event_id,full_name,email,organization,unique_code,status,checkin_time")
      .eq("event_id", eventId)
      .eq("unique_code", code)
      .single();

    if (error || !guest) {
      playError();
      setResult({ success: false, message: "Invalid Code" });
      return;
    }

    const g = guest as GuestRow;

    if (g.status === "checked_in") {
      playError();
      setResult({ success: false, guest: g, message: "Already Checked In" });
      return;
    }

    const nowIso = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("guests")
      .update({ status: "checked_in", checkin_time: nowIso })
      .eq("id", g.id)
      .eq("event_id", eventId);

    if (updErr) {
      playError();
      setResult({ success: false, message: updErr.message });
      return;
    }

    const updatedGuest: GuestRow = { ...g, status: "checked_in", checkin_time: nowIso };

    playSuccess();
    setResult({ success: true, guest: updatedGuest, message: "Successfully Checked In" });

    // optimistic
    setCheckedCount((prev) => prev + 1);
    setManualCode("");
  }

  // -----------------------------
  // AUTO: parse URL (?code= v1) / token (?t= v3)
  // -----------------------------
  useEffect(() => {
    if (!eventId) return;

    const qs = new URLSearchParams(location.search);
    const code = qs.get("code");
    const token = qs.get("t");

    (async () => {
      if (token) {
        const { data, error } = await supabase.functions.invoke("ticket_verify", {
          body: { token },
        });

        if (error || !data?.ok) {
          playError();
          setResult({ success: false, message: data?.error ?? error?.message ?? "Invalid token" });
          return;
        }

        const payload = data.payload as { eventId?: string; code?: string };
        if (payload?.eventId && payload.eventId !== eventId) {
          playError();
          setResult({ success: false, message: "QR for different event." });
          return;
        }

        if (payload?.code) await handleScanCode(payload.code);
        return;
      }

      if (code) await handleScanCode(code);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, eventId]);

  // -----------------------------
  // CAMERA
  // -----------------------------
  async function startCamera() {
    if (scanning) return;
    setScanning(true);

    const html5QrCode = new Html5Qrcode("reader");
    qrRef.current = html5QrCode;

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          // stop camera once we got a scan
          try {
            await html5QrCode.stop();
            html5QrCode.clear();
          } catch {}
          setScanning(false);

          // 1) URL payload: parse ?t= or ?code=
          try {
            const url = new URL(decodedText);
            const t = url.searchParams.get("t");
            const c = url.searchParams.get("code");

            if (t) {
              const { data, error } = await supabase.functions.invoke("ticket_verify", {
                body: { token: t },
              });

              if (error || !data?.ok) {
                playError();
                setResult({ success: false, message: data?.error ?? error?.message ?? "Invalid token" });
                return;
              }

              const payload = data.payload as { eventId?: string; code?: string };
              if (payload?.eventId && payload.eventId !== eventId) {
                playError();
                setResult({ success: false, message: "QR for different event." });
                return;
              }

              if (payload?.code) await handleScanCode(payload.code);
              return;
            }

            if (c) {
              await handleScanCode(c);
              return;
            }
          } catch {
            // not a URL
          }

          // 2) fallback plain code
          await handleScanCode(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error(err);
      setScanning(false);
      alert("Camera access denied or not supported.");
    }
  }

  async function stopCamera() {
    if (qrRef.current) {
      try {
        await qrRef.current.stop();
        qrRef.current.clear();
      } catch {}
      qrRef.current = null;
    }
    setScanning(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl text-[#0F1C2E] mb-1">QR Code Scanner</h1>
        <p className="text-gray-600">
          {event?.name ? (
            <>
              Event: <span className="font-semibold text-[#0F1C2E]">{event.name}</span>{" "}
              • Checked-in: <span className="font-semibold text-[#0F1C2E]">{checkedCount}</span>
            </>
          ) : (
            <>
              Checked-in: <span className="font-semibold text-[#0F1C2E]">{checkedCount}</span>
            </>
          )}
        </p>
      </div>

      <Card className="mb-6 shadow-xl">
        <CardContent className="p-6">
          <div id="reader" className="rounded-xl overflow-hidden"></div>

          <div className="flex gap-3 mt-4 justify-center">
            {!scanning ? (
              <Button onClick={startCamera} className="bg-[#0F1C2E] text-white">
                Start Camera
              </Button>
            ) : (
              <Button variant="outline" onClick={stopCamera}>
                Stop Camera
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent className="p-6">
          <label className="block mb-2 text-sm">Manual Code</label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter unique code"
            />
            <Button onClick={() => handleScanCode(normalizedCode)}>Check In</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={result !== null} onOpenChange={() => setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Result</DialogTitle>
          </DialogHeader>

          {result && (
            <div className="text-center py-4">
              {result.success ? (
                <>
                  <CheckCircle className="w-14 h-14 mx-auto text-green-600 mb-3" />
                  <h2 className="text-xl font-semibold mb-2">{result.message}</h2>
                  {result.guest && (
                    <div className="mt-3 text-sm text-gray-700">
                      <p className="font-medium">{result.guest.full_name}</p>
                      <p>{result.guest.organization ?? "—"}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="w-14 h-14 mx-auto text-red-600 mb-3" />
                  <h2 className="text-xl font-semibold">{result.message}</h2>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}