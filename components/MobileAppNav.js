"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileLinkActive } from "@/lib/app-install.mjs";

const links = [
  { href: "/", label: "Home", path: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9" },
  { href: "/search", label: "Browse", path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  { href: "/sell", label: "Sell", path: "M12 5v14M5 12h14" },
  { href: "/auctions", label: "Auctions", path: "m8 3 8 8M5 6l8 8M5 6l3-3M13 14l3-3M10 11l-7 7M13 20h8" },
  { href: "/account", label: "Account", path: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2" },
];

export default function MobileAppNav({ online = true, isAdmin = false }) {
  const pathname = usePathname() || "/";
  return <nav className="mobile-app-nav" aria-label="Mobile navigation">
    {links.map(link => <Link key={link.href} href={link.href} prefetch={false}
      onClick={event => { if (!online && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); window.location.assign(link.href); } }}
      aria-current={mobileLinkActive(pathname, link.href) ? "page" : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={link.path} /></svg>
      <span>{link.href === "/sell" && !isAdmin ? "Sell soon" : link.label}</span>
    </Link>)}
  </nav>;
}
