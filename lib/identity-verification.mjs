import { withDeadline } from "./verification-actions.js";
import { photoTypes, validatePhoto } from "./listing-photo-format.mjs";

const statusError = "Your verification status could not be loaded. Refresh the status before submitting an ID.";
const cancelled = signal => { if (signal?.aborted) throw Error("Request cancelled."); };

export async function readIdentityStatus(client, userId, { signal, timeoutMs = 15000 } = {}) {
  cancelled(signal);
  if (!userId) throw Error(statusError);
  let result;
  try {
    result = await withDeadline(client.from("identity_verifications").select("user_id,status,review_note")
      .eq("user_id", userId).maybeSingle().abortSignal(signal), timeoutMs);
  } catch { throw Error(statusError); }
  cancelled(signal);
  if (result.error || result.data === undefined || (result.data !== null &&
      (result.data.user_id !== userId || !["pending", "approved", "rejected"].includes(result.data.status)))) throw Error(statusError);
  return result.data;
}

export async function submitIdentity(client, userId, { name, type, file }, { signal, timeoutMs = 15000 } = {}) {
  cancelled(signal);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId || "")) throw Error("Sign in before submitting your ID.");
  const photoError = validatePhoto(file);
  if (!file || photoError || !Object.hasOwn(photoTypes, file.type)) throw Error(photoError || "Choose a JPEG, PNG or WebP ID photo up to 5 MB.");
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 150) throw Error("Enter your full name as shown on the ID.");
  if (!["PhilSys ID", "Passport", "Driver license", "Other government ID"].includes(type)) throw Error("Choose a government ID type.");
  const record = await readIdentityStatus(client, userId, { signal, timeoutMs });
  cancelled(signal);
  if (record && record.status !== "rejected") throw Error("Your verification is already pending or approved. Refresh your status.");
  const path = `${userId}/${crypto.randomUUID()}.${photoTypes[file.type]}`;
  const unknown = "Could not confirm your ID submission. Refresh your verification status before trying again; it may already have been saved.";
  try {
    const upload = await withDeadline(client.storage.from("identity-documents").upload(path, file, { contentType: file.type, upsert: false }), timeoutMs);
    cancelled(signal);
    if (upload.error) throw Error(unknown);
    const result = await withDeadline(client.rpc("submit_identity", { p_name: name.trim(), p_type: type, p_path: path }).abortSignal(signal), timeoutMs);
    cancelled(signal);
    if (result.error) throw Error(unknown);
  } catch { throw Error(unknown); }
}
