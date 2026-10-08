import { supabase } from "@/lib/supabase";

export default function ListingPhoto({ product, detail = false }) {
  if (!product.image_path) return detail ? null : <span>{product.icon || "🛍️"}</span>;
  const { data } = supabase.storage.from("listing-photos").getPublicUrl(product.image_path);
  return <img src={data.publicUrl} alt={product.title || "Item photo"}
    loading={detail ? "eager" : "lazy"}
    style={detail
      ? { width: "100%", maxHeight: "420px", objectFit: "contain", borderRadius: "12px", marginBottom: "20px" }
      : { width: "100%", height: "100%", objectFit: "cover" }} />;
}
