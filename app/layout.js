import "./globals.css";
import SupportChat from "@/components/SupportChat";

export const metadata = {
  title: "PinoyBuyNSell | Buy • Sell • Connect",
  description: "A modern Philippine marketplace for buying and selling new and pre-owned items.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}<SupportChat /></body>
    </html>
  );
}
