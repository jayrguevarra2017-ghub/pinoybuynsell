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
    <p>Review the item details, availability and shipping fee, then choose “Buy this item” and enter your delivery details. Your order includes the seller’s payment instructions. Pay by GCash or bank deposit. Cash on delivery is not available.</p>
    <h2>Winning an auction</h2>
    <p>If you win an auction, the winning bid is the item price. Shipping is separate. Open My orders to find auctions you won, then complete checkout. Pay the order total by GCash or bank deposit.</p>
    <h2>Payment arrangements</h2>
    <p>Send payment directly to the seller using the instructions in your order, then upload a private receipt photo and transaction reference in My orders. The seller or administrator checks the receipt and verifies the funds before confirming payment. The website does not collect money or automatically confirm payment. Unpaid orders reserve stock until paid or cancelled. Contact the seller or support for delivery, disputes and refunds.</p>
    <h2>Return policy</h2>
    <p>{returnsPolicySummary} Review the listing’s photos, description and condition before buying or bidding.</p>
    <p>{returnsDetailsNotice}</p>
    <h2>Need help?</h2>
    <p>Open the “Need help?” popup and choose the support team for help with a purchase or winning bid.</p>
    <Link className="view" href="/search">Browse listings</Link>
  </div></main></>;
}
