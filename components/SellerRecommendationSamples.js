import { sellerRecommendationSamples } from "@/lib/seller-display.mjs";

export default function SellerRecommendationSamples({ sellerId }) {
  const samples = sellerRecommendationSamples(sellerId);
  if (!samples.length) return null;

  return <section className="seller-recommendation-samples" aria-label="Sample seller recommendations">
    <h3>Sample recommendations</h3>
    <p className="muted">Demo content only. These are not customer reviews and do not count toward customer recommendations.</p>
    <div className="seller-recommendation-list">{samples.map(sample => <article className="seller-recommendation" key={sample.id}>
      <div><strong>{sample.author}</strong><span className="seller-recommendation-badge seller-recommendation-sample-badge">Demo recommendation</span></div>
      <p>{sample.body}</p>
    </article>)}</div>
  </section>;
}
