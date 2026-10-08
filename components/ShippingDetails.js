import { shippingLabel } from "@/lib/shipping";

export default function ShippingDetails({ product }) {
  return <p>{shippingLabel(product)}</p>;
}
