"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type ClientRow = { id: string; name: string };
type TeamUser = { user_id: string; name: string; phone: string | null; role: "ADMIN" | "STAFF" };

type Priority = "LOW" | "MEDIUM" | "HIGH";
type ProjectStatus = "IN_PROGRESS" | "DONE";

type ServiceType =
  | "META_ADS"
  | "TIKTOK_ADS"
  | "META_VIDEO"
  | "TIKTOK_VIDEO"
  | "UGC_VIDEO"
  | "TIKTOK_LIVE"
  | "WEBSITE_DEV";

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "META_ADS", label: "Meta Ads" },
  { value: "TIKTOK_ADS", label: "TikTok Ads" },
  { value: "META_VIDEO", label: "Meta Video" },
  { value: "TIKTOK_VIDEO", label: "TikTok Video" },
  { value: "UGC_VIDEO", label: "UGC Video" },
  { value: "TIKTOK_LIVE", label: "TikTok Live" },
  { value: "WEBSITE_DEV", label: "Website Dev" },
];

type ServiceDraft = {
  id: string; // local only
  type: ServiceType;
  quantity: number;
  notes: string;
};

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// Templates for auto-create tasks per service type
const AUTO_TASKS_BY_SERVICE: Record<ServiceType, string[]> = {
  META_ADS: [
    "Setup campaign objective & structure",
    "Audience research + targeting",
    "Creative brief + angle list",
    "Launch campaign",
    "Daily monitoring + optimization",
    "Weekly report update",
  ],
  TIKTOK_ADS: [
    "Setup TikTok Ads account / pixel",
    "Campaign structure + targeting",
    "Creative angles + hooks list",
    "Launch campaign",
    "Optimization + testing",
    "Weekly report update",
  ],
  META_VIDEO: ["Draft script / storyboard", "Shoot / collect footage", "Edit (cut, captions, music)", "Review + revisions", "Final export + deliver"],
  TIKTOK_VIDEO: ["Draft hook + script", "Shoot / collect footage", "Edit TikTok style (captions, pacing)", "Review + revisions", "Final export + deliver"],
  UGC_VIDEO: ["UGC brief + talking points", "Talent/creator coordination", "Shoot / collect UGC footage", "Edit + captions", "Review + revisions", "Final export + deliver"],
  TIKTOK_LIVE: [
    "Live plan (slot, flow, offers)",
    "Prepare assets (banner, pricing, scripts)",
    "Setup studio (lighting, audio, phone)",
    "Dry run + checklist",
    "Go live + moderation",
    "Post-live recap + next actions",
  ],
  WEBSITE_DEV: [
    "Collect requirements (pages, features, copy)",
    "Get domain / hosting / DNS access",
    "Sitemap + page structure",
    "Prepare assets (logo, images) + copy",
    "UI/wireframe approval",
    "Develop pages (Home/About/Services/Contact)",
    "Setup forms (lead/contact) + notifications",
    "SEO basics (title/meta, sitemap, robots)",
    "Performance + mobile responsiveness check",
    "UAT (client testing) + fixes",
    "Deploy / go-live + handover",
  ],
};

function niceServiceLabel(v: ServiceType) {
  return SERVICE_OPTIONS.find((x) => x.value === v)?.label || v;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [myRole, setMyRole] = useState<null | "ADMIN" | "STAFF">(null);

  // project fields
  const [clientId, setClientId] = useState<string>("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [startDate, setStartDate] = useState<string>(todayYYYYMMDD());
  const [dueDate, setDueDate] = useState<string>("");

  const [status] = useState<ProjectStatus>("IN_PROGRESS"); // create as in progress

  // services drafts
  const [services, setServices] = useState<ServiceDraft[]>([{ id: uid(), type: "META_ADS", quantity: 1, notes: "" }]);

  // auto-create tasks
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);
  const [defaultAssignee, setDefaultAssignee] = useState<string>("");

  // ✅ load meta once on mount
  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ pick up clientId from URL (?clientId=...)
  // Bonus: reload meta so new client appears after redirect
  useEffect(() => {
    const paramClientId = searchParams.get("clientId");
    if (paramClientId) {
      setClientId(paramClientId);
      loadMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadMeta() {
    setErr("");
    setLoading(true);

    // clients
    const cRes = await supabase.from("clients").select("id,name").order("name", { ascending: true });
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    setClients((cRes.data || []) as any);

    // team
    const tRes = await supabase.from("team_users").select("user_id,name,phone,role").order("name", { ascending: true });
    if (tRes.error) {
      setErr(tRes.error.message);
      setLoading(false);
      return;
    }
    const teamRows = (tRes.data || []) as any as TeamUser[];
    setTeam(teamRows);

    // my role
    const uRes = await supabase.auth.getUser();
    const uidNow = uRes.data.user?.id || null;
    const me = uidNow ? teamRows.find((x) => x.user_id === uidNow) : undefined;
    setMyRole(me?.role || null);

    // default assignee = self if exists, else first team user
    if (uidNow) setDefaultAssignee(uidNow);
    else if (teamRows[0]) setDefaultAssignee(teamRows[0].user_id);

    setLoading(false);
  }

  const canCreate = useMemo(() => {
    if (!clientId) return false;
    if (!name.trim()) return false;
    if (services.length === 0) return false;
    return true;
  }, [clientId, name, services.length]);

  function addServiceRow() {
    setServices((prev) => [...prev, { id: uid(), type: "META_ADS", quantity: 1, notes: "" }]);
  }

  function removeServiceRow(id: string) {
    setServices((prev) => prev.filter((x) => x.id !== id));
  }

  function updateServiceRow(id: string, patch: Partial<ServiceDraft>) {
    setServices((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function clampQty(n: number) {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(999, Math.floor(n)));
  }

  function buildTaskTitle(base: string, svcType: ServiceType, unitIndex?: number) {
    const svc = niceServiceLabel(svcType);
    if (unitIndex && unitIndex > 0) return `[${svc} #${unitIndex}] ${base}`;
    return `[${svc}] ${base}`;
  }

  // Spread due dates across a range (optional)
  function computeDueDateForTask(i: number, total: number): string | null {
    if (!dueDate) return null;
    if (!startDate) return dueDate;

    const start = new Date(startDate + "T00:00:00Z").getTime();
    const end = new Date(dueDate + "T00:00:00Z").getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return dueDate;

    const t = total <= 1 ? 1 : i / (total - 1);
    const ts = Math.round(start + (end - start) * t);
    return new Date(ts).toISOString().slice(0, 10);
  }

  async function onSubmit() {
    setErr("");
    if (!canCreate) {
      setErr("Sila lengkapkan Client, Project Name, dan at least 1 service.");
      return;
    }

    setLoading(true);
    try {
      // 0) get current user (needed for owner_user_id)
const uRes = await supabase.auth.getUser();
const ownerId = uRes.data.user?.id || null;

if (!ownerId) {
  setErr("Session tak valid. Sila logout/login semula.");
  setLoading(false);
  return;
}

// 1) create project (include owner_user_id)
const { data: pRow, error: pErr } = await supabase
  .from("projects")
  .insert({
    client_id: clientId,
    owner_user_id: ownerId, // ✅ IMPORTANT
    name: name.trim(),
    status, // IN_PROGRESS
    priority,
    start_date: startDate || null,
    due_date: dueDate || null,
  })
  .select("id")
  .single();

      if (pErr || !pRow) {
        setErr(pErr?.message || "Failed to create project.");
        setLoading(false);
        return;
      }

      const projectId = pRow.id as string;

      // 2) insert services
      const servicePayload = services.map((s) => ({
        project_id: projectId,
        type: s.type,
        quantity: clampQty(s.quantity),
        notes: s.notes?.trim() || null,
      }));

      const { data: svcRows, error: sErr } = await supabase.from("services").insert(servicePayload).select("id,type,quantity");

      if (sErr || !svcRows) {
        setErr(sErr?.message || "Failed to create services.");
        setLoading(false);
        return;
      }

      // 3) auto-create tasks
      if (autoCreateTasks) {
        if (!defaultAssignee) {
          setErr("Default PIC belum dipilih.");
          setLoading(false);
          return;
        }

        const allTasks: any[] = [];

        // total tasks count (for due spread)
        let roughTotal = 0;
        for (const s of svcRows as any[]) {
          const type = s.type as ServiceType;
          const tpl = AUTO_TASKS_BY_SERVICE[type] || [];
          const qty = typeof s.quantity === "number" ? s.quantity : 1;
          const repeat = Math.max(1, qty);
          roughTotal += tpl.length * repeat;
        }

        let cursor = 0;

        for (const s of svcRows as any[]) {
          const serviceId = s.id as string;
          const type = s.type as ServiceType;
          const tpl = AUTO_TASKS_BY_SERVICE[type] || [];
          const qty = typeof s.quantity === "number" ? s.quantity : 1;

          const repeatUnits = Math.max(1, qty);

          for (let u = 1; u <= repeatUnits; u++) {
            for (const baseTitle of tpl) {
              const due = computeDueDateForTask(cursor, roughTotal);
              allTasks.push({
                project_id: projectId,
                service_id: serviceId,
                title: buildTaskTitle(baseTitle, type, repeatUnits > 1 ? u : undefined),
                status: "TODO",
                priority: "MEDIUM",
                due_date: due,
                assignee_user_id: defaultAssignee,
                blocked_reason: null,
                last_update_at: new Date().toISOString(),
              });
              cursor += 1;
            }
          }
        }

        if (allTasks.length > 0) {
          const { error: tErr } = await supabase.from("tasks").insert(allTasks);
          if (tErr) {
            setErr(tErr.message || "Failed to auto-create tasks.");
            setLoading(false);
            return;
          }
        }
      }

      router.push(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Create Project</h1>
          <p className="mt-1 text-sm text-gray-600">Create new project + services + optional auto-create tasks</p>
          <p className="mt-1 text-xs text-gray-400">
            Role: <b>{myRole || "-"}</b>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/projects" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50">
            Back
          </Link>

          <button
            onClick={loadMeta}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Error: {err}</div>
      )}

      {/* Form */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold">Project Info</div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-extrabold text-gray-600">Client</label>

              <div className="mt-1 flex gap-2">
                <select
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">-sila pilih-</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <Link
                  href="/clients/create"
                  className="whitespace-nowrap rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold hover:bg-gray-50"
                >
                  + Add
                </Link>
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-600">Priority</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-extrabold text-gray-600">Project Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Bitara - Feb Campaign / Website Revamp"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-600">Start Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-600">Due Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-gray-400">(Optional) Jika set due date, auto-created tasks akan dapat due date berperingkat.</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold">Auto-create tasks</div>
          <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={autoCreateTasks} onChange={(e) => setAutoCreateTasks(e.target.checked)} className="h-4 w-4" />
            <div className="text-sm font-bold text-gray-800">Enable auto-create</div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Bila ON, sistem akan generate tasks ikut template service (Meta Ads / Video / TikTok Live / Website Dev etc).
          </div>

          <div className="mt-4">
            <label className="text-xs font-extrabold text-gray-600">Default PIC</label>
            <select
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
              value={defaultAssignee}
              onChange={(e) => setDefaultAssignee(e.target.value)}
              disabled={!autoCreateTasks}
            >
              <option value="">- pilih PIC -</option>
              {team.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name}
                </option>
              ))}
            </select>

            {!autoCreateTasks && <div className="mt-2 text-[11px] text-gray-400">Auto-create OFF → PIC tak diperlukan.</div>}
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold">Services / Deliverables</div>
            <div className="mt-1 text-xs text-gray-500">Tambah servis yang client ambil (quantity + notes optional).</div>
          </div>

          <button onClick={addServiceRow} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-90">
            + Add Service
          </button>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-extrabold">Type</th>
                <th className="p-3 font-extrabold">Qty</th>
                <th className="p-3 font-extrabold">Notes</th>
                <th className="p-3 font-extrabold">Action</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-gray-200">
                  <td className="p-3">
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                      value={s.type}
                      onChange={(e) => updateServiceRow(s.id, { type: e.target.value as ServiceType })}
                    >
                      {SERVICE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3 w-[120px]">
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                      value={s.quantity}
                      onChange={(e) => updateServiceRow(s.id, { quantity: clampQty(Number(e.target.value)) })}
                    />
                  </td>

                  <td className="p-3">
                    <input
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                      placeholder="optional notes"
                      value={s.notes}
                      onChange={(e) => updateServiceRow(s.id, { notes: e.target.value })}
                    />
                  </td>

                  <td className="p-3 w-[120px]">
                    <button
                      onClick={() => removeServiceRow(s.id)}
                      disabled={services.length === 1}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50 disabled:opacity-40"
                      title={services.length === 1 ? "At least 1 service required" : "Remove"}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {services.length === 0 && (
                <tr>
                  <td className="p-4 text-sm text-gray-600" colSpan={4}>
                    No services.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {autoCreateTasks && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-extrabold text-gray-700">Auto-create preview (ringkas)</div>
            <div className="mt-2 text-xs text-gray-600">
              Sistem akan create tasks ikut template type. Untuk services yang qty &gt; 1 (contoh Video/UGC), tasks akan repeat per unit.
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="mt-6 flex items-center justify-end gap-2">
        <Link href="/projects" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50">
          Cancel
        </Link>

        <button
          onClick={onSubmit}
          disabled={!canCreate || loading}
          className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Notes: Project created as <b>IN_PROGRESS</b>. Auto-create tasks uses templates per service type (including Website Dev).
      </div>
    </div>
  );
}