import { supabase } from "./supabase";
import { maxPhotoSize } from "./listing-photo-format.mjs";
import { listingPhotoPathPattern } from "./listing-gallery.mjs";
import { maxSuggestionPhotos, maxSuggestionPhotoBytes, validateSuggestion } from "./listing-suggestion-content.mjs";
import { withDeadline } from "./verification-actions";

async function suggestionPhoto(item, signal) {
  signal.throwIfAborted();
  let blob = item.file;
  if (!blob && listingPhotoPathPattern.test(item.path || "")) {
    const url = supabase.storage.from("listing-photos").getPublicUrl(item.path).data.publicUrl;
    const response = await fetch(url, { signal, credentials: "omit" });
    if (!response.ok || Number(response.headers.get("content-length")) > maxPhotoSize) throw Error("Could not read this item photo. Upload a smaller photo and try again.");
    blob = await response.blob();
  }
  if (!blob || blob.size > maxPhotoSize) throw Error("Choose a readable item photo up to 5 MB.");
  const bitmap = await createImageBitmap(blob);
  try {
    signal.throwIfAborted();
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.55]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (Math.ceil((data.length - data.indexOf(",") - 1) * 3 / 4) <= maxSuggestionPhotoBytes) return data;
    }
    throw Error("This photo is too detailed for suggestions. Choose a smaller photo and try again.");
  } finally { bitmap.close(); }
}

export async function suggestListingDetails(items, signal) {
  const { data, error } = await withDeadline(supabase.auth.getSession(), 8000);
  if (error || !data.session?.access_token) throw Error("Sign in again before requesting photo suggestions.");
  const photos = [];
  for (const item of items.slice(0, maxSuggestionPhotos)) photos.push(await suggestionPhoto(item, signal));
  signal.throwIfAborted();
  const response = await fetch("/api/marketplace/listing-suggestions", { method: "POST", signal,
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ photos }) });
  let body;
  try { body = await response.json(); } catch { throw Error("Photo suggestions could not be loaded. Try again later or write the details manually."); }
  if (!response.ok) throw Error(body.message || "Photo suggestions are unavailable. Write the details manually for now.");
  const suggestion = validateSuggestion(body.suggestion);
  if (!suggestion) throw Error("The photo suggestions were incomplete. Try again or write the details manually.");
  return suggestion;
}
