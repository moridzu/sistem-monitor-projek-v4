"use client";

import { useEffect } from "react";
import { supabase } from "@/utils/supabase/client";

export default function HomePage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      window.location.href = data.session ? "/dashboard" : "/login";
    });
  }, []);

  return <div className="p-6">Redirecting…</div>;
}
