import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans, Fraunces } from "next/font/google";
import "@/components/arc/foundation.css";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-fraunces", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-barlow", display: "swap" });

export const metadata: Metadata = {
  title: "Liste de Noël",
  description: "Crée ta liste de Noël en collant des liens : photo, prix et boutique se remplissent tout seuls. Tes proches réservent sans se marcher dessus.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#123f30",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Une seule ambiance, celle d'une planche de timbres : vert sapin et papier crème, de jour comme de nuit.
    <html lang="fr" data-theme="light" className={`${fraunces.variable} ${dmSans.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
