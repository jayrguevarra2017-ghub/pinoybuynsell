"use client";

import { useEffect, useState } from "react";
import { auctionClock } from "@/lib/auction-clock.mjs";

export default function AuctionCountdown({ endTime, startsAt, status = "active", showLabel = false }) {
  // Never call Date.now() during the initial render. This prevents SSR/client hydration mismatch.
  const [time, setTime] = useState(null);

  useEffect(() => {
    const options = { endTime, startsAt, status };
    const initial = auctionClock(options, Date.now());
    setTime(initial);
    if (!["active", "scheduled"].includes(initial.state)) return;
    const timer = window.setInterval(() => {
      const next = auctionClock(options, Date.now());
      setTime(next);
      if (!["active", "scheduled"].includes(next.state)) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endTime, startsAt, status]);

  if (!time) return <span className="auction-time-text">Checking auction time…</span>;
  return <span className={`auction-countdown ${time.state}`}>
    {showLabel && <small className="auction-countdown-label">{time.label}</small>}
    <span role="timer" aria-live="off" aria-label={`${time.label}: ${time.text}`} className="auction-time-text">{time.text}</span>
  </span>;
}
