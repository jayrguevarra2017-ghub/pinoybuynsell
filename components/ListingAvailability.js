"use client";
import { useState } from "react";

export default function ListingAvailability({ product }) {
  const [selected, setSelected] = useState("");
  const [wanted, setWanted] = useState("1");
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const choice = selected === "" ? null : variations[Number(selected)];
  const available = variations.length ? (choice ? Number(choice.quantity) : null) : Number(product.quantity ?? 1);
  if (product.listing_type === "auction") return <p><strong>Quantity:</strong> One item or lot, as described by the seller.</p>;
  return <section className="listing-options listing-form" aria-labelledby="availability-title">
    <h3 id="availability-title">Availability</h3>
    <p><strong>Total quantity:</strong> {Number(product.quantity ?? 1).toLocaleString("en-PH")}</p>
    {variations.length > 0 && <label htmlFor="item-variation">Choose a variation
      <select id="item-variation" value={selected} onChange={event => { setSelected(event.target.value); setWanted("1"); }}>
        <option value="">Select a variation</option>
        {variations.map((v, i) => <option key={i} value={i} disabled={Number(v.quantity) === 0}>
          {v.name} — {Number(v.quantity) === 0 ? "Out of stock" : `${v.quantity} available`}
        </option>)}
      </select>
    </label>}
    {available === 0 ? <p className="stock-unavailable">Out of stock</p> : available !== null && <>
      {choice && <p><strong>{choice.name}:</strong> {available} available</p>}
      <label htmlFor="item-quantity-wanted">Quantity wanted
        <input id="item-quantity-wanted" type="number" min="1" max={available} step="1" value={wanted}
          onChange={event => setWanted(event.target.value)} />
      </label>
      {(!/^\d+$/.test(wanted) || Number(wanted) < 1 || Number(wanted) > available) && <p role="alert">Choose a whole quantity from 1 to {available}.</p>}
    </>}
    <p>Confirm your choice, quantity and availability with the seller before buying. Selecting here does not reserve stock or place an order.</p>
  </section>;
}
