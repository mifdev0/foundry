"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { CheckCircle2, Circle, KeyRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const rules = useMemo(
    () => [
      { label: "Minimal 6 karakter", valid: password.length >= 6 },
      { label: "Ada huruf kecil", valid: /[a-z]/.test(password) },
      { label: "Ada huruf kapital", valid: /[A-Z]/.test(password) },
      { label: "Ada angka", valid: /\d/.test(password) }
    ],
    [password]
  );
  const score = rules.filter((rule) => rule.valid).length;
  const valid = score === rules.length;

  const submit = async () => {
    if (!valid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase env belum terbaca.");
      return;
    }

    setLoading(true);
    setStatus("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    setStatus(error ? error.message : "Password baru tersimpan. Kamu bisa login lagi.");
  };

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-5 sm:p-8 shadow-ambient">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Reset Password</h1>
            <p className="text-sm text-on-variant">Masukkan password baru untuk akun kamu.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Password baru</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="Minimal 6 karakter" type="password" />
          </label>
          <div className="rounded-xl border border-outline-variant bg-surface-low/60 p-3">
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${(score / rules.length) * 100}%` }} />
            </div>
            <div className="mt-3 grid gap-2">
              {rules.map((rule) => {
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
          <button onClick={submit} disabled={loading || !valid} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-container/20 disabled:cursor-not-allowed disabled:bg-slate-300">
            <KeyRound size={17} /> {loading ? "Menyimpan..." : "Simpan Password Baru"}
          </button>
        </form>
        {status && <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-variant">{status}</div>}
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-primary">
          Kembali ke login
        </Link>
      </section>
    </main>
  );
}
