"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !loading;
  }, [email, password, loading]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const eTrim = email.trim();
    if (!eTrim || !password) {
      setMsg("Sila isi email dan password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: eTrim,
      password,
    });
    setLoading(false);

    if (error) {
      // msg supabase kadang-kadang panjang, tapi ok
      setMsg(error.message);
      return;
    }

    router.replace("/projects");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-sm font-extrabold text-gray-900">
              Sistem Monitor Projek (Etcetera Vision)
            </div>
            <h1 className="mt-1 text-2xl font-extrabold">Log masuk</h1>
            <p className="mt-1 text-sm text-gray-500">
              Masukkan email & password untuk akses dashboard.
            </p>
          </div>

          <form onSubmit={onLogin} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                Email
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
                placeholder="contoh: admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                Password
              </label>

              <div className="flex items-stretch gap-2">
                <input
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="rounded-xl border border-gray-300 bg-white px-3 text-xs font-extrabold hover:bg-gray-50"
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {msg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {msg}
              </div>
            )}

            <button
              disabled={!canSubmit}
              className="mt-2 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className="pt-2 text-center text-[11px] text-gray-500">
              Lupa password? Hahahaha. Xpe, roger je bro.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}