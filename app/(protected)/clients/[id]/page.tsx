"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ClientRow = { id: string; name: string };

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  status: string | null; // IN_PROGRESS | DONE | etc
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at?: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  due_date: string | null;
  last_update_at: string | null;
};

function yyyyMMdd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}
function prettyProjectStatus(s?: string | null) {
  if (!s) return "-";
  if (s === "DONE") return "COMPLETED";
  return s;
}

function pillClass(kind: "overdue" | "stale" | "blocked") {
  if (kind === "overdue") return "bg-red-100 text-red-700";
  if (kind === "stale") return "bg-amber-100 text-amber-700";
  return "bg-gray-200 text-gray-900";
}

function riskBadge(overdue: number, stale: number, blocked: number) {
  if (overdue > 0) return { text: "High risk", cls: "bg-red-100 text-red-700" };
  if (stale > 0) return { text: "Medium risk", cls: "bg-amber-100 text-amber-700" };
  if (blocked > 0) return { text: "Blocked", cls: "bg-gray-200 text-gray-800" };
  return { text: "On track", cls: "bg-green-100 text-green-700" };
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

  const today = yyyyMMdd(new Date());
  const staleCutoff = daysAgoISO(3);

  useEffect(() => {
    if (!clientId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadAll() {
    if (!clientId) return;
    setErr("");
    setLoading(true);

    const cRes = await supabase.from("clients").select("id,name").eq("id", clientId).single();
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    setClient(cRes.data as any);

    const pRes = await supabase
      .from("projects")
      .select("id,client_id,name,status,priority,start_date,due_date,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (pRes.error) {
      setErr(pRes.error.message);
      setLoading(false);
      return;
    }
    const pRows = (pRes.data || []) as any as ProjectRow[];
    setProjects(pRows);

    const ids = pRows.map((p) => p.id);
    if (ids.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const tRes = await supabase
      .from("tasks")
      .select("id,project_id,status,due_date,last_update_at")
      .in("project_id", ids);

    if (tRes.error) {
      setErr(tRes.error.message);
      setLoading(false);
      return;
    }
    setTasks((tRes.data || []) as any);

    setLoading(false);
  }

  const tasksByProject = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of tasks) {
      const arr = m.get(t.project_id) || [];
      arr.push(t);
      m.set(t.project_id, arr);
    }
    return m;
  }, [tasks]);

  // summary numbers for big card
  const summary = useMemo(() => {
    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === "DONE").length;
    const activeProjects = projects.filter((p) => p.status !== "DONE").length;

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === "DONE").length;

    const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;

    const overdueTasks = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today
    ).length;

    const staleTasks = tasks.filter(
      (t) =>
        t.status !== "DONE" &&
        t.status !== "BLOCKED" &&
        t.last_update_at &&
        t.last_update_at <= staleCutoff
    ).length;

    const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    return {
      totalProjects,
      completedProjects,
      activeProjects,
      totalTasks,
      doneTasks,
      overdueTasks,
      staleTasks,
      blockedTasks,
      pct,
    };
  }, [projects, tasks, today, staleCutoff]);

  // list projects rows
  const projectRows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const list = projects.map((p) => {
      const tRows = tasksByProject.get(p.id) || [];

      const total = tRows.length;
      const done = tRows.filter((t) => t.status === "DONE").length;
      const blocked = tRows.filter((t) => t.status === "BLOCKED").length;

      const overdue = tRows.filter(
        (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today
      ).length;

      const stale = tRows.filter(
        (t) =>
          t.status !== "DONE" &&
          t.status !== "BLOCKED" &&
          t.last_update_at &&
          t.last_update_at <= staleCutoff
      ).length;

      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      const r = riskBadge(overdue, stale, blocked);

      return { project: p, total, done, blocked, overdue, stale, pct, risk: r };
    });

    const filtered = needle
      ? list.filter((x) => {
          const p = x.project;
          return (
            p.name.toLowerCase().includes(needle) ||
            (p.status || "").toLowerCase().includes(needle) ||
            (p.priority || "").toLowerCase().includes(needle)
          );
        })
      : list;

    // sort worst first
    filtered.sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.stale !== a.stale) return b.stale - a.stale;
      if (b.blocked !== a.blocked) return b.blocked - a.blocked;
      return a.pct - b.pct;
    });

    return filtered;
  }, [projects, tasksByProject, q, today, staleCutoff]);

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
          <p className="mt-1 text-sm text-gray-600">Client overview + projects list</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
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
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          Error: {err}
        </div>
      )}

      {/* Main big card (same vibe as dashboard cards) */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm text-gray-600">{summary.totalProjects} projects</div>
            <div className="mt-2 grid grid-cols-3 gap-6 text-center md:w-[520px]">
              <div>
                <div className="text-xs font-bold text-gray-600">Active</div>
                <div className="mt-1 text-3xl font-extrabold">{summary.activeProjects}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-600">Completed</div>
                <div className="mt-1 text-3xl font-extrabold">{summary.completedProjects}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-600">Tasks</div>
                <div className="mt-1 text-3xl font-extrabold">{summary.totalTasks}</div>
              </div>
            </div>
          </div>

          <div className="md:text-right">
            <div className="text-xs font-bold text-gray-600">Overall progress</div>
            <div className="mt-1 text-3xl font-extrabold">{summary.pct}%</div>
            <div className="mt-2 w-full md:w-64 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-gray-900" style={{ width: `${summary.pct}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 md:justify-end">
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${pillClass("overdue")}`}>
                Overdue {summary.overdueTasks}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${pillClass("stale")}`}>
                Stale {summary.staleTasks}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${pillClass("blocked")}`}>
                Blocked {summary.blockedTasks}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-extrabold">Projects</div>
          <div className="w-full md:w-[420px]">
            <div className="relative">
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-10"
                placeholder="Search project / status / priority..."
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

      {/* Projects list table */}
      <div className="mt-6 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-extrabold">Project</th>
              <th className="p-3 font-extrabold">Status</th>
              <th className="p-3 font-extrabold">Priority</th>
              <th className="p-3 font-extrabold">Due</th>
              <th className="p-3 font-extrabold">Progress</th>
              <th className="p-3 font-extrabold">Total</th>
              <th className="p-3 font-extrabold">Done</th>
              <th className="p-3 font-extrabold">Overdue</th>
              <th className="p-3 font-extrabold">Stale</th>
              <th className="p-3 font-extrabold">Blocked</th>
              <th className="p-3 font-extrabold">Risk</th>
              <th className="p-3 font-extrabold">Open</th>
            </tr>
          </thead>

          <tbody>
            {projectRows.map((x) => (
              <tr key={x.project.id} className="border-t border-gray-200">
                <td className="p-3 font-semibold">{x.project.name}</td>
                <td className="p-3">{prettyProjectStatus(x.project.status)}</td>
                <td className="p-3">{x.project.priority || "-"}</td>
                <td className="p-3">{x.project.due_date || "-"}</td>

                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-28 rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-gray-900" style={{ width: `${x.pct}%` }} />
                    </div>
                    <div className="text-xs font-extrabold">{x.pct}%</div>
                  </div>
                </td>

                <td className="p-3">{x.total}</td>
                <td className="p-3">{x.done}</td>

                <td className="p-3">
                  <span className={x.overdue > 0 ? "font-extrabold text-red-700" : ""}>{x.overdue}</span>
                </td>
                <td className="p-3">
                  <span className={x.stale > 0 ? "font-extrabold text-amber-700" : ""}>{x.stale}</span>
                </td>
                <td className="p-3">{x.blocked}</td>

                <td className="p-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${x.risk.cls}`}>{x.risk.text}</span>
                </td>

                <td className="p-3">
                  <Link
                    href={`/projects/${x.project.id}`}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}

            {projectRows.length === 0 && (
              <tr>
                <td colSpan={12} className="p-4 text-sm text-gray-600">
                  No projects.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Notes: completed project = status DONE (displayed as COMPLETED). Overdue/Stale exclude BLOCKED tasks.
      </div>
    </div>
  );
}
