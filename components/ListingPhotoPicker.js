"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { prepareListingPhoto } from "@/lib/listing-photo-format.mjs";
import { maxListingPhotos } from "@/lib/listing-gallery.mjs";

export default function ListingPhotoPicker({ items, onChange, onPreparing, disabled }) {
  const [previews, setPreviews] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const urls = items.map(item => item.path
      ? supabase.storage.from("listing-photos").getPublicUrl(item.path).data.publicUrl
      : URL.createObjectURL(item.file));
    setPreviews(urls);
    return () => urls.forEach(url => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); });
  }, [items]);

  async function addPhotos(event) {
    const input = event.currentTarget, files = [...(input.files || [])];
    if (!files.length) return;
    if (items.length + files.length > maxListingPhotos) {
      setMessage(`Choose up to ${maxListingPhotos} photos in total. Remove a photo to add another.`); input.value = ""; return;
    }
    setMessage(""); setPreparing(true); onPreparing(true);
    try {
      const added = [];
      for (let index = 0; index < files.length; index++) {
        setMessage(`Preparing photo ${index + 1} of ${files.length}…`);
        added.push({ file: await prepareListingPhoto(files[index]) });
      }
      onChange([...items, ...added]); setMessage("Photos ready. The cover photo appears on listing cards and Facebook previews.");
    } catch (error) { setMessage(error.message); }
    finally { input.value = ""; setPreparing(false); onPreparing(false); }
  }

  return <section className="photo-picker" aria-labelledby="photo-picker-title">
    <h2 id="photo-picker-title">Item photos <small>(optional)</small></h2>
    <label htmlFor="item-photo">Add photos
      <input id="item-photo" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={addPhotos} disabled={disabled || preparing || items.length >= maxListingPhotos} />
    </label>
    <p>Up to {maxListingPhotos} photos, 5 MB each. JPEG, PNG, WebP, HEIC and HEIF accepted. HEIC/HEIF photos convert automatically to JPEG. Photos are public.</p>
    {message && <p role={preparing ? "status" : "alert"}>{message}</p>}
    {!!items.length && <div className="photo-picker-grid">{items.map((item, index) => <div className="photo-picker-item" key={item.path || previews[index] || index}>
      {previews[index] && <img src={previews[index]} alt={`Selected item photo preview ${index + 1}`} />}
      <span>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</span>
      <div>{index > 0 && <button type="button" disabled={disabled || preparing}
        onClick={() => onChange([item, ...items.filter((_, i) => i !== index)])}>Make cover</button>}
        <button type="button" disabled={disabled || preparing} aria-label={`Remove photo ${index + 1}`}
          onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button></div>
    </div>)}</div>}
  </section>;
}
