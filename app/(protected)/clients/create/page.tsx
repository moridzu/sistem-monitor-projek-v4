"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";

export default function CreateClientPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
  setErr("");

  if (!name.trim()) {
    setErr("Client name wajib isi.");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: name.trim(),
      company: company.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    setErr(error?.message || "Failed to create client.");
    setLoading(false);
    return;
  }

  // 🔥 redirect back to create project with new client preselected
  router.push(`/projects/create?clientId=${data.id}`);
}

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Add Client</h1>
        <Link
          href="/clients"
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-extrabold hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {err}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-extrabold text-gray-600">Client Name *</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bitara Medispa"
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-gray-600">Company</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Sdn Bhd / Enterprise"
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-gray-600">Phone</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="6012xxxxxxx"
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-gray-600">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@email.com"
          />
        </div>

        <div>
          <label className="text-xs font-extrabold text-gray-600">Notes</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Extra info about client..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/clients"
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-extrabold hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Create Client"}
          </button>
        </div>
      </div>
    </div>
  );
}