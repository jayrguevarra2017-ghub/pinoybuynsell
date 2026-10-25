import Header from "@/components/Header";
import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo.mjs";

export const metadata = publicPageMetadata({ path: "/privacy", title: "Privacy & Advertising Cookies | PinoyBuyNSell",
  description: "Choose whether to allow optional Meta advertising cookies on PinoyBuyNSell and learn how website advertising events work." });

export default function PrivacyPage() {
  return <><Header /><main className="page"><div className="container narrow privacy-copy">
    <p className="eyebrow">YOUR CHOICES</p><h1>Privacy &amp; advertising cookies</h1>
    <p>Optional Meta advertising tracking helps us understand visits from Facebook ads and whether those visits lead to confirmed purchases. When a Meta Pixel is connected, you can choose Allow advertising or Only necessary. Your choice does not affect browsing, bidding, ordering or payment confirmation.</p>
    <h2>What advertising events contain</h2>
    <p>After you allow advertising, Meta can receive visits to supported public pages, public item identifiers and fixed listing prices. On My orders, a recent payment-confirmed purchase can include public item identifiers, quantity, the PHP total and a purchase event reference. Meta also processes browser and network information, the page URL and advertising cookies.</p>
    <p>Event payloads do not include contact names, email addresses, phone numbers, delivery addresses, identity documents, payment receipts, bank account details or transaction references. Automatic form matching is disabled. Sign-in, verification, checkout, support and administrator pages do not generate advertising events. Orders opened with a private order link are excluded too.</p>
    <h2>Manual payments and purchases</h2>
    <p>A receipt upload or unpaid order is not a Purchase event. With advertising allowed, a purchase can be recorded when the buyer returns to the general My orders page after the seller or administrator confirms payment. Older payments from before tracking or consent began are excluded. Blocking advertising, declining cookies or not returning to My orders can prevent a purchase event from being recorded.</p>
    <h2>Change your choice</h2>
    <p>When advertising tracking is configured, use Advertising preferences at the bottom of the page to change your choice. Only necessary stops future advertising events. Your browser stores this choice; clearing browser storage may show the choice again. Global Privacy Control, when enabled in your browser, keeps advertising tracking off.</p>
    <p>For details about Meta’s processing, read <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta’s Privacy Policy ↗</a>. For questions about this website, contact <a href="mailto:contact@pinoybuynsell.com">contact@pinoybuynsell.com</a>.</p>
    <Link className="view" href="/">Return to the marketplace</Link>
  </div></main></>;
}
