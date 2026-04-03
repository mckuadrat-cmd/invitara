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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(padded);

  return JSON.parse(decoded);
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
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const accessToken = authHeader.slice(7).trim();

    let callerUserId = "";
    try {
      const payload = decodeJwtPayload(accessToken);
      callerUserId = String(payload?.sub || "").trim();
    } catch {
      return jsonResponse({ error: "Invalid JWT payload" }, 401);
    }

    if (!callerUserId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();

    const inviteId = String(body?.inviteId || "").trim();
    const eventId = String(body?.eventId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();
    const fullName = String(body?.fullName || "").trim();
    const role = String(body?.role || "scanner").trim() as EventStaffRole;

    if (!inviteId) {
      return jsonResponse({ error: "inviteId is required" }, 400);
    }

    if (!eventId) {
      return jsonResponse({ error: "eventId is required" }, 400);
    }

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Valid email is required" }, 400);
    }

    if (!fullName) {
      return jsonResponse({ error: "Nama wajib diisi." }, 400);
    }

    if (!username) {
      return jsonResponse({ error: "Username wajib diisi." }, 400);
    }

    if (username.includes("@")) {
      return jsonResponse(
        { error: "Username tidak boleh berbentuk email." },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { error: "Password minimal 6 karakter." },
        400
      );
    }

    if (!["admin", "scanner"].includes(role)) {
      return jsonResponse({ error: "Invalid role" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: callerProfile, error: callerProfileErr } = await adminClient
      .from("profiles")
      .select("user_id, role, role_global")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (callerProfileErr) {
      throw callerProfileErr;
    }

    if (!callerProfile) {
      return jsonResponse({ error: "Caller profile not found" }, 403);
    }

    const myGlobalRole: GlobalRole =
      callerProfile.role_global === "owner" || callerProfile.role === "owner"
        ? "owner"
        : "staff";

    if (myGlobalRole !== "owner") {
      const { data: myEventStaff, error: myEventErr } = await adminClient
        .from("event_staff")
        .select("role")
        .eq("event_id", eventId)
        .eq("user_id", callerUserId)
        .maybeSingle();

      if (myEventErr) {
        throw myEventErr;
      }

      const myEventRole = (myEventStaff?.role as EventStaffRole | null) ?? null;

      if (myEventRole !== "admin") {
        return jsonResponse({ error: "Tidak punya akses." }, 403);
      }

      if (role !== "scanner") {
        return jsonResponse(
          { error: "Admin event hanya boleh menambahkan scanner." },
          403
        );
      }
    }

    const { data: existingProfileByEmail, error: existingEmailErr } =
      await adminClient
        .from("profiles")
        .select("user_id, email")
        .eq("email", email)
        .maybeSingle();

    if (existingEmailErr) {
      throw existingEmailErr;
    }

    if (existingProfileByEmail?.user_id) {
      return jsonResponse(
        { error: "Email ini sudah punya akun. Tinggal klik Aktifkan." },
        409
      );
    }

    const { data: existingProfileByUsername, error: existingUsernameErr } =
      await adminClient
        .from("profiles")
        .select("user_id, username")
        .eq("username", username)
        .maybeSingle();

    if (existingUsernameErr) {
      throw existingUsernameErr;
    }

    if (existingProfileByUsername?.user_id) {
      return jsonResponse({ error: "Username sudah dipakai." }, 409);
    }

    const { data: createdUser, error: createUserErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
        },
      });

    if (createUserErr) {
      return jsonResponse({ error: createUserErr.message }, 400);
    }

    const targetUserId = createdUser.user?.id;
    if (!targetUserId) {
      throw new Error("User gagal dibuat.");
    }

    console.log("STEP 1 callerUserId:", callerUserId);
    console.log("STEP 2 payload:", {
      inviteId,
      eventId,
      email,
      username,
      role,
    });

    console.log("STEP 3 createUser result:", {
      userId: createdUser.user?.id,
      error: createUserErr,
    });

    console.log("STEP 4 before profiles upsert");

    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert(
        {
          user_id: targetUserId,
          email,
          username,
          full_name: fullName,
          role: role,
          role_global: "staff",
        },
        { onConflict: "user_id" }
      );

    if (profileErr) {
      throw profileErr;
    }

    console.log("STEP 4 profiles upsert error:", profileErr);

    if (profileErr) {
      throw profileErr;
    }

    console.log("STEP 5 before event_staff upsert");

    const { error: staffErr } = await adminClient
      .from("event_staff")
      .upsert(
        {
          event_id: eventId,
          user_id: targetUserId,
          role,
        },
        { onConflict: "event_id,user_id" }
      );

    console.log("STEP 5 event_staff upsert error:", staffErr);

    if (staffErr) {
      throw staffErr;
    }

    console.log("STEP 6 before invite update");

    const { error: inviteErr } = await adminClient
      .from("staff_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .eq("event_id", eventId);

    console.log("STEP 6 invite update error:", inviteErr);

    if (inviteErr) {
      throw inviteErr;
    }

    return jsonResponse({
      ok: true,
      message: "Akun staff berhasil dibuat dan langsung ditambahkan ke event.",
      credentials: {
        email,
        username,
        password,
      },
    });
  } catch (err: any) {
    console.error("create-event-staff-account crash:", err);

    return jsonResponse(
      {
        error:
          err?.message ||
          err?.error_description ||
          err?.details ||
          err?.hint ||
          JSON.stringify(err),
      },
      500
    );
  }
});