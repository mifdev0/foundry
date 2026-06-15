"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getCurrentUserId() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "guest";

  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "guest";
}

export function scopedKey(userId: string, key: string) {
  return `foundry:${userId}:${key}`;
}
