import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

function decodeBase64UrlJson(b64: string) {
  const norm = b64.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((b64.length + 3) % 4);
  const json = decodeURIComponent(escape(atob(norm)));
  return JSON.parse(json);
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const SIGNING_SECRET = Deno.env.get("TICKET_SIGNING_SECRET")!;
    const body = await req.json();
    const token = String(body.token ?? "").trim();

    if (!token || !token.includes(".")) {
      return Response.json({ error: "Invalid token format" }, { status: 400 });
    }

    const [payloadB64, sig] = token.split(".");
    const expected = await hmacSha256(SIGNING_SECRET, payloadB64);

    if (sig !== expected) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = decodeBase64UrlJson(payloadB64);

    if (payload?.v !== 3) {
      return Response.json({ error: "Invalid token version" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return Response.json({ error: "Token expired" }, { status: 401 });
    }

    return Response.json({ ok: true, payload }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
});