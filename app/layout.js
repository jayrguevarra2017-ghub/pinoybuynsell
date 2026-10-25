import "./globals.css";
import SupportChat from "@/components/SupportChat";
import AppProvider from "@/components/AppProvider";
import { homeSEO } from "@/lib/seo.mjs";
import MetaPixelProvider from "@/components/MetaPixelProvider";
import { metaPixelConfiguration } from "@/lib/meta-pixel-config.mjs";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2454d6" };

export const metadata = {
  metadataBase: new URL("https://pinoybuynsell.com"),
  manifest: "/manifest.webmanifest",
  applicationName: "PinoyBuyNSell",
  facebook: { appId: "2368945230513347" },
  appleWebApp: { capable: true, title: "PinoyBuyNSell", statusBarStyle: "default" },
  title: homeSEO.title,
  description: homeSEO.description,
  icons: {
    icon: [{ url: "/branding/pinoybuynsell-mark.png", type: "image/png" }],
    apple: "/branding/pinoybuynsell-app-icon.png",
  },
  openGraph: {
    title: "PinoyBuyNSell | Buy • Sell • Connect",
    description: "Your Philippine online marketplace. Buy, sell, and connect.",
    url: "https://pinoybuynsell.com",
    siteName: "PinoyBuyNSell",
    type: "website",
    locale: "en_PH",
    images: [{ url: "/branding/pinoybuynsell-facebook-profile.png", alt: "PinoyBuyNSell marketplace logo" }],
  },
};

export default function RootLayout({ children }) {
  const pixel = metaPixelConfiguration(process.env);
  return (
    <html lang="en">
      <body><AppProvider><MetaPixelProvider {...pixel}>{children}<SupportChat /></MetaPixelProvider></AppProvider></body>
    </html>
  );
}
