import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type EventStaffRole = "admin" | "scanner";
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const publicAppOrigin = Deno.env.get("PUBLIC_APP_ORIGIN");

    if (!supabaseUrl || !serviceRoleKey || !anonKey || !publicAppOrigin) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, PUBLIC_APP_ORIGIN"
      );
    }

    const body = await req.json();

    const eventId = String(body?.eventId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const role = String(body?.role || "scanner").trim() as EventStaffRole;
    const accessToken = String(body?.accessToken || "").trim();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Missing access token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!["admin", "scanner"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    console.log("BODY CHECK", {
      hasEventId: !!eventId,
      hasEmail: !!email,
      role,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
    });

    console.log("ENV CHECK", {
      hasUrl: !!supabaseUrl,
      hasAnon: !!anonKey,
      hasServiceRole: !!serviceRoleKey,
      hasPublicAppOrigin: !!publicAppOrigin,
    });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return new Response(
        JSON.stringify({
          error: authErr?.message || "Unauthorized",
          debug: {
            hasAccessToken: !!accessToken,
            accessTokenLength: accessToken?.length || 0,
            hasAnonKey: !!anonKey,
          },
        }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    console.log("GET USER RESULT", {
      hasUser: !!user,
      userId: user?.id ?? null,
      authError: authErr?.message ?? null,
    });

    const { data: callerProfile, error: callerErr } = await adminClient
      .from("profiles")
      .select("user_id, role, role_global, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "Caller profile not found" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const myGlobalRole: GlobalRole =
      callerProfile.role_global === "owner" || callerProfile.role === "owner"
        ? "owner"
        : "staff";

    let myEventRole: EventStaffRole | null = null;

    if (myGlobalRole !== "owner") {
      const { data: myEventStaff, error: myEventErr } = await adminClient
        .from("event_staff")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (myEventErr) throw myEventErr;

      myEventRole = (myEventStaff?.role as EventStaffRole | null) ?? null;

      if (myEventRole !== "admin") {
        return new Response(JSON.stringify({ error: "Tidak punya akses." }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      if (role !== "scanner") {
        return new Response(
          JSON.stringify({ error: "Admin event hanya boleh menambahkan scanner." }),
          {
            status: 403,
            headers: corsHeaders,
          }
        );
      }
    }

    const { data: existingProfile, error: existingErr } = await adminClient
      .from("profiles")
      .select("user_id, email, full_name, username")
      .eq("email", email)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingProfile?.user_id) {
      const { error: staffErr } = await adminClient
        .from("event_staff")
        .upsert(
          {
            event_id: eventId,
            user_id: existingProfile.user_id,
            role,
          },
          { onConflict: "event_id,user_id" }
        );

      if (staffErr) throw staffErr;

      return new Response(
        JSON.stringify({
          ok: true,
          mode: "existing_user",
          message: "User sudah terdaftar, staff langsung ditambahkan.",
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    const redirectTo = `${publicAppOrigin}/auth/complete-invite`;

    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_for_event: eventId,
        invited_role: role,
      },
    });

    if (inviteErr) throw inviteErr;

    const { error: inviteRowErr } = await adminClient
      .from("staff_invites")
      .upsert(
        {
          event_id: eventId,
          email,
          role,
          invited_by: user.id,
          status: "pending",
        },
        { onConflict: "event_id,email" }
      );

    if (inviteRowErr) throw inviteRowErr;

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "invited",
        message: "Invite berhasil dikirim ke email staff.",
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});