"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  clients: { name: string } | null;
};

type TaskRow = {
  project_id: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  assignee_user_id: string;
};

type TeamUser = {
  user_id: string;
  role: "ADMIN" | "STAFF";
  name: string;
  phone: string | null;
};

export default function ProjectsListPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const [myRole, setMyRole] = useState<null | "ADMIN" | "STAFF">(null);
  const isAdmin = myRole === "ADMIN";

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      // auth
      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw new Error(uErr.message);

      const userId = userRes.user?.id;
      if (!userId) throw new Error("Session tak valid. Sila logout/login semula.");

      // my role
      const roleRes = await supabase
        .from("team_users")
        .select("user_id,role,name,phone")
        .eq("user_id", userId)
        .single();

      if (roleRes.error) throw new Error(roleRes.error.message);

      const me = roleRes.data as TeamUser;
      setMyRole(me.role);

      // Load tasks first (needed for STAFF filter + stats)
      // ✅ keep lightweight: only fields we need
      const tRes = await supabase.from("tasks").select("project_id,status,assignee_user_id");
      if (tRes.error) throw new Error(tRes.error.message);

      const taskRows = (tRes.data || []) as any as TaskRow[];
      setTasks(taskRows);

      // Build visible project IDs for STAFF
      const staffProjectIds = new Set<string>();
      if (me.role !== "ADMIN") {
        for (const t of taskRows) {
          if (t.assignee_user_id === userId) staffProjectIds.add(t.project_id);
        }
      }

      // projects query
      let pQuery = supabase
        .from("projects")
        .select(
          `
          id,
          name,
          status,
          priority,
          start_date,
          due_date,
          owner_user_id,
          clients:client_id ( name )
        `
        )
        .order("created_at", { ascending: false });

      // ✅ ADMIN: see all
      // ✅ STAFF: see only involved projects (via assigned tasks)
      if (me.role !== "ADMIN") {
        const ids = Array.from(staffProjectIds);
        if (ids.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }
        pQuery = pQuery.in("id", ids);
      }

      const pRes = await pQuery;
      if (pRes.error) throw new Error(pRes.error.message);

      setProjects((pRes.data || []) as any);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id: string) {
    setErr("");

    if (!isAdmin) {
      setErr("Only ADMIN boleh delete project.");
      return;
    }

    if (!confirm("Bro, confirm ke nak delete project ni? Bereh boh!")) return;

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }

    await loadAll();
  }

  const projectStats = useMemo(() => {
    // stats are based on tasks loaded above
    const map: Record<
      string,
      { total: number; done: number; blocked: number; open: number }
    > = {};

    for (const p of projects) map[p.id] = { total: 0, done: 0, blocked: 0, open: 0 };

    for (const t of tasks) {
      const s = map[t.project_id];
      if (!s) continue;

      s.total += 1;
      if (t.status === "DONE") s.done += 1;
      if (t.status === "BLOCKED") s.blocked += 1;
      if (t.status !== "DONE") s.open += 1;
    }

    return map;
  }, [projects, tasks]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Projects</h1>
          <div className="mt-1 text-xs text-gray-500">
            Role: <b>{myRole || "-"}</b>
          </div>
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

      <div className="mt-6 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-extrabold">Project</th>
              <th className="p-3 font-extrabold">Client</th>
              <th className="p-3 font-extrabold">Priority</th>
              <th className="p-3 font-extrabold">Status</th>
              <th className="p-3 font-extrabold">Progress</th>
              <th className="p-3 font-extrabold">Due</th>
              <th className="p-3 font-extrabold">Action</th>
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const stat = projectStats[p.id] || { total: 0, done: 0, blocked: 0, open: 0 };
              const pct = stat.total === 0 ? 0 : Math.round((stat.done / stat.total) * 100);

              return (
                <tr key={p.id} className="border-t border-gray-200">
                  <td className="p-3 font-semibold">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                    {stat.blocked > 0 && (
                      <div className="mt-1 text-[11px] font-bold text-amber-700">
                        Blocked: {stat.blocked}
                      </div>
                    )}
                  </td>

                  <td className="p-3">{p.clients?.name || "-"}</td>
                  <td className="p-3">{p.priority}</td>

                  <td className="p-3">
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-extrabold",
                        p.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {p.status}
                    </span>
                  </td>

                  <td className="p-3 w-[220px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold">{pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {stat.done}/{stat.total} done
                    </div>
                  </td>

                  <td className="p-3">{p.due_date || "-"}</td>

                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-extrabold hover:bg-gray-50"
                      >
                        View
                      </Link>

                      {isAdmin ? (
                      <>
                        <Link
                          href={`/projects/${p.id}/edit`}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-extrabold hover:bg-gray-50"
                        >
                          Edit
                        </Link>

                        <button
                          onClick={() => deleteProject(p.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-extrabold text-white hover:opacity-90"
                        >
                          Delete
                        </button>
                      </>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <div className="mt-3 text-xs text-gray-500">
          Note: STAFF view = projects yang ada task assigned pada user ini. Only <b>ADMIN</b> boleh delete project.
        </div>
      )}
    </div>
  );
}