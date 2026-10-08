import Link from "next/link";

export default function USAShoppingHero({ compact = false }) {
  return <section className={`usa-showcase${compact ? " usa-showcase-compact" : ""}`}>
    <div className="container usa-showcase-grid">
      <div className="usa-showcase-copy">
        <p className="usa-kicker">YOUR USA WISHLIST, CLOSER TO HOME</p>
        {compact ? <h2>You find it.<br />We help bring it <em>home.</em></h2> : <h1>You find it.<br />We help bring it <em>home.</em></h1>}
        <p className="usa-intro">That pair of sneakers. A gift you can’t find here. Your next favorite gadget. Share a US store link and let’s work out how to bring it to the Philippines.</p>
        <Link className="usa-quote-button" href={compact ? "/usa-shopping#usa-quote" : "#usa-quote"}>Get my USA shopping quote <span aria-hidden="true">↗</span></Link>
        <p className="usa-small">Item cost, service fee, shipping, and import charges discussed before you confirm.</p>
        <div className="usa-category-tags"><span>👟 Fashion finds</span><span>🎧 Gadgets</span><span>🎁 Gifts & collectibles</span></div>
      </div>
      <div className="usa-route-card" aria-label="USA shopping assistance and delivery to the Philippines">
        <div className="usa-route-heading"><span>THE JOURNEY</span><span className="usa-route-label">USA → PHILIPPINES</span></div>
        <div className="usa-route-stops"><div><span aria-hidden="true">🇺🇸</span><strong>Your US find</strong><small>The item you choose</small></div><div className="usa-route-flight" aria-hidden="true">✈</div><div><span aria-hidden="true">🇵🇭</span><strong>Closer to home</strong><small>Delivery arranged for you</small></div></div>
        <svg className="usa-parcel-art" viewBox="0 0 440 210" aria-hidden="true">
          <ellipse cx="220" cy="180" rx="165" ry="15" fill="#dbe7f2"/>
          <path d="M34 110 Q70 20 160 52 T365 60" fill="none" stroke="#7aadd4" strokeWidth="3" strokeDasharray="7 9"/>
          <circle cx="35" cy="110" r="6" fill="#2454d6"/><circle cx="365" cy="60" r="6" fill="#2454d6"/>
          <path d="M128 84 L219 51 L311 84 L219 119 Z" fill="#f8d77a"/>
          <path d="M128 84 L219 119 L219 181 L128 144 Z" fill="#e6a442"/>
          <path d="M219 119 L311 84 L311 146 L219 181 Z" fill="#f4bf56"/>
          <path d="M168 69 L259 101 L259 141 L240 149 L240 108 L151 77 Z" fill="#fff2c3"/>
          <rect x="151" y="111" width="42" height="23" rx="3" transform="skewY(21) translate(0 -55)" fill="#fff"/>
          <path d="M285 31 l42 6 -21 9 3 17 -9 -15 -22 -1 8 -5 -12 -7 Z" fill="#2454d6"/>
          <circle cx="84" cy="151" r="24" fill="#e0ece1"/><path d="m73 151 8 8 15 -18" fill="none" stroke="#447d2b" strokeWidth="4" strokeLinecap="round"/>
          <path d="m345 129 5 10 11 2 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -2 Z" fill="#f5cc45"/>
        </svg>
        <div className="usa-route-note"><span aria-hidden="true">✦</span><div><strong>Your wishlist starts with a link.</strong><p>Send the exact size, color, or model. We’ll discuss availability and the next steps.</p></div></div>
      </div>
    </div>
  </section>;
}
