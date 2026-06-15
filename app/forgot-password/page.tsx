"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (!email.trim()) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase env belum terbaca.");
      return;
    }

    setLoading(true);
    setStatus("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    setStatus(error ? error.message : "Link reset password sudah dikirim. Cek email kamu.");
  };

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-8 shadow-ambient">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={44} />
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Lupa Password</h1>
            <p className="text-sm text-on-variant">Kirim link reset ke email akun kamu.</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">Email</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-container/20">
              <Mail size={18} className="text-on-variant" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border-0 bg-transparent p-0 text-sm outline-none ring-0 focus:ring-0" placeholder="email@domain.com" type="email" />
            </span>
          </label>
          <button onClick={submit} disabled={loading || !email.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-container/20 disabled:cursor-not-allowed disabled:bg-slate-300">
            <Send size={17} /> {loading ? "Mengirim..." : "Kirim Link Reset"}
          </button>
        </form>
        {status && <div className="mt-4 rounded-lg border border-outline-variant bg-surface-low px-3 py-2 text-sm text-on-variant">{status}</div>}
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft size={16} /> Kembali ke login
        </Link>
      </section>
    </main>
  );
}
