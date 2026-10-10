"use client";
import { useParams } from "next/navigation";
import SellPage from "@/app/sell/page";

export default function RelistListingPage() {
  const { id } = useParams();
  return <SellPage key={id} sourceListingId={id} />;
}
