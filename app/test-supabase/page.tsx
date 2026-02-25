"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function TestSupabasePage() {
  const [clients, setClients] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("clients").select("*");
      if (error) setErr(error.message);
      else setClients(data || []);
    })();
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Supabase Test</h1>
      {err && <p className="mt-4 text-red-600 font-semibold">Error: {err}</p>}
      <ul className="mt-4 list-disc pl-6">
        {clients.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
