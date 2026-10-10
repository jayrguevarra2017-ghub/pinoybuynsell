import { withDeadline } from "./verification-actions.js";

const fields = ["username", "full_name", "phone", "location"];

export async function readAccountProfile(client, userId, { timeoutMs = 20000 } = {}) {
  const result = await withDeadline(client.from("profiles").select(fields.join(",")).eq("id", userId).single(), timeoutMs);
  if (result.error || !result.data || Array.isArray(result.data) || fields.some(field => !Object.hasOwn(result.data, field)))
    throw Error("Your profile could not be loaded. Retry before editing.");
  return Object.fromEntries(fields.map(field => [field, typeof result.data[field] === "string" ? result.data[field] : ""]));
}

export async function saveAccountProfile(client, userId, profile, { timeoutMs = 20000 } = {}) {
  const values = Object.fromEntries(fields.map(field => [field, String(profile[field] || "").trim()]));
  const result = await withDeadline(client.from("profiles").update(values).eq("id", userId).select("id").maybeSingle(), timeoutMs);
  if (result.error || result.data?.id !== userId) throw Error("Could not confirm your profile save. Refresh your account to check before trying again.");
}
