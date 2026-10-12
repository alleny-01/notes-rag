/// <reference path="../_shared/deno-runtime.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

function dailyLimit() {
  const value = Number(Deno.env.get("DAILY_MESSAGE_LIMIT") ?? "50");
  return Number.isInteger(value) && value > 0 ? value : 50;
}
function resetAt() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anon || !authorization)
    return jsonResponse({ error: "Unauthorized." }, 401);
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    return jsonResponse({ error: "Unauthorized." }, 401);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("usage_daily")
    .select("message_count")
    .eq("user_id", auth.user.id)
    .eq("usage_date", today)
    .maybeSingle<{ message_count: number }>();
  if (error) return jsonResponse({ error: "We could not load usage." }, 500);
  return jsonResponse({
    used: data?.message_count ?? 0,
    limit: dailyLimit(),
    resetAt: resetAt(),
  });
});
