"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { waLink } from "@/utils/wa";

type Project = {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  clients: { name: string } | null;
};

type ServiceRow = {
  id: string;
  type: string;
  quantity: number | null;
  notes: string | null;
};

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  due_date: string | null;
  last_update_at: string;
  assignee_user_id: string;
  service_id: string | null;
  blocked_reason: string | null;
  services: { type: string } | null;
};

type TeamUser = {
  user_id: string;
  name: string;
  phone: string | null;
  role: "ADMIN" | "STAFF";
};

function yyyyMMdd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function isoToDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso);
  }
}
function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

const TABS = ["ALL", "OPEN", "OVERDUE", "STALE", "BLOCKED", "DONE"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  ALL: "All",
  OPEN: "Open",
  OVERDUE: "Overdue",
  STALE: "Stale",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);

  // current user role (for admin-only actions)
  const [myRole, setMyRole] = useState<null | "ADMIN" | "STAFF">(null);

  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");

  const [serviceFilterId, setServiceFilterId] = useState<string | null>(null);

  // 2-step BLOCKED editor
  const [editingBlocked, setEditingBlocked] = useState<
    null | { taskId: string; draftReason: string; prevStatus: Task["status"] }
  >(null);

  // auto-sync project status
  const [syncingStatus, setSyncingStatus] = useState(false);

  async function syncProjectStatus(pid: string) {
    if (!pid) return;
    if (syncingStatus) return;

    setSyncingStatus(true);
    try {
      const { data: tRows, error: tErr } = await supabase.from("tasks").select("status").eq("project_id", pid);
      if (tErr || !tRows) return;

      const total = tRows.length;
      if (total === 0) return;

      const done = tRows.filter((t) => t.status === "DONE").length;
      const newStatus = done === total ? "DONE" : "IN_PROGRESS";

      const { data: pRow, error: pErr } = await supabase.from("projects").select("status").eq("id", pid).single();
      if (pErr || !pRow) return;

      if (pRow.status === newStatus) return;

      const { error: upErr } = await supabase.from("projects").update({ status: newStatus }).eq("id", pid);
      if (upErr) return;

      setProject((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } finally {
      setSyncingStatus(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadAll() {
    if (!projectId) return;

    setErr("");
    setLoading(true);

    // 0) my role
    const uRes = await supabase.auth.getUser();
    const uid = uRes.data.user?.id || null;

    // project
    const pRes = await supabase
      .from("projects")
      .select(
        `
        id,name,status,priority,start_date,due_date,
        clients:client_id ( name )
      `
      )
      .eq("id", projectId)
      .single();

    if (pRes.error) {
      setErr(pRes.error.message);
      setLoading(false);
      return;
    }
    setProject(pRes.data as any);

    // services
    const sRes = await supabase
      .from("services")
      .select("id,type,quantity,notes")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (sRes.error) {
      setErr(sRes.error.message);
      setLoading(false);
      return;
    }
    setServices((sRes.data || []) as any);

    // tasks
    const tRes = await supabase
      .from("tasks")
      .select(
        `
        id,title,status,priority,due_date,last_update_at,assignee_user_id,service_id,blocked_reason,
        services:service_id ( type )
      `
      )
      .eq("project_id", projectId)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true });

    if (tRes.error) {
      setErr(tRes.error.message);
      setLoading(false);
      return;
    }
    setTasks(((tRes.data || []) as any) as Task[]);

    // team
    const teamRes = await supabase.from("team_users").select("user_id,name,phone,role");
    if (teamRes.error) {
      setErr(teamRes.error.message);
      setLoading(false);
      return;
    }
    const teamRows = (teamRes.data || []) as any as TeamUser[];
    setTeam(teamRows);

    // my role from team_users
    const me = uid ? teamRows.find((x) => x.user_id === uid) : undefined;
    setMyRole(me?.role || null);

    setLoading(false);

    await syncProjectStatus(projectId);
  }

  const teamById = useMemo(() => {
    const m = new Map<string, TeamUser>();
    team.forEach((u) => m.set(u.user_id, u));
    return m;
  }, [team]);

  const stats = useMemo(() => {
    const today = yyyyMMdd(new Date());
    const staleCutoff = daysAgoISO(3);

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const blocked = tasks.filter((t) => t.status === "BLOCKED").length;

    const overdue = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today
    ).length;

    const stale = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.last_update_at && t.last_update_at <= staleCutoff
    ).length;

    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, blocked, overdue, stale, pct };
  }, [tasks]);

  const serviceStats = useMemo(() => {
    const today = yyyyMMdd(new Date());
    const staleCutoff = daysAgoISO(3);

    const map: Record<string, { total: number; done: number; overdue: number; stale: number; pct: number }> = {};
    for (const s of services) map[s.id] = { total: 0, done: 0, overdue: 0, stale: 0, pct: 0 };

    for (const t of tasks) {
      const sid = t.service_id;
      if (!sid || !map[sid]) continue;

      map[sid].total += 1;
      if (t.status === "DONE") map[sid].done += 1;
      if (t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today) map[sid].overdue += 1;
      if (t.status !== "DONE" && t.status !== "BLOCKED" && t.last_update_at && t.last_update_at <= staleCutoff)
        map[sid].stale += 1;
    }

    for (const sid of Object.keys(map)) {
      const x = map[sid];
      x.pct = x.total === 0 ? 0 : Math.round((x.done / x.total) * 100);
    }

    return map;
  }, [services, tasks]);

  const tabCounts = useMemo(() => {
    const today = yyyyMMdd(new Date());
    const staleCutoff = daysAgoISO(3);

    const open = tasks.filter((t) => t.status !== "DONE").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const blocked = tasks.filter((t) => t.status === "BLOCKED").length;

    const overdue = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today
    ).length;

    const stale = tasks.filter(
      (t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.last_update_at <= staleCutoff
    ).length;

    return { ALL: tasks.length, OPEN: open, OVERDUE: overdue, STALE: stale, BLOCKED: blocked, DONE: done } as const;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const today = yyyyMMdd(new Date());
    const staleCutoff = daysAgoISO(3);
    const needle = q.trim().toLowerCase();

    let rows = [...tasks];

    if (serviceFilterId) rows = rows.filter((t) => t.service_id === serviceFilterId);

    if (tab === "OPEN") rows = rows.filter((t) => t.status !== "DONE");
    if (tab === "DONE") rows = rows.filter((t) => t.status === "DONE");
    if (tab === "BLOCKED") rows = rows.filter((t) => t.status === "BLOCKED");

    if (tab === "OVERDUE")
      rows = rows.filter((t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.due_date && t.due_date < today);

    if (tab === "STALE")
      rows = rows.filter((t) => t.status !== "DONE" && t.status !== "BLOCKED" && t.last_update_at <= staleCutoff);

    if (needle) {
      rows = rows.filter((t) => {
        const svc = t.services?.type || "";
        const br = t.blocked_reason || "";
        const pic = teamById.get(t.assignee_user_id)?.name || "";
        return (
          t.title.toLowerCase().includes(needle) ||
          svc.toLowerCase().includes(needle) ||
          t.status.toLowerCase().includes(needle) ||
          br.toLowerCase().includes(needle) ||
          pic.toLowerCase().includes(needle)
        );
      });
    }

    return rows;
  }, [tasks, tab, q, serviceFilterId, teamById]);

  async function setTaskStatus(task: Task, nextStatus: Task["status"]) {
    setErr("");

    // Choose BLOCKED -> open editor, no DB update yet
    if (nextStatus === "BLOCKED") {
      setEditingBlocked({
        taskId: task.id,
        draftReason: task.blocked_reason || "",
        prevStatus: task.status,
      });
      return;
    }

    const patch: any = { status: nextStatus, last_update_at: new Date().toISOString() };

    // leaving BLOCKED => clear reason
    if (task.status === "BLOCKED") patch.blocked_reason = null;

    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    if (error) {
      setErr(error.message);
      return;
    }

    await loadAll();
    if (projectId) await syncProjectStatus(projectId);
  }

  async function saveBlocked() {
    if (!editingBlocked) return;

    setErr("");
    const reason = (editingBlocked.draftReason || "").trim();
    if (!reason) {
      setErr("Blocked reason wajib isi bila status = BLOCKED.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "BLOCKED", blocked_reason: reason, last_update_at: new Date().toISOString() })
      .eq("id", editingBlocked.taskId);

    if (error) {
      setErr(error.message);
      return;
    }

    setEditingBlocked(null);

    await loadAll();
    if (projectId) await syncProjectStatus(projectId);
  }

  function cancelBlocked() {
    setEditingBlocked(null);
  }

  async function setTaskAssignee(task: Task, nextUserId: string) {
    setErr("");
    if (myRole !== "ADMIN") {
      setErr("Admin only: assign PIC.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ assignee_user_id: nextUserId, last_update_at: new Date().toISOString() })
      .eq("id", task.id);

    if (error) {
      setErr(error.message);
      return;
    }

    await loadAll();
  }

  function followupLink(t: Task) {
    const pic = teamById.get(t.assignee_user_id);
    const phone = pic?.phone || "";
    if (!phone) return "#";

    const clientName = project?.clients?.name || "-";
    const projectName = project?.name || "-";
    const picName = pic?.name || "team";

    const blockedLine = t.status === "BLOCKED" ? `\nBLOCKED reason: ${t.blocked_reason || "(not set)"}` : "";

    const msg = `Bro ${picName}, boleh update status task ni ya 🙏

Client: ${clientName}
Project: ${projectName}
Service: ${t.services?.type || "-"}
Task: ${t.title}
Status: ${t.status}${blockedLine}
Due: ${t.due_date || "-"}
Last update: ${isoToDate(t.last_update_at)}

Status sekarang & next action apa bro?`;

    return waLink(phone, msg);
  }

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-extrabold">Invalid project id</div>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceFilterId);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{project?.name || "Project"}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Client: <b>{project?.clients?.name || "-"}</b> · Status: <b>{project?.status || "-"}</b>{" "}
            {syncingStatus && <span className="ml-2 text-xs text-gray-400">(syncing...)</span>}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Priority: <b>{project?.priority || "-"}</b> · Start: <b>{project?.start_date || "-"}</b> · Due:{" "}
            <b>{project?.due_date || "-"}</b>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Logged role: <b>{myRole || "-"}</b>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/projects"
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

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-extrabold text-gray-500">Progress</div>
            <div className="mt-2 text-3xl font-extrabold">{stats.pct}%</div>
          </div>
          <div className="rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-gray-900" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Total</div>
          <div className="mt-2 text-3xl font-extrabold">{stats.total}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Done</div>
          <div className="mt-2 text-3xl font-extrabold text-green-700">{stats.done}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Overdue</div>
          <div className="mt-2 text-3xl font-extrabold text-red-700">{stats.overdue}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Stale</div>
          <div className="mt-2 text-3xl font-extrabold text-amber-700">{stats.stale}</div>
        </div>

        <div className="aspect-square rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-gray-500">Blocked</div>
          <div className="mt-2 text-3xl font-extrabold">{stats.blocked}</div>
        </div>
      </div>

      {/* Service-level cards */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-extrabold">Services / Deliverables</div>
            <div className="text-xs text-gray-500">Click card untuk filter tasks ikut service.</div>
          </div>

          {serviceFilterId && (
            <button
              onClick={() => setServiceFilterId(null)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50"
            >
              Clear service filter {selectedService?.type ? `(${selectedService.type})` : ""}
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => {
            const st = serviceStats[s.id] || { total: 0, done: 0, overdue: 0, stale: 0, pct: 0 };
            const active = serviceFilterId === s.id;

            return (
              <button
                key={s.id}
                onClick={() => setServiceFilterId((prev) => (prev === s.id ? null : s.id))}
                className={[
                  "text-left rounded-2xl border p-4 shadow-sm transition",
                  active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-extrabold">{s.type}</div>
                  {typeof s.quantity === "number" && (
                    <div
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-extrabold",
                        active ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      Qty {s.quantity}
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-end justify-between">
                  <div className="text-2xl font-extrabold">{st.pct}%</div>
                  <div className={["text-xs font-extrabold", active ? "text-white/80" : "text-gray-600"].join(" ")}>
                    {st.done}/{st.total} done
                  </div>
                </div>

                <div className={["mt-3 rounded-full", active ? "bg-white/20" : "bg-gray-200"].join(" ")}>
                  <div
                    className={["h-2 rounded-full", active ? "bg-white" : "bg-gray-900"].join(" ")}
                    style={{ width: `${st.pct}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs font-extrabold">
                  <span className={active ? "text-white" : "text-red-700"}>Overdue {st.overdue}</span>
                  <span className={active ? "text-white/90" : "text-amber-700"}>Stale {st.stale}</span>
                </div>

                {s.notes && (
                  <div className={["mt-2 text-xs", active ? "text-white/80" : "text-gray-500"].join(" ")}>
                    {s.notes}
                  </div>
                )}
              </button>
            );
          })}

          {services.length === 0 && <div className="text-sm text-gray-600">No services for this project.</div>}
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((k) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition",
                    active ? "bg-gray-900 text-white" : "border border-gray-300 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span>{TAB_LABEL[k]}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-extrabold",
                      active ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700",
                    ].join(" ")}
                  >
                    {tabCounts[k]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full md:w-[320px]">
            <div className="relative">
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-10"
                placeholder="Search tasks / blocked reason / PIC..."
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

        {serviceFilterId && (
          <div className="mt-3 text-xs font-extrabold text-gray-700">
            Filtering by service: <span className="underline">{selectedService?.type || serviceFilterId}</span>
          </div>
        )}
      </div>

      {/* Tasks table */}
      <div className="mt-6 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3 font-extrabold">Task</th>
              <th className="p-3 font-extrabold">Service</th>
              <th className="p-3 font-extrabold">PIC</th>
              <th className="p-3 font-extrabold">Status</th>
              <th className="p-3 font-extrabold">Blocked reason</th>
              <th className="p-3 font-extrabold">Due</th>
              <th className="p-3 font-extrabold">Last update</th>
              <th className="p-3 font-extrabold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((t) => {
              const isEditingThis = editingBlocked?.taskId === t.id;
              const pic = teamById.get(t.assignee_user_id);

              return (
                <tr key={t.id} className="border-t border-gray-200 align-top">
                  <td className="p-3 font-semibold">{t.title}</td>
                  <td className="p-3">{t.services?.type || "-"}</td>

                  {/* PIC column */}
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <select
                        className="rounded-xl border border-gray-300 px-2 py-1 text-sm font-bold"
                        value={t.assignee_user_id}
                        disabled={myRole !== "ADMIN"}
                        onChange={(e) => setTaskAssignee(t, e.target.value)}
                        title={myRole === "ADMIN" ? "Assign PIC" : "Admin only"}
                      >
                        {team.map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.name}
                          </option>
                        ))}
                      </select>

                      {pic?.phone ? (
                        <span className="text-[11px] text-gray-500">{pic.phone}</span>
                      ) : (
                        <span className="text-[11px] text-gray-400">No phone</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <select
                      className="rounded-xl border border-gray-300 px-2 py-1 text-sm font-bold"
                      value={t.status}
                      onChange={(e) => setTaskStatus(t, e.target.value as any)}
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="DONE">DONE</option>
                    </select>
                    {isEditingThis && <div className="mt-2 text-xs font-bold text-amber-700">Isi reason dulu, Save.</div>}
                  </td>

                  <td className="p-3">
                    {isEditingThis ? (
                      <div className="flex flex-col gap-2">
                        <input
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-sm",
                            (editingBlocked?.draftReason || "").trim() ? "border-gray-300" : "border-red-300 bg-red-50",
                          ].join(" ")}
                          placeholder="e.g. Waiting client approval / Access BM belum diberi"
                          value={editingBlocked?.draftReason || ""}
                          onChange={(e) =>
                            setEditingBlocked((prev) => (prev ? { ...prev, draftReason: e.target.value } : prev))
                          }
                        />

                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveBlocked}
                            className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelBlocked}
                            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50"
                          >
                            Cancel
                          </button>

                          {!(editingBlocked?.draftReason || "").trim() && (
                            <span className="text-xs font-extrabold text-red-700">Required</span>
                          )}
                        </div>
                      </div>
                    ) : t.status === "BLOCKED" ? (
                      <span className="text-sm text-gray-800">{t.blocked_reason || "-"}</span>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>

                  <td className="p-3">{t.due_date || "-"}</td>
                  <td className="p-3">{isoToDate(t.last_update_at)}</td>

                  <td className="p-3">
                    {pic?.phone ? (
                      <a
                        href={followupLink(t)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-[#25D366] px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
                      >
                        WhatsApp PIC
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">No phone</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredTasks.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-gray-600" colSpan={8}>
                  No tasks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Rules: Overdue/Stale exclude BLOCKED. BLOCKED requires blocked_reason (2-step editor). Admin can assign PIC.
        Project status auto-sync based on DONE % (Option A).
      </div>
    </div>
  );
}
