export function auctionClock({ endTime, startsAt, status = "active" }, now) {
  const end = Date.parse(endTime);
  const start = startsAt ? Date.parse(startsAt) : null;
  if (!Number.isFinite(end) || (startsAt && !Number.isFinite(start)) || (start !== null && start >= end)) {
    return { state: "unavailable", label: "Auction time unavailable", text: "Check the listing details" };
  }
  if (status !== "active" || end <= now) return { state: "ended", label: "Bidding closed", text: "Auction ended" };
  const scheduled = start !== null && start > now;
  const seconds = Math.ceil(((scheduled ? start : end) - now) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const pad = value => String(value).padStart(2, "0");
  return { state: scheduled ? "scheduled" : "active", label: scheduled ? "Bidding starts in" : "Time left to bid",
    text: `${days ? `${days}d ` : ""}${pad(hours)}h ${pad(minutes)}m ${pad(remainingSeconds)}s` };
}
