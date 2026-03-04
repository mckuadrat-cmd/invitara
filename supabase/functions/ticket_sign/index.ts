import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simple HMAC-SHA256 signer (no extra libs)
async function hmacSha256(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const b = new Uint8Array(sig);
  return btoa(String.fromCharCode(...b))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64urlJson(obj: any) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return b64;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SIGNING_SECRET = Deno.env.get("TICKET_SIGNING_SECRET")!; // set in env

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    const body = await req.json();
    const eventId = String(body.eventId ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();

    if (!eventId || !code) {
      return Response.json({ error: "Missing eventId/code" }, { status: 400 });
    }

    // Optional: ensure guest exists for that event+code (anti token untuk code random)
    const { data: guest, error: gErr } = await supabase
      .from("guests")
      .select("id,event_id,unique_code,status")
      .eq("event_id", eventId)
      .eq("unique_code", code)
      .maybeSingle();

    if (gErr || !guest) {
      return Response.json({ error: "Guest not found" }, { status: 404 });
    }

    // Expiry: 2 hari (ubah sesukamu)
    const exp = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;

    const payload = { v: 3, eventId, code, exp };
    const payloadB64 = base64urlJson(payload);
    const sig = await hmacSha256(SIGNING_SECRET, payloadB64);

    const token = `${payloadB64}.${sig}`;

    return Response.json({ token, payload }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
});