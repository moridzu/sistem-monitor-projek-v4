"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle } from "lucide-react";

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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: eTrim,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      router.replace("/projects");
    } catch (err) {
      setMsg("Berlaku ralat teknikal. Sila cuba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white mb-4 shadow-lg">
            <Lock size={24} />
          </div>
          <h2 className="text-sm font-bold tracking-widest text-gray-500 uppercase">
            Etcetera Vision
          </h2>
          <h1 className="mt-2 text-3xl font-extrabold text-gray-900">
            Sistem Monitor Projek
          </h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">Log Masuk</h2>
            <p className="text-sm text-gray-500">
              Masukkan info anda untuk akses dashboard.
            </p>
          </div>

          <form onSubmit={onLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                Email Anda
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition-all focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none"
                  placeholder="admin@etcetera.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-12 text-sm transition-all focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/10 outline-none"
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {msg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>{msg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sila Tunggu...
                </>
              ) : (
                "Masuk Dashboard"
              )}
            </button>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Lupa password?{" "}
                <button 
                  type="button" 
                  onClick={() => alert("Sila hubungi admin sistem (IT) untuk reset.")}
                  className="font-bold text-gray-900 hover:underline"
                >
                  Hubungi Admin
                </button>
              </p>
            </div>
          </form>
        </div>
        
        <p className="mt-8 text-center text-[10px] uppercase tracking-widest text-gray-400 font-medium">
          © {new Date().getFullYear()} Etcetera Vision Sdn Bhd
        </p>
      </div>
    </div>
  );
}