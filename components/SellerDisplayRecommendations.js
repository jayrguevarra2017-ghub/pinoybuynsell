import { sellerDisplayRecommendations } from "@/lib/seller-display.mjs";

export default function SellerDisplayRecommendations({ sellerId, embedded = false }) {
  const recommendations = sellerDisplayRecommendations(sellerId);
  if (!recommendations.length) return null;

  return <section className={embedded ? undefined : "seller-display-recommendations"} aria-label="Seller recommendations">
    {!embedded && <h3>Seller recommendations</h3>}
    <div className="seller-recommendation-list">{recommendations.map(recommendation => <article className="seller-recommendation" key={recommendation.id}>
      <div><strong>{recommendation.author}</strong><span className="seller-recommendation-badge">Recommends this seller</span></div>
      <p>{recommendation.body}</p>
    </article>)}</div>
  </section>;
}
