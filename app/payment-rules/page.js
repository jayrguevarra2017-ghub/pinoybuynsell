import Link from "next/link";
import Header from "@/components/Header";
import PaymentRules from "@/components/PaymentRules";
import { publicPageMetadata } from "@/lib/seo.mjs";
import { returnsPolicySummary, returnsDetailsNotice } from "@/lib/payment-rules.mjs";

export const metadata = publicPageMetadata({ path: "/payment-rules", title: "Payment & Return Rules | PinoyBuyNSell",
  description: "Purchases and winning bids are payable by GCash or bank deposit only. No COD or change-of-mind returns. Read payment and return rules before buying." });

export default function PaymentRulesPage() {
  return <><Header /><main className="page"><div className="container narrow">
    <p className="eyebrow">BUYING &amp; BIDDING</p><h1>Payment &amp; return rules</h1>
    <PaymentRules heading="Before buying or bidding" showLink={false} />
    <h2>Buying an item</h2>
    <p>Review the item details, availability and shipping fee, then confirm the purchase and payment details with the seller. Pay by GCash or bank deposit. Cash on delivery is not available.</p>
    <h2>Winning an auction</h2>
    <p>If you win an auction, the winning bid is the item price. Shipping is separate. Confirm the total and payment details with the seller and pay by GCash or bank deposit.</p>
    <h2>Payment arrangements</h2>
    <p>Payments are arranged directly with the seller. The website does not collect payments or automatically confirm that a payment was received.</p>
    <h2>Return policy</h2>
    <p>{returnsPolicySummary} Review the listing’s photos, description and condition before buying or bidding.</p>
    <p>{returnsDetailsNotice}</p>
    <h2>Need help?</h2>
    <p>Open the “Need help?” popup and choose the support team for help with a purchase or winning bid.</p>
    <Link className="view" href="/search">Browse listings</Link>
  </div></main></>;
}
