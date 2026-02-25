"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Client = {
  id: string;
  name: string;
};

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  status: string | null; // IN_PROGRESS / DONE
  due_date: string | null;
};

type ServiceRow = {
  id: string;
  project_id: string;
  type: string;
  quantity: number | null;
};

function yyyyMMdd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setErr("");
    setLoading(true);

    // 1) clients
    const cRes = await supabase.from("clients").select("id,name").order("name", { ascending: true });
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    const cRows = (cRes.data || []) as any as Client[];
    setClients(cRows);

    // 2) projects (all)
    const pRes = await supabase
      .from("projects")
      .select("id,client_id,name,status,due_date")
      .order("due_date", { ascending: true });

    if (pRes.error) {
      setErr(pRes.error.message);
      setLoading(false);
      return;
    }
    const pRows = (pRes.data || []) as any as ProjectRow[];
    setProjects(pRows);

    // 3) services (deliverables) — join via project_id
    const sRes = await supabase.from("services").select("id,project_id,type,quantity");
    if (sRes.error) {
      setErr(sRes.error.message);
      setLoading(false);
      return;
    }
    const sRows = (sRes.data || []) as any as ServiceRow[];
    setServices(sRows);

    setLoading(false);
  }

  const projectsByClient = useMemo(() => {
    const m = new Map<string, ProjectRow[]>();
    for (const p of projects) {
      const arr = m.get(p.client_id) || [];
      arr.push(p);
      m.set(p.client_id, arr);
    }
    return m;
  }, [projects]);

  // Build helper: projectId -> clientId
  const projectToClient = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.client_id);
    return m;
  }, [projects]);

  // ✅ Service totals per client (sum quantity)
  const serviceTotalsByClient = useMemo(() => {
    const m = new Map<string, Record<string, number>>();

    for (const s of services) {
      const clientId = projectToClient.get(s.project_id);
      if (!clientId) continue;

      // optional: kalau nak kira yang "tengah run" sahaja, uncomment line bawah:
      // if (projects.find(p => p.id === s.project_id)?.status === "DONE") continue;

      const qty = typeof s.quantity === "number" ? s.quantity : 0;

      const bag = m.get(clientId) || {};
      bag[s.type] = (bag[s.type] || 0) + qty;
      m.set(clientId, bag);
    }

    return m;
  }, [services, projectToClient]);

  const today = yyyyMMdd(new Date());

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Client overview + project status + service totals</p>
        </div>

        <button
          onClick={loadAll}
          disabled={loading}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          Error: {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => {
          const cProjects = projectsByClient.get(c.id) || [];
          const totalProjects = cProjects.length;
          const doneProjects = cProjects.filter((p) => p.status === "DONE").length;
          const inProgressProjects = cProjects.filter((p) => p.status !== "DONE").length;
          const overdueProjects = cProjects.filter((p) => p.status !== "DONE" && p.due_date && p.due_date < today).length;

          const serviceTotals = serviceTotalsByClient.get(c.id) || {};
          const servicePairs = Object.entries(serviceTotals).sort((a, b) => b[1] - a[1]);

          return (
            <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              {/* top */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold">{c.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Projects: <b>{totalProjects}</b> · In progress: <b>{inProgressProjects}</b> · Done:{" "}
                    <b>{doneProjects}</b>
                    {overdueProjects > 0 && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                        Overdue {overdueProjects}
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/clients/${c.id}`}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50"
                >
                  View
                </Link>
              </div>

              {/* ✅ service summary */}
              <div className="mt-4">
                <div className="text-xs font-extrabold text-gray-500">Service summary</div>

                {servicePairs.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">No services yet.</div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {servicePairs.map(([type, total]) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-extrabold text-gray-800"
                        title={type}
                      >
                        <span className="max-w-[160px] truncate">{type}</span>
                        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          {total}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* projects list (mini) */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-xs font-extrabold text-gray-500">Projects</div>
                {cProjects.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">No projects.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {cProjects.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <Link href={`/projects/${p.id}`} className="text-sm font-bold hover:underline">
                          {p.name}
                        </Link>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                            p.status === "DONE" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
                          ].join(" ")}
                        >
                          {p.status || "—"}
                        </span>
                      </div>
                    ))}

                    {cProjects.length > 3 && (
                      <div className="text-xs text-gray-500">+{cProjects.length - 3} more…</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
