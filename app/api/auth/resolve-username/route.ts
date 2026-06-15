import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json({ email: null, error: "Username wajib diisi" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ email: null, error: "Supabase env belum terisi" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ email: null, error: error.message }, { status: 503 });
  }

  if (!data) {
    return NextResponse.json({ email: null, error: "Username tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ email: data.email });
}
