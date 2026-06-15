"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { Mail, LockKeyhole } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { scopedKey } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  const login = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase env belum terbaca.");
      return;
    }

    setLoading(true);
    setStatus("");
    setNeedsVerification(false);

    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      try {
        const res = await fetch(`/api/auth/resolve-username?username=${encodeURIComponent(loginEmail)}`);
        if (!res.ok) {
          const body = await res.json();
          setStatus(body.error ?? "Username tidak ditemukan.");
          setLoading(false);
          return;
        }
        const body = await res.json();
        if (body.email) {
          loginEmail = body.email;
        } else {
          setStatus("Username tidak ditemukan.");
          setLoading(false);
          return;
        }
      } catch {
        setStatus("Gagal menghubungi server untuk verifikasi username.");
        setLoading(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setLoading(false);
      if (/email not confirmed/i.test(error.message)) {
        setNeedsVerification(true);
        return;
      }
      setStatus(error.message);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      setLoading(false);
      setNeedsVerification(true);
      return;
    }

    const userId = data.user.id;
    const meta = data.user.user_metadata ?? {};
    window.localStorage.setItem(scopedKey(userId, "full-name"), meta.full_name ?? "");
    window.localStorage.setItem(scopedKey(userId, "username"), meta.username ?? "");
    window.localStorage.setItem(scopedKey(userId, "email"), data.user.email ?? "");
    window.localStorage.setItem("foundry-active-user-id", userId);
    window.dispatchEvent(new Event("foundry-profile-updated"));

    setLoading(false);
    router.push("/dashboard");
  };

  return (
    <main className="foundry-canvas-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none fixed inset-0 canvas-grid opacity-60" />
      <div className="pointer-events-none fixed -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-primary-fixed-dim/50 blur-[120px]" />
      <div className="pointer-events-none fixed -right-48 bottom-0 h-[600px] w-[600px] rounded-full bg-tertiary-fixed/45 blur-[130px]" />
      {/* Background Hashtags */}
      <div className="fixed top-32 left-[5%] float-hashtag" style={{ animationDelay: '0s' }}>#learning</div>
      <div className="fixed top-64 right-[5%] float-hashtag" style={{ animationDelay: '2s' }}>#growth</div>
      <div className="fixed bottom-40 left-[10%] float-hashtag" style={{ animationDelay: '1s' }}>#foundry</div>

      <section className="foundry-glass relative z-10 w-full max-w-md rounded-[32px] p-6 sm:p-8">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center">
            <BrandLogo size={56} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Foundry</h1>
          <p className="mt-2 text-sm font-medium text-on-surface-variant">Masuk ke learning workspace.</p>
        </div>

        {needsVerification && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 backdrop-blur-sm">
            <p className="font-bold">Verifikasi email diperlukan</p>
            <p className="mt-1 opacity-90">
              Cek email kamu untuk verifikasi akun sebelum login.
            </p>
          </div>
        )}

        <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email atau username</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-outline-variant bg-white/50 px-4 py-3 transition-all focus-within:border-secondary focus-within:ring-4 focus-within:ring-secondary/10">
              <Mail size={18} className="text-on-surface-variant" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-outline"
                placeholder="email@domain.com atau username"
                type="text"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Password</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-outline-variant bg-white/50 px-4 py-3 transition-all focus-within:border-secondary focus-within:ring-4 focus-within:ring-secondary/10">
              <LockKeyhole size={18} className="text-on-surface-variant" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-outline"
                placeholder="********"
                type="password"
              />
            </div>
          </label>
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs font-bold text-secondary hover:underline">
              Lupa password?
            </Link>
          </div>
          <button
            onClick={login}
            disabled={!email.trim() || !password || loading}
            className="foundry-action w-full py-4 text-sm"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Masuk ke Workspace"
            )}
          </button>
        </form>

        {status && (
          <div className="mt-6 rounded-xl border border-error/20 bg-error/5 p-3 text-center text-xs font-medium text-error backdrop-blur-sm">
            {status}
          </div>
        )}

        <p className="mt-8 text-center text-sm font-medium text-on-surface-variant">
          Belum punya akun? <Link className="font-bold text-secondary hover:underline" href="/register">Buat Akun Baru</Link>
        </p>
      </section>
    </main>
  );
}
