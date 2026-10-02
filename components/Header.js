import Link from "next/link";

export default function Header() {
  return (
    <header className="topbar">
      <div className="container nav">
        <Link className="logo" href="/">Pinoy<span>BuyNSell</span></Link>
        <nav className="mainnav">
          <Link href="/">Home</Link><Link href="/#browse">Browse</Link><Link href="/auctions">Auctions</Link><Link href="/#categories">Categories</Link>
        </nav>
        <div className="actions"><Link className="login" href="/login">Log in</Link><Link className="sell" href="/sell">+ Sell an Item</Link></div>
      </div>
    </header>
  );
}
