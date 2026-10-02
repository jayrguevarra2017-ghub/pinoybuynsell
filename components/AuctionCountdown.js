"use client";

import { useEffect, useState } from "react";

function getRemaining(endTime) {
  const difference = new Date(endTime).getTime() - Date.now();
  if (difference <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total: difference,
    hours: Math.floor(difference / 3600000),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export default function AuctionCountdown({ endTime }) {
  // Never call Date.now() during the initial render. This prevents SSR/client hydration mismatch.
  const [time, setTime] = useState(null);

  useEffect(() => {
    const update = () => setTime(getRemaining(endTime));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endTime]);

  if (!time) return <span className="auction-time-text">Loading...</span>;
  if (time.total <= 0) return <span className="auction-time-text ended">Auction ended</span>;
  return <span className="auction-time-text">{time.hours}h {time.minutes}m {time.seconds}s</span>;
}
