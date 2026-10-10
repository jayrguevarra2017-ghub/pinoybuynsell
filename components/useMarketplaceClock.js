"use client";
import { useEffect, useState } from "react";

export default function useMarketplaceClock() {
  // A stable initial value keeps server and browser markup consistent.
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
