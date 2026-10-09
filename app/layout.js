import "./globals.css";
import SupportChat from "@/components/SupportChat";
import AppProvider from "@/components/AppProvider";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2454d6" };

export const metadata = {
  metadataBase: new URL("https://pinoybuynsell.com"),
  manifest: "/manifest.webmanifest",
  applicationName: "PinoyBuyNSell",
  appleWebApp: { capable: true, title: "PinoyBuyNSell", statusBarStyle: "default" },
  title: "PinoyBuyNSell | Buy, Sell & Bid in the Philippines",
  description: "Buy and sell new and pre-owned items, join online auctions, and request USA shopping assistance on PinoyBuyNSell, your Philippine marketplace.",
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
  return (
    <html lang="en">
      <body><AppProvider>{children}<SupportChat /></AppProvider></body>
    </html>
  );
}
