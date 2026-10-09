"use client";

import { useEffect, useState } from "react";
import { recordVisit, visitorToken } from "@/lib/visitor-counter.mjs";

export default function VisitorCounter() {
  const [total, setTotal] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let retry;
    let controller;
    let deadline;
    let visitor;
    async function countVisit() {
      try {
        if (!visitor) {
          let storage;
          try { storage = window.localStorage; } catch { /* Use an in-memory visitor token. */ }
          visitor = visitorToken(storage);
        }
        controller = new AbortController();
        deadline = window.setTimeout(() => controller.abort(), 6000);
        const result = await recordVisit({ url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, visitor, signal: controller.signal });
        if (!cancelled) { setTotal(result); setUnavailable(false); }
        return true;
      } catch { if (!cancelled) setUnavailable(true); return false; }
      finally { window.clearTimeout(deadline); }
    }
    async function load() {
      const success = await countVisit();
      if (!cancelled && !success) retry = window.setTimeout(countVisit, 5000);
    }
    load();
    return () => { cancelled = true; window.clearTimeout(retry); window.clearTimeout(deadline); controller?.abort(); };
  }, []);
  return <div className="visitor-counter" title={unavailable ? "Visitor total is temporarily unavailable. Please refresh to try again."
    : "One visit per browser per day. Counts begin when the counter is enabled."}>
    <span aria-hidden="true">◉</span> Site visits <strong>{total !== null ? BigInt(total).toLocaleString("en-PH") : unavailable ? "—" : "Loading…"}</strong>
  </div>;
}
