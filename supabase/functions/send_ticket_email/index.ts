import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!; // contoh: "Invitara <no-reply@domainkamu.com>"

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { guestId } = await req.json();
    if (!guestId) return Response.json({ error: "Missing guestId" }, { status: 400 });

    const { data: guest, error: gErr } = await supabase
      .from("guests")
      .select("id,event_id,full_name,email,unique_code")
      .eq("id", guestId)
      .single();

    if (gErr || !guest) return Response.json({ error: "Guest not found" }, { status: 404 });
    if (!guest.email) return Response.json({ error: "Guest email is empty" }, { status: 400 });

    const { data: event, error: eErr } = await supabase
      .from("events")
      .select("id,name,location,event_date")
      .eq("id", guest.event_id)
      .single();

    if (eErr || !event) return Response.json({ error: "Event not found" }, { status: 404 });

    // Ticket URL public
    const origin = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "http://localhost:5173";
    const ticketUrl = `${origin}/ticket/${encodeURIComponent(String(guest.unique_code).toUpperCase())}`;

    const subject = `Tiket Anda: ${event.name}`;
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.5;">
        <h2 style="margin:0 0 8px 0;">${event.name}</h2>
        <div style="color:#555; font-size:14px;">
          ${event.location ?? ""} ${event.event_date ? "• " + new Date(event.event_date).toLocaleString("id-ID") : ""}
        </div>
        <p>Halo <b>${guest.full_name}</b>, berikut tiket digital Anda:</p>
        <p><a href="${ticketUrl}" target="_blank">${ticketUrl}</a></p>
        <p style="font-size:12px; color:#777;">Kode: <b>${String(guest.unique_code).toUpperCase()}</b></p>
      </div>
    `;

    // Send via Resend
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [guest.email],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return Response.json({ error: `Resend error: ${txt}` }, { status: 500 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
});