import Link from "next/link";

export default function USAShoppingHero({ compact = false }) {
  if (compact) return <section className="usa-showcase usa-showcase-compact" aria-label="USA shopping and delivery">
    <div className="container usa-showcase-grid">
      <div className="usa-showcase-copy">
        <p className="usa-kicker">🇺🇸 → 🇵🇭 USA SHOPPING</p>
        <h2>USA to Philippines</h2>
        <p className="usa-intro">Share a US store link for shopping and shipping assistance.</p>
        <p className="usa-small">Item cost, service fees, shipping and import charges discussed before you confirm.</p>
      </div>
      <div className="usa-home-actions"><Link className="usa-find-button" href="/usa-shopping#usa-finds">Explore USA items</Link><Link className="usa-quote-button" href="/usa-shopping#usa-quote">Get a USA quote</Link></div>
    </div>
  </section>;

  return <section className="usa-shipping-hero" aria-labelledby="usa-shipping-title">
    <div className="container usa-shipping-content">
      <div className="usa-shipping-copy">
        <p className="usa-shipping-kicker">USA SHOPPING &amp; SHIPPING ASSISTANCE</p>
        <h1 id="usa-shipping-title">Shop in the USA.<br /><span>Ship to the Philippines.</span></h1>
        <p className="usa-shipping-intro">Found something on Amazon, eBay or another US store? Share the link and your delivery destination. We’ll discuss availability, item costs, service fees, shipping and import charges before you decide.</p>
        <div className="usa-shipping-actions">
          <Link className="usa-shipping-primary" href="#usa-quote">Get a USA quote</Link>
          <Link className="usa-shipping-secondary" href="#usa-finds">Explore USA finds</Link>
        </div>
        <p className="usa-shipping-note">Requesting a quote does not place an order or collect a payment.</p>
      </div>
      <ul className="usa-shipping-highlights" aria-label="USA shopping service highlights">
        <li><strong>USA → PH</strong><p>Shopping &amp; shipping assistance</p></li>
        <li><strong>Your find</strong><p>Choose an item from a US store</p></li>
        <li><strong>Full quote</strong><p>Review costs before any purchase</p></li>
        <li><strong>You decide</strong><p>Confirm before we proceed</p></li>
      </ul>
    </div>
  </section>;
}
