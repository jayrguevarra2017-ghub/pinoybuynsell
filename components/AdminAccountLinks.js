"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { adminAttentionLabel, adminAttentionQueues } from "@/lib/admin-attention.mjs";

export default function AdminAccountLinks() {
  const app = useApp();
  if (!app?.isAdmin) return null;
  const state = app.adminAttention;
  return <section id="administrator-tools" className="account-admin-tools" aria-label="Administrator tools">
    <h2>Administrator tools</h2>
    <div className="admin-attention-summary">
      <p role="status">{app.online ? adminAttentionLabel(state) : "Reconnect to check administrator tasks."}</p>
      <details className="admin-count-explanation"><summary>How task counts work</summary>
        <p className="muted">Open support conversations count until closed, including conversations you have replied to. USA requests count until closed, including contacted customers.</p>
      </details>
      <button type="button" className="view" disabled={!app.online || state.refreshing} onClick={app.refreshAdminAttention}>
        {state.refreshing ? "Refreshing counts…" : "Refresh task counts"}
      </button>
      {state.updatedAt && <small>Last checked: {new Date(state.updatedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })} · Updates every 30 seconds while this tab is visible.</small>}
    </div>
    {adminAttentionQueues.map(queue => <Link key={queue.key} className="view admin-queue-link" href={queue.href}>
      <span>{queue.label}</span>
      <span className={`admin-queue-count${state.counts[queue.key] > 0 ? " needs-attention" : ""}`}>
        {Number.isSafeInteger(state.counts[queue.key]) ? state.counts[queue.key].toLocaleString("en-PH") : state.ready ? "Unavailable" : "…"}
      </span>
    </Link>)}
    <Link className="view" href="/sell">Sell an item</Link>
    <Link className="view" href="/admin/listings">Administrator listing management</Link>
    <Link className="view" href="/admin/facebook">Post your listings to Facebook</Link>
  </section>;
}
