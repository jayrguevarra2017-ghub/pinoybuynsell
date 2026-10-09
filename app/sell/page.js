"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

import ListingPhotoPicker from "@/components/ListingPhotoPicker";
import { listingPhotoPaths } from "@/lib/listing-gallery.mjs";
import { createListing, updateListing } from "@/lib/listing-photo";
import Link from "next/link";
import { prohibitedItems, listingPolicyVersion } from "@/lib/listing-policy";
import { shippingCarriers, validateShipping } from "@/lib/shipping";
import { validateListingOptions, toManilaInput, fromManilaInput, maxVariations } from "@/lib/listing-options.mjs";

export default function SellPage({ listingId = null }) {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    location: "",
    shipping_carrier: "",
    shipping_fee: "",
    listing_type: "fixed_price",
    quantity: "1",
    variations: [],
    auction_starting_price: "",
    auction_ends_at: "",
  });

  const [existingListing, setExistingListing] = useState(null);
  const [auctionLocked, setAuctionLocked] = useState(false);
  const [loadingListing, setLoadingListing] = useState(Boolean(listingId));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    async function loadListing() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) { router.push("/login"); return; }
        const { data, error } = await supabase.from("products").select("*")
          .eq("id", listingId).eq("seller_id", user.id).single();
        if (error || !data || data.deleted_at) throw new Error("This listing is unavailable or does not belong to you.");
        const auctions = await supabase.from("auctions").select("starting_price,current_bid")
          .eq("product_id", listingId);
        if (auctions.error) throw new Error("Could not check bidding settings. Please refresh before editing.");
        if (cancelled) return;
        setAuctionLocked((auctions.data || []).some(a => Number(a.current_bid) > Number(a.starting_price)));
        setExistingListing(data);
        setForm({ title: data.title ?? "", description: data.description ?? "",
          price: String(data.price ?? ""), category: data.category ?? "",
          condition: data.condition ?? "", location: data.location ?? "",
          shipping_carrier: data.shipping_carrier ?? "", shipping_fee: String(data.shipping_fee ?? ""),
          listing_type: data.listing_type ?? "fixed_price", quantity: String(data.quantity ?? 1),
          variations: (data.variations || []).map(v => ({ name: v.name, quantity: String(v.quantity) })),
          auction_starting_price: String(data.auction_starting_price ?? ""),
          auction_ends_at: toManilaInput(data.auction_ends_at) });
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      } finally {
        if (!cancelled) setLoadingListing(false);
      }
    }
    loadListing();
    return () => { cancelled = true; };
  }, [listingId, router]);

  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [photoItems, setPhotoItems] = useState(null);
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const initialPhotoItems = useMemo(() => listingPhotoPaths(existingListing).map(path => ({ path })), [existingListing]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function changeVariations(variations) {
    setForm(current => ({ ...current, variations,
      quantity: variations.length ? String(variations.reduce((sum, v) => sum + Number(v.quantity || 0), 0)) : "1" }));
  }

  function changeFormat(event) {
    const listing_type = event.target.value;
    setForm(current => ({ ...current, listing_type, ...(listing_type === "auction" ? { quantity: "1", variations: [] } : {}) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || checkingPhoto || loadingListing || loadError || (listingId && !existingListing)) return;
    if (!policyAccepted) { setMessage("Read and confirm the prohibited-items policy before saving your listing."); return; }
    const shippingError = validateShipping(form.shipping_carrier, form.shipping_fee);
    if (shippingError) { setMessage(shippingError); return; }
    const optionsError = validateListingOptions({ ...form, auction_ends_at: form.auction_ends_at ? `${form.auction_ends_at}+08:00` : "" }, Date.now(), auctionLocked);
    if (optionsError) { setMessage(optionsError); return; }
    setSaving(true);
    setMessage("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); return; }
      const verification = await supabase.rpc("is_marketplace_verified");
      if (verification.error || !verification.data) {
        setMessage("Submit your ID and wait for administrator approval before selling or editing listings.");
        return;
      }
      const values = {
        title: form.title.trim(), description: form.description.trim(),
        price: Number(form.price), category: form.category, condition: form.condition,
        location: form.location.trim(), shipping_carrier: form.shipping_carrier,
        shipping_fee: Number(form.shipping_fee),
        listing_policy_version: listingPolicyVersion,
        listing_type: form.listing_type, quantity: Number(form.quantity),
        variations: form.variations.map(v => ({ name: v.name.trim(), quantity: Number(v.quantity) })),
        auction_starting_price: form.listing_type === "auction" ? Number(form.auction_starting_price) : null,
        auction_ends_at: form.listing_type === "auction"
          ? (auctionLocked ? existingListing.auction_ends_at : fromManilaInput(form.auction_ends_at)) : null,
      };
      const data = listingId
        ? await updateListing(supabase, user.id, listingId, values, photoItems)
        : await createListing(supabase, user.id, { ...values, status: "active" }, photoItems);
      setMessage(listingId ? "Listing updated successfully!" : "Item listed successfully!");
      if (data?.id) router.push(`/product/${data.id}`);
    } catch (error) {
      setMessage(error.message || "Could not confirm your listing. Check your listings before trying again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingListing || loadError) return <><Header /><main className="page"><div className="container narrow">
    <h1>{loadingListing ? "Loading your listing..." : "Cannot edit listing"}</h1>
    {loadError && <p role="alert">{loadError}</p>}
    <a className="view" href="/account">Back to my account</a>
  </div></main></>;

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow">
          <p className="eyebrow">SELL ON PINOYBUYSELL</p>
          <h1>{listingId ? "Edit Listing" : "List an Item"}</h1>
          <a className="view" href="/verify">Verify your account to sell</a>
          <p className="lead">
            {listingId ? "Update your item details, selling options, shipping, or photo." : "Choose a fixed price or let buyers bid on your item."}
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: "30px",
              padding: "24px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
          >
            <ListingPhotoPicker items={photoItems ?? initialPhotoItems} onChange={setPhotoItems}
              onPreparing={setCheckingPhoto} disabled={saving} />

            <label>
              <strong>Item Title</strong>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Example: iPhone 15 Pro Max"
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            />

            <label>
              <strong>Description</strong>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe your item"
              required
              rows="5"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            />

            <label>
              <strong>{form.listing_type === "auction" ? "Item value (₱)" : "Price per item (₱)"}</strong>
            </label>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              disabled={auctionLocked}
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            />

            <section className="listing-options listing-form" aria-labelledby="selling-options-title">
              <h2 id="selling-options-title">Selling options</h2>
              {auctionLocked && <p role="status">Bids have been placed. Selling format, price, quantity, variations and auction closing time are locked.</p>}
              <label htmlFor="listing-type">Is this item for bidding?
                <select id="listing-type" name="listing_type" value={form.listing_type}
                  onChange={changeFormat} disabled={saving || auctionLocked}>
                  <option value="fixed_price">No — fixed-price listing</option>
                  <option value="auction">Yes — auction / bidding</option>
                </select>
              </label>
              <label htmlFor="listing-quantity">{form.variations.length ? "Total quantity across variations" : "Quantity available"}
                <input id="listing-quantity" name="quantity" type="number" min="0" max="1000000" step="1" required
                  value={form.quantity} onChange={handleChange} readOnly={form.variations.length > 0}
                  disabled={saving || auctionLocked || form.listing_type === "auction"} />
              </label>
              {form.listing_type === "auction" ? <>
                <p>Bidding is for one item or one lot. Describe everything included in the lot. Selectable variations are cleared when choosing an auction.</p>
                <label htmlFor="auction-starting-price">Starting bid (₱)
                  <input id="auction-starting-price" name="auction_starting_price" type="number" min="0.01" max="99999999999999.99"
                    step="0.01" required value={form.auction_starting_price} onChange={handleChange} disabled={saving || auctionLocked} />
                </label>
                <label htmlFor="auction-ends-at">Auction closes (Philippine time, UTC+8)
                  <input id="auction-ends-at" name="auction_ends_at" type="datetime-local" step="1" required
                    value={form.auction_ends_at} onChange={handleChange} disabled={saving || auctionLocked} />
                </label>
                <p>Bidding starts when you save the listing. The item value is a reference; buyers bid from the starting bid.</p>
              </> : <>
                <h3>Variations (optional)</h3>
                <p>Add choices such as “Black / 128 GB” or “Blue / Medium”. All variations use the same item price. Set each choice’s available quantity.</p>
                {form.variations.map((variation, index) => <div className="variation-row" key={index}>
                  <label htmlFor={`variation-name-${index}`}>Variation {index + 1}
                    <input id={`variation-name-${index}`} type="text" required maxLength="100" value={variation.name}
                      placeholder="Example: Black / 128 GB" disabled={saving || auctionLocked}
                      onChange={event => changeVariations(form.variations.map((v, i) => i === index ? { ...v, name: event.target.value } : v))} />
                  </label>
                  <label htmlFor={`variation-qty-${index}`}>Quantity
                    <input id={`variation-qty-${index}`} type="number" min="0" max="1000000" step="1" required
                      value={variation.quantity} disabled={saving || auctionLocked}
                      onChange={event => changeVariations(form.variations.map((v, i) => i === index ? { ...v, quantity: event.target.value } : v))} />
                  </label>
                  <button type="button" className="secondary" disabled={saving || auctionLocked}
                    aria-label={`Remove variation ${index + 1}`} onClick={() => changeVariations(form.variations.filter((_, i) => i !== index))}>Remove</button>
                </div>)}
                <button type="button" className="secondary" disabled={saving || auctionLocked || form.variations.length >= maxVariations}
                  onClick={() => changeVariations([...form.variations, { name: "", quantity: "1" }])}>+ Add variation</button>
              </>}
            </section>

            <label>
              <strong>Category</strong>
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            >
              <option value="">Select category</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home & Living">Home & Living</option>
              <option value="Sports">Sports</option>
              <option value="Collectibles">Collectibles</option>
              <option value="Vehicles">Vehicles</option>
              <option value="Other">Other</option>
            </select>

            <label>
              <strong>Condition</strong>
            </label>
            <select
              name="condition"
              value={form.condition}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            >
              <option value="">Select condition</option>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Used">Used</option>
              <option value="For Parts">For Parts</option>
            </select>

            <label>
              <strong>Location</strong>
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="City / Province"
              required
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "20px",
              }}
            />

            <div className="listing-form" style={{ marginBottom: "20px" }}>
              <label htmlFor="shipping-carrier">Shipping carrier
                <select id="shipping-carrier" name="shipping_carrier" required
                  value={form.shipping_carrier} onChange={handleChange}>
                  <option value="">Select shipping carrier</option>
                  {shippingCarriers.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}
                </select>
              </label>
              <label htmlFor="shipping-fee">Shipping fee (₱)
                <input id="shipping-fee" name="shipping_fee" type="number" min="0"
                  max="99999999.99" step="0.01" required value={form.shipping_fee}
                  onChange={handleChange} placeholder="Enter shipping fee" />
              </label>
              <p>Enter the fee buyers will pay for this listing. Enter 0 for free shipping. The fee is displayed separately from the item price or bid.</p>
            </div>

            <section className="listing-restrictions" aria-labelledby="listing-rules-title">
              <h2 id="listing-rules-title">Before you list</h2>
              <p>We do not accept these items:</p>
              <ul>{prohibitedItems.map(item => <li key={item.title}>{item.title}</li>)}</ul>
              <Link href="/prohibited-items" target="_blank" rel="noopener noreferrer">Read the full prohibited-items policy ↗</Link>
              <label className="policy-confirm"><input type="checkbox" required checked={policyAccepted}
                onChange={event => setPolicyAccepted(event.target.checked)} />
                <span>I have read the policy and confirm this listing does not contain prohibited items. I understand it may be removed if it violates the rules.</span>
              </label>
            </section>

            <button type="submit" disabled={saving || checkingPhoto}>
              {checkingPhoto ? "Preparing photo…" : saving ? "Saving..." : listingId ? "Save Changes" : "Publish Listing"}
            </button>

            {message && (
              <p style={{ marginTop: "15px" }}>
                <strong>{message}</strong>
              </p>
            )}
          </form>
        </div>
      </main>
    </>
  );
}
