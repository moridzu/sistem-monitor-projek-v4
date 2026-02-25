"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { waLink } from "@/utils/wa";

type Row = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  due_date: string | null;
  last_update_at: string;
  last_reminded_at: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee_user_id: string;

  projects:
    | {
        id: string;
        name: string;
        clients: { name: string } | null;
      }
    | null;
};

type TeamUser = {
  user_id: string;
  name: string;
  phone: string;
  role: string; // admin/member
};

function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function fmtDate(d: string | null) {
  return d || "-";
}

function fmtISOToDate(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function buildMessage(opts: {
  type: "OVERDUE" | "STALE";
  assigneeName: string;
  clientName: string;
  projectName: string;
  taskTitle: string;
  dueDate: string | null;
  lastUpdateAtISO: string;
}) {
  const { type, assigneeName, clientName, projectName, taskTitle, dueDate, lastUpdateAtISO } = opts;

  if (type === "OVERDUE") {
    return `Bro ${assigneeName}, task ni dah overdue ya 🙏

Client: ${clientName}
Project: ${projectName}
Task: ${taskTitle}
Due: ${dueDate || "-"}

Boleh update status sekarang (TODO / IN_PROGRESS / BLOCKED / DONE) + next action?`;
  }

  return `Bro ${assigneeName}, boleh update sekejap status task ni ya 🙏

Client: ${clientName}
Project: ${projectName}
Task: ${taskTitle}
Last update: ${fmtISOToDate(lastUpdateAtISO)}

Status sekarang & next action apa bro?`;
}

function canRemind(lastRemindedAtISO: string | null, cooldownHours = 24) {
  if (!lastRemindedAtISO) return true;
  const last = new Date(lastRemindedAtISO).getTime();
  const now = Date.now();
  const diffHours = (now - last) / 36e5;
  return diffHours >= cooldownHours;
}

export default function FollowUpsPage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [overdue, setOverdue] = useState<Row[]>([]);
  const [stale, setStale] = useState<Row[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [meRole, setMeRole] = useState<string>("member");

  const teamById = useMemo(() => {
    const m = new Map<string, TeamUser>();
    team.forEach((u) => m.set(u.user_id, u));
    return m;
  }, [team]);

  useEffect(() => {
    (async () => {
      setErr("");
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setErr(error.message);
        return;
      }
      if (!data.session) {
        window.location.href = "/login";
        return;
      }

      const meId = data.session.user.id;

      // Load team_users (for phone + role)
      const teamRes = await supabase.from("team_users").select("user_id,name,phone,role").order("name");
      if (teamRes.error) {
        setErr(teamRes.error.message);
        return;
      }

      const teamData = (teamRes.data || []) as TeamUser[];
      setTeam(teamData);

      const me = teamData.find((x) => x.user_id === meId);
      setMeRole(me?.role || "member");

      setReady(true);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setErr("");
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    const overdueRes = await supabase
      .from("tasks")
      .select(
        `
        id,title,status,due_date,last_update_at,last_reminded_at,priority,assignee_user_id,
        projects:project_id (
          id,name,
          clients:client_id ( name )
        )
      `
      )
      .neq("status", "DONE")
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true });

    if (overdueRes.error) {
      setErr(overdueRes.error.message);
      setLoading(false);
      return;
    }

    const staleRes = await supabase
      .from("tasks")
      .select(
        `
        id,title,status,due_date,last_update_at,last_reminded_at,priority,assignee_user_id,
        projects:project_id (
          id,name,
          clients:client_id ( name )
        )
      `
      )
      .neq("status", "DONE")
      .lte("last_update_at", daysAgoISO(3))
      .order("last_update_at", { ascending: true });

    if (staleRes.error) {
      setErr(staleRes.error.message);
      setLoading(false);
      return;
    }

    setOverdue((overdueRes.data || []) as any);
    setStale((staleRes.data || []) as any);
    setLoading(false);
  }

  async function markReminded(taskId: string) {
    setErr("");
    const { error } = await supabase
      .from("tasks")
      .update({ last_reminded_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  function WaButton({ task, type }: { task: Row; type: "OVERDUE" | "STALE" }) {
    const assignee = teamById.get(task.assignee_user_id);
    const assigneeName = assignee?.name || "team";
    const phone = assignee?.phone || "";

    const clientName = task.projects?.clients?.name || "-";
    const projectName = task.projects?.name || "-";

    const msg = buildMessage({
      type,
      assigneeName,
      clientName,
      projectName,
      taskTitle: task.title,
      dueDate: task.due_date,
      lastUpdateAtISO: task.last_update_at,
    });

    const okToRemind = canRemind(task.last_reminded_at, 24);

    if (!phone) {
      return (
        <span className="text-xs font-extrabold text-red-600" title="No phone found in team_users">
          No phone
        </span>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <a
          href={waLink(phone, msg)}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-extrabold text-white ${
            okToRemind ? "bg-[#25D366] hover:opacity-90" : "bg-gray-300 cursor-not-allowed pointer-events-none"
          }`}
          title={okToRemind ? "WhatsApp follow-up" : "Cooldown 24h (already reminded)"}
        >
          WhatsApp
        </a>

        <button
          type="button"
          onClick={() => markReminded(task.id)}
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold hover:bg-gray-50"
          title="Set last_reminded_at = now()"
        >
          Reminded
        </button>
      </div>
    );
  }

  function TableBlock({
    title,
    rows,
    type,
  }: {
    title: string;
    rows: Row[];
    type: "OVERDUE" | "STALE";
  }) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-700">
            {rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">No items 🎉</p>
        ) : (
          <div className="mt-4 overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3 font-extrabold">Client</th>
                  <th className="p-3 font-extrabold">Project</th>
                  <th className="p-3 font-extrabold">Task</th>
                  <th className="p-3 font-extrabold">PIC</th>
                  <th className="p-3 font-extrabold">Due</th>
                  <th className="p-3 font-extrabold">Last update</th>
                  <th className="p-3 font-extrabold">Last reminded</th>
                  <th className="p-3 font-extrabold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const assignee = teamById.get(r.assignee_user_id);
                  return (
                    <tr key={r.id} className="border-t border-gray-200">
                      <td className="p-3">{r.projects?.clients?.name || "-"}</td>
                      <td className="p-3">{r.projects?.name || "-"}</td>
                      <td className="p-3 font-semibold">{r.title}</td>
                      <td className="p-3">{assignee?.name || r.assignee_user_id}</td>
                      <td className="p-3">{fmtDate(r.due_date)}</td>
                      <td className="p-3">{fmtISOToDate(r.last_update_at)}</td>
                      <td className="p-3">{r.last_reminded_at ? fmtISOToDate(r.last_reminded_at) : "-"}</td>
                      <td className="p-3">
                        <WaButton task={r} type={type} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-bold text-gray-700">Checking session…</div>
          <div className="mt-2 text-xs text-gray-500">If not logged in, you’ll be redirected to /login.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Follow-up Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overdue + no update &gt; 3 days. One-click WhatsApp to PIC.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Logged in role: <b>{meRole}</b>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          Error: {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6">
        <TableBlock title="Overdue Tasks" rows={overdue} type="OVERDUE" />
        <TableBlock title="No Update > 3 Days" rows={stale} type="STALE" />
      </div>
    </div>
  );
}
