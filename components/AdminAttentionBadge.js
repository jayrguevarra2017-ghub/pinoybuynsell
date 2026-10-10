"use client";
import { adminAttentionLabel } from "@/lib/admin-attention.mjs";

export default function AdminAttentionBadge({ state }) {
  if (!state?.ready || state.allowed === false || (state.total === 0 && !state.unavailable.length)) return null;
  const partial = state.unavailable.length > 0;
  const count = state.total;
  return <span className="admin-attention-badge" role="img" aria-label={adminAttentionLabel(state)} title={adminAttentionLabel(state)}>
    {count > 0 ? `${count > 99 ? "99" : count}${count > 99 || partial ? "+" : ""}` : "!"}
  </span>;
}
