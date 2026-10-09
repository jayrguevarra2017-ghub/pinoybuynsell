"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listingPhotoPaths } from "@/lib/listing-gallery.mjs";

export default function ListingGallery({ product }) {
  const paths = useMemo(() => listingPhotoPaths(product), [product]);
  const [selected, setSelected] = useState(0), [open, setOpen] = useState(false);
  const dialog = useRef(null), opener = useRef(null);
  const active = Math.min(selected, Math.max(paths.length - 1, 0));
  const urls = paths.map(path => supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl);
  useEffect(() => { setSelected(0); setOpen(false); }, [product.id]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) { dialog.current.close(); opener.current?.focus(); }
  }, [open]);
  const move = direction => setSelected((active + direction + paths.length) % paths.length);
  return <section className="listing-gallery" aria-label="Item photos">
    {urls.length > 1 && <div className="listing-thumbnails" aria-label="Choose item photo">{urls.map((url, index) =>
      <button key={paths[index]} type="button" aria-label={`View photo ${index + 1}`} aria-pressed={index === active}
        onClick={() => setSelected(index)}><img src={url} alt="" loading="lazy" /></button>)}</div>}
    <div className="listing-gallery-main">
      {urls.length ? <>
        <button type="button" className="listing-gallery-enlarge" ref={opener} onClick={() => setOpen(true)} aria-label="Enlarge item photo">
          <img src={urls[active]} alt={product.title || "Item photo"} /><span>Enlarge ↗</span>
        </button>
        {urls.length > 1 && <div className="listing-gallery-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous photo">‹</button>
          <span>{active + 1} / {urls.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next photo">›</button>
        </div>}
      </> : <div className="listing-gallery-empty"><span aria-hidden="true">{product.icon || "🛍️"}</span><p>No photo attached</p></div>}
    </div>
    <dialog ref={dialog} className="listing-photo-dialog" aria-label="Enlarged item photo"
      onClose={() => { setOpen(false); opener.current?.focus(); }} onCancel={() => setOpen(false)}
      onKeyDown={event => {
        if (urls.length > 1 && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <button className="listing-photo-close" type="button" autoFocus onClick={() => setOpen(false)}>Close ✕</button>
      {open && urls[active] && <img src={urls[active]} alt={`${product.title} — photo ${active + 1}`} />}
      {urls.length > 1 && <div className="listing-gallery-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous enlarged photo">‹</button>
        <span>{active + 1} / {urls.length}</span>
        <button type="button" onClick={() => move(1)} aria-label="Next enlarged photo">›</button>
      </div>}
    </dialog>
  </section>;
}
