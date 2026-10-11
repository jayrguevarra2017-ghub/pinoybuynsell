import Link from "next/link";
import { paymentMethodsSummary, paymentRulesScope, paymentDetailsNotice, returnsPolicySummary, returnsDetailsNotice } from "@/lib/payment-rules.mjs";

export default function PaymentRules({ heading = "Payment & returns", showLink = true }) {
  return <aside className="listing-payment-rules" aria-labelledby="payment-rules-title">
    <h2 id="payment-rules-title">{heading}</h2>
    <p><strong>{paymentMethodsSummary}</strong></p>
    <p>{paymentRulesScope} {paymentDetailsNotice}</p>
    <p><strong>{returnsPolicySummary}</strong> {returnsDetailsNotice}</p>
    {showLink && <Link href="/payment-rules">Read payment and return rules</Link>}
  </aside>;
}
