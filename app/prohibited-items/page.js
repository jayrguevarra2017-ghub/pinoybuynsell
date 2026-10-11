import Link from "next/link";
import Header from "@/components/Header";
import PaymentRules from "@/components/PaymentRules";
import {prohibitedItems,listingPolicyVersion} from "@/lib/listing-policy";
import { publicPageMetadata } from "@/lib/seo.mjs";
export const metadata=publicPageMetadata({ path: "/prohibited-items", title: "Prohibited Items & Marketplace Rules | PinoyBuyNSell",
 description: "Review items and services that cannot be listed, auctioned, or requested through PinoyBuyNSell, plus seller responsibilities and how to report a listing." });
export default function ProhibitedItems(){return <><Header/><main className="page"><div className="container narrow">
 <p className="eyebrow">MARKETPLACE RULES</p><h1>Items we do not accept</h1><p>Help keep PinoyBuyNSell safe. The following items and services must not be listed, auctioned, or requested through our USA shopping service.</p>
 <p>Policy version: {listingPolicyVersion}</p>
 <PaymentRules />
 <div className="prohibited-list">{prohibitedItems.map(item=><section key={item.title}><h2>{item.title}</h2><p>{item.details}</p></section>)}</div>
 <h2>Seller responsibilities</h2><p>Only list goods you own or are authorized to sell. Describe the item honestly, including defects, and use accurate photos. Sellers are responsible for complying with applicable laws and courier restrictions. An item not named above is not automatically permitted.</p>
 <h2>Review and removal</h2><p>Administrators may remove prohibited listings. Confirming the policy does not certify that an item is allowed, and ID approval does not approve a listing. If you are unsure, ask support before listing.</p>
 <h2>Report a prohibited listing</h2><p>Open the “Need help?” support popup, select Support team, and send the listing link and your concern. Do not send private IDs or payment information.</p>
 <Link className="view" href="/sell">Back to Sell an Item</Link>
 </div></main></>}
