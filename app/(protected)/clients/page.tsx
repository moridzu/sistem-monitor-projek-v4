"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ClientRow = {
  id: string;
  name: string;
  created_at?: string;
};

type ProjectRow = {
  id: string;
  client_id: string;
  status: string;
};

export default function ClientsListPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setErr("");
    setLoading(true);

    // clients
    const cRes = await supabase.from("clients").select("id,name,created_at").order("name", { ascending: true });
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    setClients((cRes.data || []) as any);

    // projects (for counts)
    const pRes = await supabase.from("projects").select("id,client_id,status");
    if (!pRes.error) setProjects((pRes.data || []) as any);

    setLoading(false);
  }

  const countsByClient = useMemo(() => {
    const map: Record<string, { total: number; inProgress: number; completed: number }> = {};
    for (const c of clients) map[c.id] = { total: 0, inProgress: 0, completed: 0 };

    for (const p of projects) {
      const x = map[p.client_id];
      if (!x) continue;
      x.total += 1;
      if (p.status === "IN_PROGRESS") x.inProgress += 1;
      if (p.status === "COMPLETED") x.completed += 1;
    }
    return map;
  }, [clients, projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(needle));
  }, [clients, q]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Clients</h1>
          <p className="mt-1 text-sm text-gray-600">List of clients. Click name to view their projects.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <Link
            href="/projects/create"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-90"
          >
            + Create Project
          </Link>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          Error: {err}
        </div>
      )}

      {/* Search */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-extrabold">Search</div>

          <div className="w-full md:w-[360px]">
            <div className="relative">
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-10"
                placeholder="Search client name..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q.trim() && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-extrabold text-gray-600 hover:bg-gray-100"
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-extrabold">Client</th>
              <th className="p-3 font-extrabold">Projects</th>
              <th className="p-3 font-extrabold">In progress</th>
              <th className="p-3 font-extrabold">Completed</th>
              <th className="p-3 font-extrabold">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((c) => {
              const x = countsByClient[c.id] || { total: 0, inProgress: 0, completed: 0 };

              return (
                <tr key={c.id} className="border-t border-gray-200">
                  <td className="p-3 font-semibold">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>

                  <td className="p-3">{x.total}</td>

                  <td className="p-3">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
                      {x.inProgress}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-extrabold text-green-700">
                      {x.completed}
                    </span>
                  </td>

                  <td className="p-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-extrabold hover:bg-gray-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No clients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Tip: Client detail page akan show semua projects client tu.
      </div>
    </div>
  );
}