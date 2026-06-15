import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-admin";

function defaultProfile(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    full_name: String(metadata.full_name ?? "User"),
    username: String(metadata.username ?? user.email?.split("@")[0] ?? "user"),
    email: user.email ?? "user@local.test",
    avatar_url: null as string | null
  };
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ profile: null, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ profile: null, error: authError }, { status: 401 });
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json({ profile: null, error: error.message }, { status: 503 });
  }

  if (!data) {
    const { data: created, error: createError } = await supabase.from("profiles").upsert(defaultProfile(user)).select("*").single();

    if (createError) {
      return NextResponse.json({ profile: null, error: createError.message }, { status: 503 });
    }

    return NextResponse.json({ profile: created });
  }

  return NextResponse.json({ profile: data });
}

export async function PUT(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const body = (await request.json()) as {
    full_name?: string;
    username?: string;
    email?: string;
    avatar_url?: string | null;
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: body.full_name?.trim() || defaultProfile(user).full_name,
      username: body.username?.trim() || defaultProfile(user).username,
      email: body.email?.trim() || defaultProfile(user).email,
      avatar_url: body.avatar_url ?? null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
