"use client";
import { useEffect, useRef, useState } from "react";
import { suggestListingDetails } from "@/lib/listing-suggestion-client";
import { maxSuggestionPhotos } from "@/lib/listing-suggestion-content.mjs";
import { withDeadline } from "@/lib/verification-actions";

export default function ListingPhotoSuggestions({ items, disabled, onUse, title, description }) {
  const [suggestion, setSuggestion] = useState(null), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(null), latest = useRef(items);
  latest.current = items;
  useEffect(() => {
    pending.current?.abort(); pending.current = null;
    setSuggestion(null); setMessage(""); setBusy(false);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [items]);

  async function generate() {
    if (disabled || !items.length || pending.current) return;
    const controller = new AbortController(), snapshot = items;
    pending.current = controller; setBusy(true); setSuggestion(null); setMessage("");
    try {
      const result = await withDeadline(suggestListingDetails(snapshot, controller.signal), 45000);
      if (!controller.signal.aborted && latest.current === snapshot) setSuggestion(result);
    } catch (error) {
      if (!controller.signal.aborted && latest.current === snapshot)
        setMessage(error.message || "Could not read the photos. Try again or write the details manually.");
    } finally {
      controller.abort();
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  return <section className="listing-photo-suggestions" aria-labelledby="photo-suggestions-title" aria-busy={busy}>
    <h2 id="photo-suggestions-title">Write details from photos</h2>
    <p>Add clear front and back photos, then get a suggested title and description. Only the first {maxSuggestionPhotos} photos are analyzed. Requesting suggestions sends resized copies to OpenAI.</p>
    <button className="view" type="button" onClick={generate} disabled={disabled || busy || !items.length}>
      {busy ? "Reading item photos…" : "Suggest title & description"}
    </button>
    {!items.length && <p>Add an item photo to get suggestions.</p>}
    {busy && <p role="status">Reading the photos. You can continue editing your listing.</p>}
    {message && <p role="alert">{message}</p>}
    {suggestion && <div className="listing-suggestion-preview">
      <p role="status">Suggestions ready. Check every detail before using them.</p>
      <h3>Suggested title</h3><p>{suggestion.title}</p>
      <button type="button" className="view" disabled={disabled} onClick={() => onUse("title", suggestion.title)}>{title.trim() ? "Replace title with suggestion" : "Use suggested title"}</button>
      <h3>Suggested description</h3><p className="listing-suggestion-description">{suggestion.description}</p>
      <button type="button" className="view" disabled={disabled} onClick={() => onUse("description", suggestion.description)}>{description.trim() ? "Replace description with suggestion" : "Use suggested description"}</button>
      {!!suggestion.uncertain_details.length && <><h3>Details to confirm</h3><ul>{suggestion.uncertain_details.map((detail, index) => <li key={index}>{detail}</li>)}</ul></>}
      <p>Confirm the item identity, printed text, condition and authenticity yourself. Enter price and shipping separately.</p>
    </div>}
  </section>;
}
