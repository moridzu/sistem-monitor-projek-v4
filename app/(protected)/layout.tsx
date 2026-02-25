"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type NavItem = {
  href: string;
  label: string;
};

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>("");

  const nav: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/projects", label: "Projects" },
      { href: "/projects/create", label: "Create Project" },
      { href: "/follow-ups", label: "Follow-ups" },
    ],
    []
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setEmail(data.session.user.email || "");
      setReady(true);
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-extrabold text-gray-800">Checking session…</div>
          <div className="mt-2 text-xs text-gray-500">Redirecting to login if needed.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="sticky top-0 h-screen w-[260px] border-r border-gray-200 bg-white">
          <div className="p-5">
            <div className="text-lg font-extrabold tracking-tight">Sistem Monitor Projek</div>
            <div className="mt-1 text-xs text-gray-500">{email || "Logged in"}</div>
          </div>

          <nav className="px-3">
            <div className="space-y-1">
              {nav.map((n) => {
                const active =
                  pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));

                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={[
                      "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-extrabold transition",
                      active ? "bg-gray-900 text-white" : "text-gray-800 hover:bg-gray-100",
                    ].join(" ")}
                  >
                    <span>{n.label}</span>
                    {active && <span className="text-xs opacity-80">•</span>}
                  </Link>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                onClick={logout}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Tip: guna <b>Follow-ups</b> untuk chase overdue & stale terus WhatsApp.
            </div>
          </nav>
        </aside>

        {/* MAIN */}
        <main className="w-full">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
