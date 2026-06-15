"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/avatar";
import BrandLogo from "@/components/brand-logo";
import { ArrowLeft, Camera, KeyRound, Save, Trash2 } from "lucide-react";
import { getAuthHeaders, getCurrentUserId, scopedKey } from "@/lib/auth-client";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const userId = await getCurrentUserId();
      setFullName(window.localStorage.getItem(scopedKey(userId, "full-name")) ?? "User");
      setUsername(window.localStorage.getItem(scopedKey(userId, "username")) ?? "user");
      setEmail(window.localStorage.getItem(scopedKey(userId, "email")) ?? "");
      setAvatar(window.localStorage.getItem(scopedKey(userId, "avatar")) ?? "");

      try {
        const response = await fetch("/api/profile", { cache: "no-store", headers: await getAuthHeaders() });
        if (!response.ok) return;

        const body = (await response.json()) as {
          profile?: { full_name?: string; username?: string; email?: string; avatar_url?: string | null };
        };
        const profile = body.profile;
        if (!profile) return;

        setFullName(profile.full_name ?? "User");
        setUsername(profile.username ?? "user");
        setEmail(profile.email ?? "");
        setAvatar(profile.avatar_url ?? "");
        window.localStorage.setItem(scopedKey(userId, "full-name"), profile.full_name ?? "User");
        window.localStorage.setItem(scopedKey(userId, "username"), profile.username ?? "user");
        window.localStorage.setItem(scopedKey(userId, "email"), profile.email ?? "");
        if (profile.avatar_url) window.localStorage.setItem(scopedKey(userId, "avatar"), profile.avatar_url);
      } catch {
        setStatus("Profil DB belum bisa dimuat, memakai cache lokal.");
      }
    };

    void loadProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const userId = await getCurrentUserId();
    window.localStorage.setItem(scopedKey(userId, "full-name"), fullName);
    window.localStorage.setItem(scopedKey(userId, "username"), username);
    window.localStorage.setItem(scopedKey(userId, "email"), email);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          avatar_url: avatar || null
        })
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Gagal menyimpan profil ke DB.");
      setStatus("Profil tersimpan ke database.");
    } catch (error) {
      setStatus(error instanceof Error ? `${error.message} Profil tetap disimpan lokal.` : "Profil tersimpan lokal.");
    } finally {
      window.dispatchEvent(new Event("foundry-profile-updated"));
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setStatus("Format avatar harus PNG, JPG, atau WEBP.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus("Ukuran avatar maksimal 2MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: formData
      });
      const body = (await response.json()) as { avatar_url?: string; error?: string };
      if (!response.ok || !body.avatar_url) throw new Error(body.error ?? "Upload avatar gagal.");

      setAvatar(body.avatar_url);
      const userId = await getCurrentUserId();
      window.localStorage.setItem(scopedKey(userId, "avatar"), body.avatar_url);
      window.dispatchEvent(new Event("foundry-profile-updated"));
      setStatus("Avatar tersimpan ke Supabase Storage.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload avatar gagal.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeAvatar = async () => {
    setAvatar("");
    const userId = await getCurrentUserId();
    window.localStorage.removeItem(scopedKey(userId, "avatar"));

    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE", headers: await getAuthHeaders() });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Gagal menghapus avatar di DB.");
      setStatus("Avatar dihapus dari database.");
    } catch (error) {
      setStatus(error instanceof Error ? `${error.message} Avatar tetap dihapus lokal.` : "Avatar dihapus lokal.");
    } finally {
      window.dispatchEvent(new Event("foundry-profile-updated"));
    }
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <section className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft size={17} /> Kembali ke dashboard
        </Link>
        <div className="rounded-2xl border border-outline-variant bg-white p-8 shadow-ambient">
          <div className="flex items-center gap-3">
            <BrandLogo size={44} />
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="mt-1 text-sm text-on-variant">Kelola profil akun dan avatar Foundry.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 border-b border-outline-variant pb-6">
            {avatar ? <img src={avatar} alt="Avatar profil" className="h-20 w-20 rounded-full object-cover" /> : <Avatar size={80} />}
            <input ref={fileRef} onChange={uploadAvatar} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface disabled:cursor-not-allowed disabled:bg-slate-100">
              <Camera size={17} /> {uploading ? "Uploading..." : "Upload avatar"}
            </button>
            {avatar && (
              <button onClick={removeAvatar} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                <Trash2 size={17} /> Hapus avatar
              </button>
            )}
          </div>

          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Nama lengkap</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" />
            </label>
            <label className="block">
              <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" />
            </label>
            <label className="block">
              <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" type="email" />
            </label>
            <label className="block">
              <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Password lama</span>
              <input className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" type="password" />
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-3 text-sm font-bold text-on-surface">
              <KeyRound size={17} /> Ganti password
            </button>
            <button onClick={() => void saveProfile()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              <Save size={17} /> {saving ? "Menyimpan..." : "Simpan profil"}
            </button>
          </form>
          {status && <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-variant">{status}</div>}
        </div>
      </section>
    </main>
  );
}
