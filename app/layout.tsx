import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import "@/components/arc/foundation.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Liste de Noël",
  description: "Crée ta liste de Noël en collant des liens : photo, prix et boutique se remplissent tout seuls. Tes proches réservent sans se marcher dessus.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" },
  ],
};

// Arc lit le thème sur data-theme : on suit celui de l'appareil, avant le premier rendu.
const themeScript = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){document.documentElement.dataset.theme=m.matches?'dark':'light'};a();m.addEventListener('change',a)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-accent="coral" suppressHydrationWarning className={`${geist.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
