import { supabase } from "../../lib/supabaseClient";
import { mergeSettings, type UserSettings } from "./settings";

export async function loadUserSettings() {
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .maybeSingle<{ settings: Partial<UserSettings> }>();
  if (error) throw new Error(error.message);
  return mergeSettings(data?.settings);
}
export async function saveUserSettings(settings: UserSettings) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    throw new Error("Your session has ended. Sign in again to continue.");
  const { error } = await supabase.from("user_settings").upsert({
    user_id: auth.user.id,
    settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
export async function getUsage() {
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    string | undefined;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!token || !key || !url) throw new Error("Your session is unavailable.");
  const response = await fetch(
    `${url.replace(/\/$/, "")}/functions/v1/get-usage`,
    { headers: { Authorization: `Bearer ${token}`, apikey: key } },
  );
  if (!response.ok) throw new Error("We could not load today’s usage.");
  return response.json() as Promise<{
    used: number;
    limit: number;
    resetAt: string;
  }>;
}
