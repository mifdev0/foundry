"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { CheckCircle2, Circle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { scopedKey } from "@/lib/auth-client";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [registered, setRegistered] = useState(false);

  const loginWithGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase env belum terbaca.");
      return;
    }
    setLoading(true);
    setStatus("");
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setLoading(false);
      setStatus(error.message);
    }
  };
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
      <main className="foundry-canvas-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
        <div className="pointer-events-none fixed inset-0 canvas-grid opacity-60" />
        <section className="foundry-glass relative z-10 w-full max-w-md rounded-[32px] p-6 text-center sm:p-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center">
              <BrandLogo size={56} />
            </div>
          </div>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">Registrasi Berhasil!</h1>
          <p className="mt-4 text-sm font-medium leading-relaxed text-on-surface-variant">
            Kami telah mengirim email verifikasi ke <strong className="text-on-surface">{email}</strong>.
            Silakan cek inbox dan klik link verifikasi untuk mengaktifkan akun kamu.
          </p>
          <Link
            href="/login"
            className="foundry-action mt-8 flex w-full py-4 text-sm"
          >
            Ke Halaman Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="foundry-canvas-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none fixed inset-0 canvas-grid opacity-60" />
      <div className="pointer-events-none fixed -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-primary-fixed-dim/50 blur-[120px]" />
      <div className="pointer-events-none fixed -right-48 bottom-0 h-[600px] w-[600px] rounded-full bg-tertiary-fixed/45 blur-[130px]" />
      {/* Background Hashtags */}
      <div className="fixed top-32 left-[5%] float-hashtag" style={{ animationDelay: '0s' }}>#explore</div>
      <div className="fixed top-64 right-[5%] float-hashtag" style={{ animationDelay: '2s' }}>#create</div>
      <div className="fixed bottom-40 left-[10%] float-hashtag" style={{ animationDelay: '1s' }}>#learn</div>

      <section className="foundry-glass relative z-10 w-full max-w-lg rounded-[32px] p-6 sm:p-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <BrandLogo size={52} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Buat Foundry Account</h1>
            <p className="text-sm font-medium text-on-surface-variant">Mulai journey belajarmu hari ini.</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nama lengkap</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10" placeholder="Fikri Ramdhani" type="text" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10" placeholder="mifdev0" type="text" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10" placeholder="email@domain.com" type="email" />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10"
              placeholder="Minimal 6 karakter"
              type="password"
            />
          </label>
          
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest/40 p-5 backdrop-blur-sm">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div 
                className={`h-full transition-all duration-500 ${passwordScore === 4 ? 'bg-emerald-500' : 'bg-secondary'}`} 
                style={{ width: `${(passwordScore / passwordRules.length) * 100}%` }} 
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {passwordRules.map((rule) => {
                const Icon = rule.valid ? CheckCircle2 : Circle;
                return (
                  <div key={rule.label} className={`flex items-center gap-2 text-xs font-bold transition-colors ${rule.valid ? "text-emerald-600" : "text-on-surface-variant/60"}`}>
                    <Icon size={14} />
                    {rule.label}
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={register} 
            disabled={!formValid || loading} 
            className="foundry-action w-full py-4 text-sm"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Buat Akun Sekarang"
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-bold text-on-surface-variant/60">
          <div className="h-[1px] flex-1 bg-outline-variant/50" />
          <span>ATAU</span>
          <div className="h-[1px] flex-1 bg-outline-variant/50" />
        </div>

        <button
          onClick={loginWithGoogle}
          disabled={loading}
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant bg-white/40 py-3.5 text-sm font-bold text-on-surface transition-all hover:bg-white/80 hover:border-secondary focus:ring-4 focus:ring-secondary/10 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Daftar dengan Google</span>
        </button>

        {status && (
          <div className="mt-6 rounded-xl border border-error/20 bg-error/5 p-3 text-center text-xs font-medium text-error backdrop-blur-sm">
            {status}
          </div>
        )}

        <p className="mt-8 text-center text-sm font-medium text-on-surface-variant">
          Sudah punya akun? <Link className="font-bold text-secondary hover:underline" href="/login">Masuk Disini</Link>
        </p>
      </section>
    </main>
  );
}
