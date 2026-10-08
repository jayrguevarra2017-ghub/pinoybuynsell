"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

import { createListing, validatePhoto } from "@/lib/listing-photo";
import { shippingCarriers, validateShipping } from "@/lib/shipping";

export default function SellPage() {
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
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function choosePhoto(event) {
    const file = event.target.files?.[0] ?? null;
    const error = validatePhoto(file);
    setMessage(error);
    if (error) { event.target.value = ""; setPhoto(null); return; }
    setPhoto(file);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const shippingError = validateShipping(form.shipping_carrier, form.shipping_fee);
    if (shippingError) { setMessage(shippingError); return; }
    setSaving(true);
    setMessage("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/login"); return; }
      const data = await createListing(supabase, user.id, {
        title: form.title.trim(), description: form.description.trim(),
        price: Number(form.price), category: form.category, condition: form.condition,
        location: form.location.trim(), shipping_carrier: form.shipping_carrier,
        shipping_fee: Number(form.shipping_fee), status: "active",
      }, photo);
      setMessage("Item listed successfully!");
      if (data?.id) router.push(`/product/${data.id}`);
    } catch (error) {
      setMessage(error.message || "Could not confirm your listing. Check your listings before trying again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow">
          <p className="eyebrow">SELL ON PINOYBUYSELL</p>
          <h1>List an Item</h1>
          <p className="lead">
            Create your listing and start selling on PinoyBuyNSell.
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
            <div className="listing-form" style={{ marginBottom: "20px" }}>
              <label htmlFor="item-photo">Item photo (optional)
                <input id="item-photo" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={choosePhoto} disabled={saving} />
              </label>
              <p>Attach one JPEG, PNG, or WebP photo, up to 5 MB. Listing photos are public.</p>
              {photoPreview && <img src={photoPreview} alt="Selected item photo preview"
                style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }} />}
            </div>

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
              <strong>Price (₱)</strong>
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
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "6px",
                marginBottom: "16px",
              }}
            />

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

            <button type="submit" disabled={saving}>
              {saving ? "Publishing..." : "Publish Listing"}
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
