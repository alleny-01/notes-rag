/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

async function deleteAuthUser(
  url: string,
  serviceRoleKey: string,
  userId: string,
) {
  // This is the same Supabase Auth Admin API used by auth.admin.deleteUser,
  // expressed as its documented HTTP endpoint to avoid editor/runtime type gaps.
  const response = await fetch(
    `${url.replace(/\/$/, "")}/auth/v1/admin/users/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );
  if (!response.ok)
    throw new Error(`Auth user deletion failed (${response.status}).`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return jsonResponse({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anon || !service || !authorization)
    return jsonResponse(
      { error: "Function configuration is incomplete." },
      500,
    );
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user)
    return jsonResponse({ error: "Unauthorized." }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  async function removeFolder(bucket: string, prefix: string): Promise<void> {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });
    if (error) {
      // A project created before the PDF viewer may not have the optional pages bucket.
      if (bucket === "notes-pages") return;
      throw error;
    }
    const objects: string[] = [];
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) objects.push(path);
      else await removeFolder(bucket, path);
    }
    if (objects.length) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(objects);
      if (removeError) throw removeError;
    }
  }
  try {
    await removeFolder("notes-documents", auth.user.id);
    await removeFolder("notes-pages", auth.user.id);
    await deleteAuthUser(url, service, auth.user.id);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(
      "delete-account failed",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse({ error: "We could not delete this account." }, 500);
  }
});
