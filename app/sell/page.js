"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { syncFacebookAfterEdit } from "@/lib/facebook-edit-sync.mjs";
import { facebookPublishingUrl } from "@/lib/facebook-posting.mjs";
import { useApp } from "@/components/AppProvider";
import SellingComingSoon from "@/components/SellingComingSoon";
import { readRelistSource, relistListing } from "@/lib/listing-management.mjs";
import { withDeadline } from "@/lib/verification-actions";
import { minimumMarketplaceBid, readBidIncrementCapability, bidIncreaseChoices } from "@/lib/bid-increments.mjs";
import { paymentMethodsSummary, returnsPolicySummary } from "@/lib/payment-rules.mjs";

export default function SellingPage(props) {
  const app = useApp();
  return <SellPage key={`${app?.user?.id || "guest"}:${props.listingId || "new"}:${props.sourceListingId || ""}`} {...props} />;
}

function SellPage({ listingId = null, sourceListingId = null }) {
  const router = useRouter();
  const app = useApp();

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
    auction_bid_increment: "20",
  });

  const [existingListing, setExistingListing] = useState(null);
  const [auctionLocked, setAuctionLocked] = useState(false);
  const [loadingListing, setLoadingListing] = useState(Boolean(listingId || sourceListingId));
  const [loadError, setLoadError] = useState("");
  const [incrementsReady, setIncrementsReady] = useState(null);
  const [incrementCheckError, setIncrementCheckError] = useState("");
  useEffect(() => {
    if (!app?.isAdmin) return;
    let active = true;
    readBidIncrementCapability(supabase).then(ready => { if (active) setIncrementsReady(ready); })
      .catch(error => { if (active) { setIncrementsReady(false); setIncrementCheckError(error.message); } });
    return () => { active = false; };
  }, [app?.isAdmin]);
  let firstMinimum = "";
  try { firstMinimum = minimumMarketplaceBid({ starting_price: form.auction_starting_price || 0 }, form); } catch { /* Validation explains invalid terms on save. */ }

  useEffect(() => {
    if (!(listingId || sourceListingId) || !app?.isAdmin) return;
    let cancelled = false;
    async function loadListing() {
      setLoadingListing(true); setLoadError(""); setExistingListing(null);
      try {
        const { data: { user }, error: authError } = await withDeadline(supabase.auth.getUser());
        if (authError || !user) { router.push("/login"); return; }
        if (sourceListingId) {
          const data = await readRelistSource(supabase, user.id, sourceListingId);
          if (cancelled) return;
          setAuctionLocked(false); setExistingListing(data);
          setForm({ title: data.title ?? "", description: data.description ?? "",
            price: String(data.price ?? ""), category: data.category ?? "", condition: data.condition ?? "",
            location: data.location ?? "", shipping_carrier: data.shipping_carrier ?? "",
            shipping_fee: String(data.shipping_fee ?? ""), listing_type: data.listing_type ?? "fixed_price",
            quantity: data.listing_type === "auction" ? "1" : String(data.quantity > 0 ? data.quantity : data.variations?.length ? 0 : 1),
            variations: (data.variations || []).map(v => ({ name: v.name, quantity: String(v.quantity) })),
            auction_starting_price: String(data.auction_starting_price ?? ""), auction_ends_at: "",
            auction_bid_increment: String(bidIncreaseChoices.includes(Number(data.auction_bid_increment)) ? data.auction_bid_increment : 20) });
          return;
        }
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
          auction_ends_at: toManilaInput(data.auction_ends_at),
          auction_bid_increment: String(data.auction_bid_increment ?? "0.01") });
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      } finally {
        if (!cancelled) setLoadingListing(false);
      }
    }
    loadListing();
    return () => { cancelled = true; };
  }, [listingId, sourceListingId, router, app?.isAdmin, app?.user?.id]);

  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveResult, setSaveResult] = useState(null);
  const [relistOutcomeUnknown, setRelistOutcomeUnknown] = useState(false);
  const saveLock = useRef(false);

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
    setForm(current => ({ ...current, listing_type, ...(listing_type === "auction" ? { quantity: "1", variations: [],
      auction_bid_increment: current.auction_bid_increment === "0.01" ? "20" : current.auction_bid_increment } : {}) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!app?.isAdmin) return;
    if (saveLock.current || saving || checkingPhoto || loadingListing || loadError || relistOutcomeUnknown || !app.online
      || ((listingId || sourceListingId) && !existingListing)) return;
    if (!policyAccepted) { setMessage("Read and confirm the prohibited-items policy before saving your listing."); return; }
    if (form.listing_type === "auction" && incrementCheckError) { setMessage(incrementCheckError); return; }
    if (form.listing_type === "auction" && incrementsReady === null) { setMessage("Please wait while bidding settings are checked."); return; }
    const shippingError = validateShipping(form.shipping_carrier, form.shipping_fee);
    if (shippingError) { setMessage(shippingError); return; }
    const optionsError = validateListingOptions({ ...form, auction_ends_at: form.auction_ends_at ? `${form.auction_ends_at}+08:00` : "" }, Date.now(), auctionLocked);
    if (optionsError) { setMessage(optionsError); return; }
    saveLock.current = true;
    setSaving(true);
    setMessage("");

    try {
      const { data: { user }, error: userError } = await withDeadline(supabase.auth.getUser());
      if (userError || !user) { router.push("/login"); return; }
      if (user.id !== app.user?.id) throw Error("Your account changed. Sign in again before saving.");
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
        ...(incrementsReady ? {
          auction_bid_increment: Number(form.auction_bid_increment),
        } : {}),
      };
      const data = sourceListingId
        ? await relistListing(supabase, user.id, sourceListingId, values, photoItems ?? initialPhotoItems)
        : listingId
        ? await updateListing(supabase, user.id, listingId, values, photoItems)
        : await createListing(supabase, user.id, { ...values, status: "active" }, photoItems);
      if(listingId && data?.id) {
        // Website save is already committed. A Facebook error must never be
        // presented as a failed listing save or trigger another photo upload.
        setExistingListing(data); setPhotoItems(null);
        setMessage("Listing saved. Checking its Facebook update…");
        const facebook = await syncFacebookAfterEdit(supabase,String(data.id));
        if(facebook.status !== "skipped") { setSaveResult({id:data.id,facebook}); setMessage(""); return; }
      }
      setMessage(sourceListingId ? "Item relisted successfully!" : listingId ? "Listing updated successfully!" : "Item listed successfully!");
      if (data?.id) router.push(`/product/${data.id}`);
    } catch (error) {
      if (sourceListingId && /timed out|could not confirm|response lost|fetch|network/i.test(error.message || "")) setRelistOutcomeUnknown(true);
      setMessage(error.message || "Could not confirm your listing. Check your listings before trying again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (!app?.adminReady || app.adminError || !app.isAdmin) return <><Header /><main className="page"><div className="container narrow">
    <h1>{!app?.adminReady ? "Checking selling access…" : app.adminError ? "Selling access unavailable" : "Selling on PinoyBuyNSell"}</h1>
    {!app?.adminReady ? <p>Checking your account permissions…</p> : app.adminError ? <>
      <p role="alert">{app.adminError}</p><button type="button" onClick={app.refreshAdminAccess}>Try again</button>
    </> : <SellingComingSoon />}
    <Link className="view" href={app?.user ? "/account" : "/login"}>{app?.user ? "My account" : "Sign in"}</Link>
  </div></main></>;

  if (loadingListing || loadError) return <><Header /><main className="page"><div className="container narrow">
    <h1>{loadingListing ? "Loading your listing..." : sourceListingId ? "Cannot relist listing" : "Cannot edit listing"}</h1>
    {loadError && <p role="alert">{loadError}</p>}
    <a className="view" href="/account">Back to my account</a>
  </div></main></>;

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow">
          <p className="eyebrow">SELL ON PINOYBUYSELL</p>
          <h1>{sourceListingId ? "Relist an Item" : listingId ? "Edit Listing" : "List an Item"}</h1>
          <p className="lead">
            {sourceListingId ? "Review the copied details and photos, then publish a fresh listing. Choose a new closing time for an auction." : listingId ? "Update your item details, selling options, shipping, or photo." : "Choose a fixed price or let buyers bid on your item."}
          </p>
          {sourceListingId && <p>The previous listing and its bids stay in your history. The new auction starts with the starting bid you choose. Confirm that the item is still available before publishing.</p>}
          {listingId && <p className="muted">Saving an edit automatically updates the text of a linked Facebook Page post. Changed photos or link previews need an edit on Facebook.</p>}

          {saveResult ? <section className="listing-save-result" aria-labelledby="listing-save-result-title">
            <h2 id="listing-save-result-title">Your website listing is saved</h2>
            <p role="status" aria-live="polite">{saveResult.facebook.message}</p>
            <div className="listing-share-actions">
              <Link className="view inline" href={`/product/${saveResult.id}`}>View updated listing</Link>
              <Link className="view inline" href={facebookPublishingUrl(saveResult.id)}>Check Facebook update</Link>
              <button className="view inline" type="button" onClick={() => {setSaveResult(null);setMessage("");}}>Edit again</button>
            </div>
          </section> : <form
            onSubmit={handleSubmit}
            style={{
              marginTop: "30px",
              padding: "24px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
          >
            <fieldset className="listing-edit-fields" disabled={saving || relistOutcomeUnknown || !app.online}>
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
              <p><strong>Payment rules: {paymentMethodsSummary} {returnsPolicySummary}</strong> Applies to purchases and winning bids. <Link href="/payment-rules">Read payment and return rules</Link></p>
              {auctionLocked && <p role="status">Bids have been placed. Selling format, price, quantity, variations, bid increase and auction closing time are locked.</p>}
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
                <label htmlFor="bid-increment-value">Minimum bid increase (₱)
                  <select id="bid-increment-value" name="auction_bid_increment" value={form.auction_bid_increment}
                    onChange={handleChange} disabled={saving || auctionLocked || !incrementsReady}>
                    {listingId && form.auction_bid_increment === "0.01" && <option value="0.01">₱0.01 — existing auction rule</option>}
                    {bidIncreaseChoices.map(amount => <option value={amount} key={amount}>₱{amount.toLocaleString("en-PH")}</option>)}
                  </select>
                </label>
                {incrementCheckError ? <p role="alert">{incrementCheckError}</p>
                  : incrementsReady === null ? <p role="status">Checking bidding settings…</p>
                  : !incrementsReady ? <p role="status">Custom bid increases are not available yet. New auctions use a ₱0.01 minimum increase.</p>
                  : <p>Choose ₱20, ₱40, ₱60 and so on, up to ₱1,000. Each bid must increase by at least your chosen amount. Bidders may offer more.
                    {firstMinimum && <> First allowed bid: <strong>₱{Number(firstMinimum).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.</>}</p>}
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
              {checkingPhoto ? "Preparing photo…" : saving ? "Saving..." : sourceListingId ? "Publish Relisted Item" : listingId ? "Save Changes" : "Publish Listing"}
            </button>
            </fieldset>

            {message && (
              <p role="status" style={{ marginTop: "15px" }}>
                <strong>{message}</strong>
              </p>
            )}
            {relistOutcomeUnknown && <Link className="view" href="/account#my-listings">Check My listings before trying again</Link>}
            {!app.online && <p>Reconnect before saving your listing.</p>}
          </form>}
        </div>
      </main>
    </>
  );
}
