"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type TeamUser = {
  user_id: string;
  name: string;
  phone: string | null;
  role: "ADMIN" | "STAFF";
  created_at: string;
};

export default function TeamPage() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meUserId, setMeUserId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [rows, setRows] = useState<TeamUser[]>([]);

  // add form
  const [newUserId, setNewUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "STAFF">("STAFF");

  const rowsSorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      // admins first
      if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [rows]);

  useEffect(() => {
    (async () => {
      setErr("");
      setOk("");

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/login";
        return;
      }

      const uid = data.session.user.id;
      setMeUserId(uid);

      // check role from team_users
      const { data: me, error: meErr } = await supabase
        .from("team_users")
        .select("role")
        .eq("user_id", uid)
        .single();

      if (meErr) {
        setErr(meErr.message);
        setReady(true);
        return;
      }

      const admin = me?.role === "ADMIN";
      setIsAdmin(admin);
      setReady(true);

      if (!admin) return;

      await loadTeam();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeam() {
    setErr("");
    setOk("");
    setLoading(true);

    const { data, error } = await supabase
      .from("team_users")
      .select("user_id,name,phone,role,created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    else setRows((data || []) as any);

    setLoading(false);
  }

  async function addTeamUser() {
    setErr("");
    setOk("");

    const uid = newUserId.trim();
    const name = newName.trim();

    if (!uid) return setErr("Please paste user_id (UUID) from Supabase Auth user.");
    if (!name) return setErr("Please enter name.");

    setLoading(true);

    const { error } = await supabase.from("team_users").insert({
      user_id: uid,
      name,
      phone: newPhone.trim() || null,
      role: newRole,
    });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setNewUserId("");
    setNewName("");
    setNewPhone("");
    setNewRole("STAFF");

    setOk("Team member added.");
    await loadTeam();
    setLoading(false);
  }

  async function updateField(user_id: string, patch: Partial<TeamUser>) {
    setErr("");
    setOk("");

    // prevent admin from removing own admin role (safety)
    if (user_id === meUserId && patch.role === "STAFF") {
      setErr("You cannot downgrade your own role.");
      return;
    }

    const { error } = await supabase.from("team_users").update(patch).eq("user_id", user_id);
    if (error) {
      setErr(error.message);
      return;
    }
    setOk("Updated.");
    setRows((prev) => prev.map((r) => (r.user_id === user_id ? { ...r, ...patch } as any : r)));
  }

  async function deleteMember(user_id: string) {
    setErr("");
    setOk("");

    if (user_id === meUserId) {
      setErr("You cannot delete yourself.");
      return;
    }

    const sure = window.confirm("Delete this team member? (This only removes from team_users)");
    if (!sure) return;

    const { error } = await supabase.from("team_users").delete().eq("user_id", user_id);
    if (error) {
      setErr(error.message);
      return;
    }
    setOk("Deleted.");
    setRows((prev) => prev.filter((r) => r.user_id !== user_id));
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-extrabold text-gray-800">Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-extrabold text-gray-900">No Access</div>
        <p className="mt-2 text-sm text-gray-600">
          This page is <b>Admin only</b>. Ask admin to grant your role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage members & roles (ADMIN / STAFF). Add users using user_id from Supabase Auth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTeam}
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
      {ok && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">
          {ok}
        </div>
      )}

      {/* Add member */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">Add Member</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-sm font-bold">User ID (UUID)</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Paste from Supabase Auth > Users > UID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-bold">Role</label>
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
            >
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-bold">Phone (WA)</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="60123456789"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-bold">Name</label>
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="e.g. Ali Marketing"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 flex items-end justify-end">
            <button
              onClick={addTeamUser}
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-60 md:w-auto"
            >
              Add
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Note: this does not create Auth user — you already create user in Supabase Auth. This only assigns role for the
          app.
        </p>
      </section>

      {/* List */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Members</h2>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-700">
            {rowsSorted.length}
          </span>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 font-extrabold">Name</th>
                <th className="p-3 font-extrabold">Phone</th>
                <th className="p-3 font-extrabold">Role</th>
                <th className="p-3 font-extrabold">User ID</th>
                <th className="p-3 font-extrabold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rowsSorted.map((r) => (
                <tr key={r.user_id} className="border-t border-gray-200">
                  <td className="p-3">
                    <input
                      className="w-full rounded-xl border border-gray-300 px-2 py-1"
                      value={r.name}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.user_id === r.user_id ? { ...x, name: e.target.value } : x))
                        )
                      }
                      onBlur={() => updateField(r.user_id, { name: r.name.trim() })}
                    />
                  </td>

                  <td className="p-3">
                    <input
                      className="w-full rounded-xl border border-gray-300 px-2 py-1"
                      value={r.phone || ""}
                      placeholder="60123456789"
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.user_id === r.user_id ? { ...x, phone: e.target.value } : x))
                        )
                      }
                      onBlur={() => updateField(r.user_id, { phone: (r.phone || "").trim() || null })}
                    />
                  </td>

                  <td className="p-3">
                    <select
                      className="w-full rounded-xl border border-gray-300 px-2 py-1 font-extrabold"
                      value={r.role}
                      onChange={(e) => updateField(r.user_id, { role: e.target.value as any })}
                      disabled={r.user_id === meUserId}
                      title={r.user_id === meUserId ? "You cannot change your own role here" : ""}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="STAFF">STAFF</option>
                    </select>
                  </td>

                  <td className="p-3 font-mono text-xs text-gray-700">{r.user_id}</td>

                  <td className="p-3">
                    <button
                      onClick={() => deleteMember(r.user_id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-100"
                      disabled={r.user_id === meUserId}
                      title={r.user_id === meUserId ? "You cannot delete yourself" : ""}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {rowsSorted.length === 0 && (
                <tr>
                  <td className="p-3 text-sm text-gray-600" colSpan={5}>
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
