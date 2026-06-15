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
