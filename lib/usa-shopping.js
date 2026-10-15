import { withDeadline } from "./verification-actions.js";

export async function submitUSARequest(client, form, { signal, timeoutMs = 15000 } = {}) {
  const validation = validateUSARequest(form);
  if (validation) throw Error(validation);
  const controller = new AbortController(), cancel = () => controller.abort();
  if (signal?.aborted) throw Error("Request cancelled.");
  signal?.addEventListener("abort", cancel, { once: true });
  const unknown = "Could not confirm your request. Check with the team before submitting again; it may already have been saved.";
  try {
    let result;
    try {
      result = await withDeadline(client.rpc("submit_usa_shopping_request", {
        p_contact_name: form.contact_name.trim(), p_contact_email: form.contact_email.trim(),
        p_contact_phone: form.contact_phone.trim(), p_destination: form.destination.trim(),
        p_item_name: form.item_name.trim(), p_item_url: form.item_url.trim(),
        p_quantity: Number(form.quantity), p_item_details: form.item_details.trim(),
      }).abortSignal(controller.signal), timeoutMs);
    } catch { throw Error(unknown); }
    if (controller.signal.aborted) throw Error(unknown);
    if (result.error?.code === "PGRST202") throw Error("The request service is not available yet. Please try again later.");
    if (result.error) throw Error(result.error.message || unknown);
    if (typeof result.data !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.data)) throw Error(unknown);
    return result.data;
  } finally { controller.abort(); signal?.removeEventListener("abort", cancel); }
}

export function validateUSARequest(form) {
  if (!form.contact_name?.trim() || form.contact_name.trim().length > 150) return "Enter your contact name (up to 150 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email || "") || form.contact_email.length > 254) return "Enter a valid contact email.";
  if (!form.contact_phone?.trim() || form.contact_phone.length > 40) return "Enter your phone number (up to 40 characters).";
  if (!form.destination?.trim() || form.destination.length > 200) return "Enter your delivery city and province.";
  if (!form.item_name?.trim() || form.item_name.length > 200) return "Enter the item name (up to 200 characters).";
  try {
    const url = new URL(form.item_url);
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password || form.item_url.length > 2000) return "Enter a full HTTPS item link.";
  } catch { return "Enter a full HTTPS item link."; }
  if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1 || Number(form.quantity) > 100) return "Enter a quantity between 1 and 100.";
  if (!form.item_details?.trim() || form.item_details.length > 3000) return "Describe the size, color, model, or other item details (up to 3,000 characters).";
  return "";
}
