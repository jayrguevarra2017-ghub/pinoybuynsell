import "./globals.css";
import SupportChat from "@/components/SupportChat";
import VisitorCounter from "@/components/VisitorCounter";

export const metadata = {
  metadataBase: new URL("https://pinoybuynsell.com"),
  title: "PinoyBuyNSell | Buy • Sell • Connect",
  description: "A modern Philippine marketplace for buying and selling new and pre-owned items.",
  icons: {
    icon: [{ url: "/branding/pinoybuynsell-mark.png", type: "image/png" }],
    apple: "/branding/pinoybuynsell-facebook-profile.png",
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
      <body>{children}<VisitorCounter /><SupportChat /></body>
    </html>
  );
}
