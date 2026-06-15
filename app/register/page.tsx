"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { CheckCircle2, Circle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { scopedKey } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [registered, setRegistered] = useState(false);
  const passwordRules = useMemo(
    () => [
      { label: "Minimal 6 karakter", valid: password.length >= 6 },
      { label: "Ada huruf kecil", valid: /[a-z]/.test(password) },
      { label: "Ada huruf kapital", valid: /[A-Z]/.test(password) },
      { label: "Ada angka", valid: /\d/.test(password) }
    ],
    [password]
  );
  const passwordScore = passwordRules.filter((rule) => rule.valid).length;
  const passwordValid = passwordScore === passwordRules.length;
  const formValid = fullName.trim() && username.trim() && email.trim() && passwordValid;

  const register = async () => {
    if (!formValid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase env belum terbaca.");
      return;
    }

    setLoading(true);
    setStatus("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          username: username.trim()
        }
      }
    });

    if (error) {
      setLoading(false);
      setStatus(error.message);
      return;
    }

    const userId = data.user?.id ?? "guest";
    window.localStorage.setItem(scopedKey(userId, "full-name"), fullName.trim());
    window.localStorage.setItem(scopedKey(userId, "username"), username.trim());
    window.localStorage.setItem(scopedKey(userId, "email"), email.trim());
    window.localStorage.setItem("foundry-active-user-id", userId);
    window.dispatchEvent(new Event("foundry-profile-updated"));

    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          avatar_url: null
        })
      });
    } catch {
      // Local profile cache is enough for the current session.
    }

    setLoading(false);
    setRegistered(true);
  };

  if (registered) {
    return (
      <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
        <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-5 sm:p-8 shadow-ambient text-center">
          <div className="mb-6 flex justify-center">
            <BrandLogo size={44} />
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface">Registrasi Berhasil!</h1>
          <p className="mt-3 text-sm leading-relaxed text-on-variant">
            Kami telah mengirim email verifikasi ke <strong className="text-on-surface">{email}</strong>.
            Silakan cek inbox (atau folder spam) dan klik link verifikasi untuk mengaktifkan akun kamu.
          </p>
          <Link
            href="/login"
            className="mt-6 block rounded-lg bg-primary-container px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-primary-container/20"
          >
            Ke Halaman Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-xl rounded-2xl border border-outline-variant bg-white p-5 sm:p-8 shadow-ambient">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Buat Foundry Account</h1>
            <p className="text-sm text-on-variant">Profil MVP untuk mulai menyusun roadmap.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Nama lengkap</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="Muhammad Fikri Ramdhani" type="text" />
          </label>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="mifdev0" type="text" />
          </label>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="email@domain.com" type="email" />
          </label>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
              placeholder="Minimal 6 karakter"
              type="password"
            />
          </label>
          <div className="rounded-xl border border-outline-variant bg-surface-low/60 p-3">
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${(passwordScore / passwordRules.length) * 100}%` }} />
            </div>
            <div className="mt-3 grid gap-2">
              {passwordRules.map((rule) => {
                const Icon = rule.valid ? CheckCircle2 : Circle;
                return (
                  <div key={rule.label} className={rule.valid ? "flex items-center gap-2 text-sm font-semibold text-emerald-700" : "flex items-center gap-2 text-sm text-on-variant"}>
                    <Icon size={16} />
                    {rule.label}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={register} disabled={!formValid || loading} className="block w-full rounded-lg bg-primary-container px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-primary-container/20 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Mendaftarkan..." : "Register"}
          </button>
        </form>
        {status && <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-variant">{status}</div>}
        <p className="mt-6 text-center text-sm text-on-variant">
          Sudah punya akun? <Link className="font-semibold text-primary" href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
