import Image from "next/image";
import Link from "next/link";

export default function SiteLogo({ footer = false }) {
  return <Link href="/" className={`logo brand-logo${footer ? " footer-logo" : ""}`} aria-label="PinoyBuyNSell home">
    <Image className="brand-logo-icon" src="/branding/pinoybuynsell-mark.png" alt="" width={44} height={44}
      sizes="44px" quality={85} priority={!footer} />
    <span className="brand-logo-text"><span className="brand-red">Pinoy</span><span className="brand-blue">Buy</span><span className="brand-green">NSell</span></span>
  </Link>;
}
