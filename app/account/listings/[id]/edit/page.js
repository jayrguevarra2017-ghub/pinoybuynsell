"use client";

import { useParams } from "next/navigation";
import SellPage from "@/app/sell/page";

export default function EditListingPage() {
  const { id } = useParams();
  return <SellPage key={id} listingId={id} />;
}
