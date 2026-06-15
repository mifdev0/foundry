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
      } catch (err) {
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
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-8 shadow-ambient">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Foundry</h1>
            <p className="text-sm text-on-variant">Masuk ke learning workspace.</p>
          </div>
        </div>

        {needsVerification && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Verifikasi email diperlukan</p>
            <p className="mt-1">
              Cek email kamu untuk verifikasi akun sebelum login. Klik link verifikasi yang dikirim ke email kamu.
            </p>
          </div>
        )}

        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Email atau username</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-container/20">
              <Mail size={18} className="text-on-variant" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-sm outline-none ring-0 focus:ring-0"
                placeholder="email@domain.com atau username"
                type="text"
              />
            </span>
          </label>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Password</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-container/20">
              <LockKeyhole size={18} className="text-on-variant" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 bg-transparent p-0 text-sm outline-none ring-0 focus:ring-0"
                placeholder="********"
                type="password"
              />
            </span>
          </label>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-primary">
              Lupa password?
            </Link>
          </div>
          <button
            onClick={login}
            disabled={!email.trim() || !password || loading}
            className="block w-full rounded-lg bg-primary-container px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-primary-container/20 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {status && <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-variant">{status}</div>}

        <p className="mt-6 text-center text-sm text-on-variant">
          Belum punya akun? <Link className="font-semibold text-primary" href="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
