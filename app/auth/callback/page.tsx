"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { scopedKey } from "@/lib/auth-client";
import BrandLogo from "@/components/brand-logo";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Memproses verifikasi...");

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setStatus("Supabase env belum terbaca.");
        return;
      }

      // Supabase JS SDK secara otomatis mendeteksi parameter '?code=' 
      // di URL dan menukarnya menjadi session aktif di client-side.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`Verifikasi gagal: ${error.message}`);
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      if (session?.user) {
        const user = session.user;
        const userId = user.id;
        const meta = user.user_metadata ?? {};

        // Simpan data profile lokal untuk session ini
        window.localStorage.setItem(scopedKey(userId, "full-name"), meta.full_name ?? "User");
        window.localStorage.setItem(scopedKey(userId, "username"), meta.username ?? user.email?.split("@")[0] ?? "user");
        window.localStorage.setItem(scopedKey(userId, "email"), user.email ?? "");
        window.localStorage.setItem("foundry-active-user-id", userId);
        
        // Trigger event agar dashboard memperbarui state profile
        window.dispatchEvent(new Event("foundry-profile-updated"));

        setStatus("Verifikasi sukses! Mengalihkan ke dashboard...");
        router.push("/dashboard");
      } else {
        // Jika tidak ada session, mungkin link kadaluarsa atau sudah terverifikasi sebelumnya
        // Coba cek user sekali lagi
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userId = user.id;
          const meta = user.user_metadata ?? {};
          window.localStorage.setItem(scopedKey(userId, "full-name"), meta.full_name ?? "User");
          window.localStorage.setItem(scopedKey(userId, "username"), meta.username ?? user.email?.split("@")[0] ?? "user");
          window.localStorage.setItem(scopedKey(userId, "email"), user.email ?? "");
          window.localStorage.setItem("foundry-active-user-id", userId);
          window.dispatchEvent(new Event("foundry-profile-updated"));
          
          setStatus("Verifikasi sukses! Mengalihkan ke dashboard...");
          router.push("/dashboard");
        } else {
          setStatus("Session tidak ditemukan. Mengalihkan ke halaman login...");
          setTimeout(() => router.push("/login"), 2000);
        }
      }
    };

    void handleCallback();
  }, [router]);

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-8 shadow-ambient text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo size={44} />
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-container border-t-transparent" />
          <h1 className="text-xl font-bold text-on-surface">Verifikasi Akun</h1>
          <p className="text-sm text-on-variant">{status}</p>
        </div>
      </section>
    </main>
  );
}
