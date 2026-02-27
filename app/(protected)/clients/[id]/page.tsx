"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ClientRow = { id: string; name: string };

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
};

type TaskRow = { project_id: string; status: string; due_date: string | null; last_update_at: string | null };

function yyyyMMdd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [client, setClient] = useState<ClientRow | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [q, setQ] = useState("");

  useEffect(() => {
    if (!clientId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadAll() {
    if (!clientId) return;

    setErr("");
    setLoading(true);

    // client
    const cRes = await supabase.from("clients").select("id,name").eq("id", clientId).single();
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    setClient(cRes.data as any);

    // projects
    const pRes = await supabase
      .from("projects")
      .select("id,name,status,priority,start_date,due_date")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (pRes.error) {
      setErr(pRes.error.message);
      setLoading(false);
      return;
    }
    const pRows = (pRes.data || []) as any as ProjectRow[];
    setProjects(pRows);

    // tasks (for stats)
    if (pRows.length > 0) {
      const ids = pRows.map((x) => x.id);
      const tRes = await supabase
        .from("tasks")
        .select("project_id,status,due_date,last_update_at")
        .in("project_id", ids);

      if (!tRes.error) setTasks((tRes.data || []) as any);
    } else {
      setTasks([]);
    }

    setLoading(false);
  }

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === "COMPLETED").length;
    const inProgressProjects = projects.filter((p) => p.status === "IN_PROGRESS").length;

    // task risk
    const today = yyyyMMdd(new Date());
    const staleCutoff = daysAgoISO(3);

    const overdue = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today
    ).length;

    const stale = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.last_update_at && t.last_update_at <= staleCutoff
    ).length;

    return { totalProjects, completedProjects, inProgressProjects, overdue, stale };
  }, [projects, tasks]);

  const filteredProjects = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) => {
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.status || "").toLowerCase().includes(needle) ||
        (p.priority || "").toLowerCase().includes(needle)
      );
    });
  }, [projects, q]);

  if (!clientId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-extrabold">Invalid client id</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{client?.name || "Client"}</h1>
          <p className="mt-1 text-sm text-gray-600">Client overview + list projects.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/clients"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50"
          >
            Back
          </Link>

          <button
            onClick={loadAll}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <Link
            href={`/projects/create?clientId=${clientId}`}
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

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Projects</div>
          <div className="mt-2 text-3xl font-extrabold">{stats.totalProjects}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">In progress</div>
          <div className="mt-2 text-3xl font-extrabold text-amber-700">{stats.inProgressProjects}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Completed</div>
          <div className="mt-2 text-3xl font-extrabold text-green-700">{stats.completedProjects}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Overdue tasks</div>
          <div className="mt-2 text-3xl font-extrabold text-red-700">{stats.overdue}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Stale tasks</div>
          <div className="mt-2 text-3xl font-extrabold text-amber-700">{stats.stale}</div>
        </div>
      </div>

      {/* Search + table */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-extrabold">Projects</div>

          <div className="w-full md:w-[360px]">
            <div className="relative">
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-10"
                placeholder="Search project..."
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

      <div className="mt-4 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-extrabold">Project</th>
              <th className="p-3 font-extrabold">Status</th>
              <th className="p-3 font-extrabold">Priority</th>
              <th className="p-3 font-extrabold">Start</th>
              <th className="p-3 font-extrabold">Due</th>
              <th className="p-3 font-extrabold">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id} className="border-t border-gray-200">
                <td className="p-3 font-semibold">
                  <Link href={`/projects/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </td>

                <td className="p-3">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-extrabold",
                      p.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {p.status}
                  </span>
                </td>

                <td className="p-3">{p.priority || "-"}</td>
                <td className="p-3">{p.start_date || "-"}</td>
                <td className="p-3">{p.due_date || "-"}</td>

                <td className="p-3">
                  <Link
                    href={`/projects/${p.id}`}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-extrabold hover:bg-gray-50"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}

            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No projects.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}