import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdmin } from "@/lib/supabase-admin";

const bucketName = "avatars";

async function ensureAvatarBucket(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { error } = await supabase.storage.getBucket(bucketName);

  if (!error) return null;

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"]
  });

  return createError;
}

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "File avatar wajib diisi" }, { status: 400 });
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Format avatar harus PNG, JPG, atau WEBP" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Ukuran avatar maksimal 2MB" }, { status: 400 });
  }

  const bucketError = await ensureAvatarBucket(supabase);

  if (bucketError) {
    return NextResponse.json({ ok: false, error: bucketError.message }, { status: 503 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, buffer, {
    contentType: file.type,
    upsert: true
  });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 503 });
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  const avatarUrl = data.publicUrl;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: String(user.user_metadata?.full_name ?? "User"),
    username: String(user.user_metadata?.username ?? user.email?.split("@")[0] ?? "user"),
    email: user.email ?? "user@local.test",
    avatar_url: avatarUrl
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, avatar_url: avatarUrl });
}

export async function DELETE(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
