import { createClient } from "@supabase/supabase-js";

export const foundryUserId = process.env.FOUNDRY_USER_ID ?? "00000000-0000-4000-8000-000000000001";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return null;
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function getAuthenticatedUser(request: Request) {
  const supabase = getSupabaseAdmin();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!supabase || !token) {
    return { supabase, user: null, error: "Unauthorized" };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }

  return { supabase, user: data.user, error: null };
}
