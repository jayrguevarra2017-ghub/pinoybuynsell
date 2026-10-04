"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

export default function ProductPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, seller_id, title, description, price, category, condition, location, status, created_at"
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Product load error:", error);
        setErrorMessage(error.message);
        setProduct(null);
      } else {
        setProduct(data);
      }

      setLoading(false);
    }

    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container">
            <h1>Loading item...</h1>
          </div>
        </main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container">
            <h1>Item not found</h1>

            {errorMessage && (
              <p style={{ marginTop: "15px" }}>
                Error: {errorMessage}
              </p>
            )}

            <Link className="view inline" href="/">
              ← Back home
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="page">
        <div className="container narrow">
          <Link href="/" className="back">
            ← Back to marketplace
          </Link>

          <div
            style={{
              marginTop: "25px",
              padding: "28px",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
            }}
          >
            <p className="eyebrow">PINoyBuyNSell LISTING</p>

            <h1>{product.title}</h1>

            <h2 style={{ marginTop: "15px" }}>
              ₱{Number(product.price).toLocaleString("en-PH")}
            </h2>

            <div style={{ marginTop: "25px" }}>
              <p>
                <strong>Category:</strong> {product.category}
              </p>

              <p>
                <strong>Condition:</strong> {product.condition}
              </p>

              <p>
                <strong>Location:</strong> {product.location}
              </p>

              <p>
                <strong>Status:</strong> {product.status}
              </p>
            </div>

            <div style={{ marginTop: "30px" }}>
              <h3>Description</h3>
              <p style={{ marginTop: "10px" }}>
                {product.description}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
