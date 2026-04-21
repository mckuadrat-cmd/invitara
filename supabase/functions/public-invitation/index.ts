import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        500
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const code = String(body?.code || "").trim().toUpperCase();

    if (!code) {
      return jsonResponse({ error: "Kode undangan tidak ditemukan." }, 400);
    }

  const { data: guest, error: guestErr } = await supabase
    .from("guests")
    .select(`
      id,
      event_id,
      identity_no,
      full_name,
      email,
      phone,
      organization,
      dept_class,
      unique_code,
      guest_type,
      status,
      checkin_time
    `)
    .eq("unique_code", code)
    .maybeSingle();

    if (guestErr) throw guestErr;
    if (!guest) {
      return jsonResponse({ error: "Undangan tidak ditemukan." }, 404);
    }

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select(`
        id,
        owner_id,
        name,
        slug,
        event_date,
        location,
        status,
        theme,
        event_code
      `)
      .eq("id", guest.event_id)
      .maybeSingle();

    if (eventErr) throw eventErr;
    if (!event) {
      return jsonResponse({ error: "Event tidak ditemukan." }, 404);
    }

    const isPublicEvent =
      event.status === "published" ||
      event.status === "ongoing" ||
      event.status === "finished";

    if (!isPublicEvent) {
      const authHeader =
        req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

      if (!authHeader.startsWith("Bearer ")) {
        return jsonResponse({ error: "Undangan belum tersedia. Silakan hubungi panitia." }, 403);
      }

      const token = authHeader.slice(7).trim();

      let callerUserId = "";
      try {
        const payload = decodeJwtPayload(token);
        callerUserId = String(payload?.sub || "").trim();
      } catch {
        return jsonResponse({ error: "Undangan belum tersedia. Silakan hubungi panitia." }, 403);
      }

      if (!callerUserId) {
        return jsonResponse({ error: "Undangan belum tersedia. Silakan hubungi panitia." }, 403);
      }

      let allowed = false;

      if (event.owner_id === callerUserId) {
        allowed = true;
      } else {
        const { data: eventStaff, error: eventStaffErr } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", event.id)
          .eq("user_id", callerUserId)
          .maybeSingle();

        if (eventStaffErr) throw eventStaffErr;

        if (eventStaff?.role === "admin" || eventStaff?.role === "scanner") {
          allowed = true;
        }
      }

      if (!allowed) {
        return jsonResponse({ error: "Undangan belum tersedia. Silakan hubungi panitia." }, 403);
      }
    }

    const { data: settings, error: settingsErr } = await supabase
      .from("event_settings")
      .select("event_id, qr_format, vip_badge_color, vip_back_color")
      .eq("event_id", guest.event_id)
      .maybeSingle();

    if (settingsErr) throw settingsErr;

    return jsonResponse({
      guest,
      event: {
        ...event,
        vip_badge_color: settings?.vip_badge_color ?? null,
        vip_back_color: settings?.vip_back_color ?? null,
      },
       qrFormat: settings?.qr_format ?? "QR Code v1",
    });
  } catch (err: any) {
    return jsonResponse(
      {
        error:
          err?.message ||
          err?.details ||
          err?.hint ||
          "Gagal memuat undangan.",
      },
      500
    );
  }
});