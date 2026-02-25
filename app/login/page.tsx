"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    window.location.href = "/projects";
  }

  return (
    <div className="mx-auto max-w-sm p-10">
      <h1 className="text-2xl font-extrabold">Login</h1>

      <form onSubmit={onLogin} className="mt-6 space-y-3">
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {msg && <div className="text-sm font-bold text-red-600">{msg}</div>}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
