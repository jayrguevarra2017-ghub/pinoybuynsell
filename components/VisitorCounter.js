"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function VisitorCounter() {
  const [total, setTotal] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function countVisit() {
      try {
        let visitor;
        try {
          visitor = localStorage.getItem("pinoybuynsell-visitor");
          if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(visitor || "")) {
            visitor = crypto.randomUUID();
            localStorage.setItem("pinoybuynsell-visitor", visitor);
          }
        } catch { visitor = crypto.randomUUID(); }
        const { data, error } = await supabase.rpc("record_marketplace_visit", { p_visitor: visitor });
        if (!cancelled && !error && /^\d+$/.test(String(data))) setTotal(String(data));
      } catch { /* An unavailable counter must not block the marketplace. */ }
    }
    countVisit();
    return () => { cancelled = true; };
  }, []);
  if (total === null) return null;
  return <div className="visitor-counter" title="One visit per browser per day. Counts begin when the counter is enabled.">
    <span aria-hidden="true">◉</span> Site visits <strong>{BigInt(total).toLocaleString("en-PH")}</strong>
  </div>;
}
