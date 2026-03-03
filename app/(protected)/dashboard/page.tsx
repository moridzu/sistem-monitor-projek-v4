"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Layers,
} from "lucide-react";

type Client = {
  id: string;
  name: string;
};

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  status: string | null;
  due_date: string | null;
};

type ServiceRow = {
  id: string;
  project_id: string;
  type: string;
  quantity: number | null;
};

type TaskRow = {
  id: string;
  project_id: string | null;
  status: string | null; // "TODO" | "DONE"
};

function yyyyMMdd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const [cRes, pRes, sRes, tRes] = await Promise.all([
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase
          .from("projects")
          .select("id,client_id,name,status,due_date")
          .order("due_date", { ascending: true }),
        supabase.from("services").select("id,project_id,type,quantity"),
        supabase.from("tasks").select("id,project_id,status"),
      ]);

      if (cRes.error) throw cRes.error;
      if (pRes.error) throw pRes.error;
      if (sRes.error) throw sRes.error;
      if (tRes.error) throw tRes.error;

      setClients(cRes.data as Client[]);
      setProjects(pRes.data as ProjectRow[]);
      setServices(sRes.data as ServiceRow[]);
      setTasks(tRes.data as TaskRow[]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const today = yyyyMMdd(new Date());

  const projectsByClient = useMemo(() => {
    const m = new Map<string, ProjectRow[]>();
    for (const p of projects) {
      const arr = m.get(p.client_id) || [];
      arr.push(p);
      m.set(p.client_id, arr);
    }
    return m;
  }, [projects]);

  const projectToClient = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.client_id);
    return m;
  }, [projects]);

  const serviceTotalsByClient = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const s of services) {
      const clientId = projectToClient.get(s.project_id);
      if (!clientId) continue;
      const qty = s.quantity || 0;
      const bag = m.get(clientId) || {};
      bag[s.type] = (bag[s.type] || 0) + qty;
      m.set(clientId, bag);
    }
    return m;
  }, [services, projectToClient]);

  // ✅ Task aggregation per project (fast, no filter in loop)
  const taskAggByProject = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.project_id) continue;
      const bag = m.get(t.project_id) || { total: 0, done: 0 };
      bag.total += 1;
      if ((t.status || "").toUpperCase() === "DONE") bag.done += 1;
      m.set(t.project_id, bag);
    }
    return m;
  }, [tasks]);

  const progressByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const [projectId, agg] of taskAggByProject.entries()) {
      const pct = agg.total === 0 ? 0 : Math.round((agg.done / agg.total) * 100);
      m.set(projectId, pct);
    }
    return m;
  }, [taskAggByProject]);

  // Global stats: project-based + task-based progress %
  const globalStats = useMemo(() => {
    const totalProjects = projects.length;
    const doneProjects = projects.filter((p) => (p.status || "").toUpperCase() === "DONE").length;
    const overdueProjects = projects.filter(
      (p) => (p.status || "").toUpperCase() !== "DONE" && p.due_date && p.due_date < today
    ).length;

    let totalTasks = 0;
    let doneTasks = 0;
    for (const agg of taskAggByProject.values()) {
      totalTasks += agg.total;
      doneTasks += agg.done;
    }
    const progressPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    return {
      totalProjects,
      doneProjects,
      activeProjects: totalProjects - doneProjects,
      overdueProjects,
      totalTasks,
      doneTasks,
      progressPct, // ✅ based on tasks
    };
  }, [projects, today, taskAggByProject]);

  if (loading && clients.length === 0) return <DashboardSkeleton />;

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Dashboard Utama</h1>
          <p className="text-gray-500">Ringkasan prestasi projek bagi setiap client.</p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-bold shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      {/* Global Stats Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Jumlah Client" value={clients.length} icon={<Users className="text-blue-600" />} />
        <StatCard label="Projek Aktif" value={globalStats.activeProjects} icon={<Briefcase className="text-amber-600" />} />
        <StatCard label="Projek DONE" value={globalStats.doneProjects} icon={<CheckCircle2 className="text-green-600" />} />
        <StatCard label="% Progress" value={`${globalStats.progressPct}%`} icon={<Clock className="text-indigo-600" />} />
        <StatCard label="Overdue" value={globalStats.overdueProjects} icon={<AlertCircle className="text-red-600" />} color="text-red-600" />
      </div>

      {/* Global Progress Bar (based on tasks) */}
      <div className="mb-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-black text-gray-900">Progress Keseluruhan</div>
          <div className="text-xs font-extrabold text-gray-500">
            {globalStats.doneTasks}/{globalStats.totalTasks} task siap • {globalStats.progressPct}%
          </div>
        </div>
        <ProgressBar pct={globalStats.progressPct} />
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p className="font-bold">{err}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => {
          const cProjects = projectsByClient.get(c.id) || [];

          // ✅ client progress based on tasks (sum all projects)
          let totalTasks = 0;
          let doneTasks = 0;
          for (const p of cProjects) {
            const agg = taskAggByProject.get(p.id);
            if (!agg) continue;
            totalTasks += agg.total;
            doneTasks += agg.done;
          }
          const donePct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

          const totalProjects = cProjects.length;
          const doneProjects = cProjects.filter((p) => (p.status || "").toUpperCase() === "DONE").length;
          const overdueCount = cProjects.filter(
            (p) => (p.status || "").toUpperCase() !== "DONE" && p.due_date && p.due_date < today
          ).length;

          const serviceTotals = serviceTotalsByClient.get(c.id) || {};
          const servicePairs = Object.entries(serviceTotals).sort((a, b) => b[1] - a[1]);

          return (
            <div
              key={c.id}
              className="group relative flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {c.name}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                    <span>{totalProjects} Projek</span>
                    <span>•</span>
                    <span className="text-green-600">{doneProjects} DONE</span>
                    <span>•</span>
                    <span className="text-indigo-600">{donePct}%</span>
                    <span>•</span>
                    <span className="text-gray-500">
                      {doneTasks}/{totalTasks} task
                    </span>
                  </div>
                </div>

                <Link
                  href={`/clients/${c.id}`}
                  className="shrink-0 rounded-full bg-gray-50 p-2 text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
                >
                  <ChevronRight size={20} />
                </Link>
              </div>

              {/* Mini progress bar per client (based on tasks) */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Progress Client (Task)
                  </div>
                  <div className="text-[10px] font-black text-gray-500">
                    {doneTasks}/{totalTasks}
                  </div>
                </div>
                <ProgressBar pct={donePct} />
              </div>

              {/* Service Summary Pills */}
              <div className="mb-6 flex-1">
                <div className="mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <Layers size={12} />
                  Kandungan Servis
                </div>
                {servicePairs.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Tiada servis direkodkan.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {servicePairs.map(([type, total]) => (
                      <div
                        key={type}
                        className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 transition-colors hover:bg-white hover:border-gray-200"
                      >
                        <span className="max-w-[100px] truncate text-[11px] font-bold text-gray-700">{type}</span>
                        <span className="ml-2 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mini Project List */}
              <div className="border-t border-gray-100 pt-5">
                <div className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Projek Terkini
                </div>

                {cProjects.length === 0 ? (
                  <p className="text-xs text-gray-400">Tiada projek.</p>
                ) : (
                  <div className="space-y-3">
                    {cProjects.slice(0, 3).map((p) => {
                      const isOverdue =
                        (p.status || "").toUpperCase() !== "DONE" && p.due_date && p.due_date < today;

                      const pct = progressByProject.get(p.id) ?? 0;
                      const agg = taskAggByProject.get(p.id) || { total: 0, done: 0 };

                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center justify-between gap-3 group/item"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-700 group-hover/item:text-blue-600 transition-colors">
                              {p.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-black text-gray-500">
                              <span className="text-indigo-600">{pct}%</span>
                              <span>•</span>
                              <span>
                                {agg.done}/{agg.total} task
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tight ${
                                (p.status || "").toUpperCase() === "DONE"
                                  ? "bg-green-100 text-green-700"
                                  : isOverdue
                                  ? "bg-red-100 text-red-700 animate-pulse"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {isOverdue ? "Overdue" : p.status || "N/A"}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {overdueCount > 0 && (
                <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg ring-4 ring-white">
                  {overdueCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-gray-900",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="rounded-lg bg-gray-50 p-2">{icon}</div>
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-tight">{label}</div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const p = clamp(pct);
  const barClass = p >= 80 ? "bg-green-600" : p >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="w-full">
      <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-2.5 rounded-full ${barClass} transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl p-6 animate-pulse">
      <div className="mb-8 h-12 w-1/3 rounded-xl bg-gray-200" />
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-80 rounded-3xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}