import ShippingDetails from "@/components/ShippingDetails";
import Link from "next/link";
import Header from "@/components/Header";
import { products } from "@/lib/data";

export default function SearchPage({ searchParams }) {
  const category = searchParams?.category || "";
  const query = searchParams?.q || "";

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !category ||
      product.category?.toLowerCase() === category.toLowerCase();

    const matchesQuery =
      !query ||
      product.title?.toLowerCase().includes(query.toLowerCase()) ||
      product.description?.toLowerCase().includes(query.toLowerCase());

    return matchesCategory && matchesQuery;
  });

  return (
    <>
      <Header />

      <main className="page">
        <div className="container">
        <div style={{ marginBottom: "32px" }}>
          <p
            style={{
              color: "#1478ff",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Browse Marketplace
          </p>

          <h1 style={{ fontSize: "40px", margin: "8px 0" }}>
            {category
              ? `${category} Listings`
              : query
              ? `Search results for "${query}"`
              : "All Listings"}
          </h1>

          <p style={{ color: "#64748b" }}>
            Find great deals from sellers across the Philippines.
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "24px",
            }}
          >
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "20px",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                  }}
                >
                  {product.icon || "🛍️"}
                </div>

                <h2
                  style={{
                    fontSize: "20px",
                    marginBottom: "8px",
                  }}
                >
                  {product.title}
                </h2>

                <p
                  style={{
                    color: "#1478ff",
                    fontWeight: "700",
                    fontSize: "20px",
                  }}
                >
                  ₱{Number(product.price).toLocaleString()}
                </p>

                <ShippingDetails product={product} />

                {product.location && (
                  <p
                    style={{
                      color: "#64748b",
                      marginTop: "8px",
                    }}
                  >
                    📍 {product.location}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
            }}
          >
            <div style={{ fontSize: "50px" }}>🔎</div>

            <h2>No listings found</h2>

            <p style={{ color: "#64748b" }}>
              We couldn't find any items matching your search.
            </p>

            <Link
              href="/"
              style={{
                display: "inline-block",
                marginTop: "20px",
                padding: "12px 20px",
                background: "#1478ff",
                color: "#fff",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "700",
              }}
            >
              Back to Home
            </Link>
          </div>
        )}
        </div>
      </main>
    </>
  );
}
