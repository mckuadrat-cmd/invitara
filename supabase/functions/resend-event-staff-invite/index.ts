import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type GlobalRole = "owner" | "staff";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicAppOrigin = Deno.env.get("PUBLIC_APP_ORIGIN");

    if (!supabaseUrl || !serviceRoleKey || !publicAppOrigin) {
      throw new Error("Missing required environment variables.");
    }

    const authHeader =
      req.headers.get("Authorization") ?? req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Empty access token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(accessToken);

    if (authErr || !user) {
      return new Response(
        JSON.stringify({
          error: authErr?.message || "Unauthorized",
        }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    const body = await req.json();
    const inviteId = String(body?.inviteId || "").trim();

    if (!inviteId) {
      return new Response(JSON.stringify({ error: "inviteId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: invite, error: inviteErr } = await adminClient
      .from("staff_invites")
      .select("id,event_id,email,role,status")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invite tidak ditemukan" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (invite.status !== "pending") {
      return new Response(JSON.stringify({ error: "Invite tidak pending" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: callerProfile, error: callerErr } = await adminClient
      .from("profiles")
      .select("user_id, role, role_global")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profile caller tidak ditemukan" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const myGlobalRole: GlobalRole =
      callerProfile.role_global === "owner" || callerProfile.role === "owner"
        ? "owner"
        : "staff";

    if (myGlobalRole !== "owner") {
      const { data: eventStaff, error: esErr } = await adminClient
        .from("event_staff")
        .select("role")
        .eq("event_id", invite.event_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (esErr || !eventStaff || eventStaff.role !== "admin") {
        return new Response(JSON.stringify({ error: "Tidak punya akses" }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      if (invite.role !== "scanner") {
        return new Response(
          JSON.stringify({ error: "Admin event hanya boleh resend invite scanner" }),
          {
            status: 403,
            headers: corsHeaders,
          }
        );
      }
    }

    const redirectTo = `${publicAppOrigin}/auth/complete-invite`;

    const { error: resendErr } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
      redirectTo,
      data: {
        invited_for_event: invite.event_id,
        invited_role: invite.role,
      },
    });

    if (resendErr) throw resendErr;

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Invite berhasil dikirim ulang.",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});