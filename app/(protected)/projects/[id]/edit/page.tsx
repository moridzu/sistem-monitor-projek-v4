"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type ProjectStatus = "IN_PROGRESS" | "COMPLETED";

type ClientRow = { id: string; name: string };

type ServiceType = "META_ADS" | "TIKTOK_ADS" | "TIKTOK_LIVE" | "UGC"; // ikut constraint semasa kau
const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "META_ADS", label: "Meta Ads" },
  { value: "TIKTOK_ADS", label: "TikTok Ads" },
  { value: "TIKTOK_LIVE", label: "TikTok Live" },
  { value: "UGC", label: "UGC" },
];

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
};

type ServiceRow = {
  id: string;
  type: ServiceType;
  quantity: number | null;
  notes: string | null;
};

type TeamUser = { user_id: string; role: "ADMIN" | "STAFF"; name: string };

type ServiceDraft = {
  id: string; // local id
  type: ServiceType;
  quantity: number;
  notes: string;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.floor(n)));
}

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string | undefined;

  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [myRole, setMyRole] = useState<null | "ADMIN" | "STAFF">(null);
  const isAdmin = myRole === "ADMIN";

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [project, setProject] = useState<ProjectRow | null>(null);

  // form state
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<ProjectStatus>("IN_PROGRESS");
  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [services, setServices] = useState<ServiceDraft[]>([]);

  useEffect(() => {
    if (!projectId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadAll() {
    if (!projectId) return;

    setErr("");
    setLoading(true);

    // get user + role
    const uRes = await supabase.auth.getUser();
    const uidNow = uRes.data.user?.id || null;
    if (!uidNow) {
      setErr("Session tak valid. Sila logout/login semula.");
      setLoading(false);
      return;
    }

    const roleRes = await supabase.from("team_users").select("user_id,role,name").eq("user_id", uidNow).single();
    if (roleRes.error) {
      setErr(roleRes.error.message);
      setLoading(false);
      return;
    }
    setMyRole((roleRes.data as TeamUser).role);

    // clients
    const cRes = await supabase.from("clients").select("id,name").order("name", { ascending: true });
    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    setClients((cRes.data || []) as any);

    // project
    const pRes = await supabase
      .from("projects")
      .select("id,client_id,name,status,priority,start_date,due_date")
      .eq("id", projectId)
      .single();

    if (pRes.error) {
      setErr(pRes.error.message);
      setLoading(false);
      return;
    }

    const p = pRes.data as any as ProjectRow;
    setProject(p);

    // set form defaults
    setClientId(p.client_id);
    setName(p.name || "");
    setPriority((p.priority as Priority) || "MEDIUM");
    setStatus((p.status as ProjectStatus) || "IN_PROGRESS");
    setStartDate(p.start_date || "");
    setDueDate(p.due_date || "");

    // services
    const sRes = await supabase.from("services").select("id,type,quantity,notes").eq("project_id", projectId);
    if (sRes.error) {
      setErr(sRes.error.message);
      setLoading(false);
      return;
    }
    const sRows = (sRes.data || []) as any as ServiceRow[];
    setServices(
      sRows.length
        ? sRows.map((s) => ({
            id: uid(),
            type: s.type,
            quantity: clampQty(Number(s.quantity ?? 1)),
            notes: s.notes || "",
          }))
        : [{ id: uid(), type: "META_ADS", quantity: 1, notes: "" }]
    );

    setLoading(false);
  }

  const canSave = useMemo(() => {
    if (!isAdmin) return false;
    if (!projectId) return false;
    if (!clientId) return false;
    if (!name.trim()) return false;
    if (services.length === 0) return false;
    return true;
  }, [isAdmin, projectId, clientId, name, services.length]);

  function addServiceRow() {
    setServices((prev) => [...prev, { id: uid(), type: "META_ADS", quantity: 1, notes: "" }]);
  }
  function removeServiceRow(id: string) {
    setServices((prev) => prev.filter((x) => x.id !== id));
  }
  function updateServiceRow(id: string, patch: Partial<ServiceDraft>) {
    setServices((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function onSave() {
    setErr("");
    if (!canSave) {
      setErr(isAdmin ? "Sila lengkapkan form." : "Only ADMIN boleh edit project.");
      return;
    }
    if (!projectId) return;

    setLoading(true);
    try {
      // 1) update project
      const { error: upErr } = await supabase
        .from("projects")
        .update({
          client_id: clientId,
          name: name.trim(),
          priority,
          status,
          start_date: startDate || null,
          due_date: dueDate || null,
        })
        .eq("id", projectId);

      if (upErr) {
        setErr(upErr.message);
        setLoading(false);
        return;
      }

      // 2) replace services (delete then insert)
      const { error: delErr } = await supabase.from("services").delete().eq("project_id", projectId);
      if (delErr) {
        setErr(delErr.message);
        setLoading(false);
        return;
      }

      const payload = services.map((s) => ({
        project_id: projectId,
        type: s.type,
        quantity: clampQty(Number(s.quantity)),
        notes: s.notes?.trim() || null,
      }));

      const { error: insErr } = await supabase.from("services").insert(payload);
      if (insErr) {
        setErr(insErr.message);
        setLoading(false);
        return;
      }

      router.push(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-extrabold">Invalid project id</div>
      </div>
    );
  }

  // UI guard
  if (myRole && !isAdmin) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-extrabold">No Access</div>
          <div className="mt-1 text-sm text-gray-600">This page is ADMIN only.</div>
          <div className="mt-4">
            <Link href={`/projects/${projectId}`} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold hover:bg-gray-50">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Edit Project</h1>
          <p className="mt-1 text-sm text-gray-600">
            {project?.name || "-"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Role: <b>{myRole || "-"}</b>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}`}
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

      {/* Form */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold">Project Info</div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-extrabold text-gray-600">Client</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">- pilih client -</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-extrabold text-gray-600">Project Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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

            <div>
              <label className="text-xs font-extrabold text-gray-600">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
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
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold">Save</div>
          <div className="mt-3 text-xs text-gray-500">Only ADMIN boleh edit.</div>

          <button
            onClick={onSave}
            disabled={!canSave || loading}
            className="mt-4 w-full rounded-xl bg-gray-900 px-5 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold">Services</div>
            <div className="mt-1 text-xs text-gray-500">Edit services untuk project ni.</div>
          </div>

          <button
            onClick={addServiceRow}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-90"
          >
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
                      value={s.notes}
                      onChange={(e) => updateServiceRow(s.id, { notes: e.target.value })}
                      placeholder="optional notes"
                    />
                  </td>

                  <td className="p-3 w-[120px]">
                    <button
                      onClick={() => removeServiceRow(s.id)}
                      disabled={services.length === 1}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold hover:bg-gray-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">
                    No services.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Note: Services akan di-<b>replace</b> (delete & insert semula) bila save.
        </div>
      </div>
    </div>
  );
}