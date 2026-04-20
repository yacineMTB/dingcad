import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import ConnectionBanner from "@/components/ConnectionBanner";

export const metadata: Metadata = {
  title: {
    default: "Helscoop — Suunnittele remonttisi 3D:ssä",
    template: "%s | Helscoop",
  },
  description:
    "Suunnittele talosi remontti 3D-mallinnuksella. Näe muutokset reaaliajassa, saa automaattinen materiaaliluettelo ja hinnat K-Raudasta. Ilmainen työkalu suomalaisille kodinrakentajille.",
  keywords: [
    "remontti",
    "talosuunnittelu",
    "3D",
    "materiaalilista",
    "K-Rauta",
    "rakentaminen",
    "kodinparannus",
    "talonrakennus",
    "remonttilaskuri",
  ],
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://helscoop.fi"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Helscoop — Suunnittele remonttisi 3D:ssä",
    description:
      "3D-mallinna talosi, suunnittele remontti ja saa materiaalihinnat reaaliajassa. Ilmainen työkalu suomalaisille kodinrakentajille.",
    type: "website",
    locale: "fi_FI",
    siteName: "Helscoop",
    url: "https://helscoop.fi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Helscoop — Suunnittele remonttisi 3D:ssä",
    description:
      "3D-mallinna talosi, suunnittele remontti ja saa materiaalihinnat reaaliajassa.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Helscoop",
  description:
    "Suunnittele talosi remontti 3D-mallinnuksella. Näe muutokset reaaliajassa, saa automaattinen materiaaliluettelo ja hinnat K-Raudasta.",
  url: "https://helscoop.fi",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  inLanguage: "fi",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fi" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("helscoop-theme");var d=t==="light"?"light":t==="auto"?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":"dark";document.documentElement.setAttribute("data-theme",d);document.documentElement.style.background=d==="light"?"#fafafa":"#09090b"}catch(e){}})()`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem("helscoop_locale")||"fi";document.documentElement.lang=l}catch(e){}})()`
          }}
        />
        {/* Plausible Analytics — privacy-first, no cookies, GDPR-compliant */}
        <script
          defer
          data-domain="helscoop.fi"
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className="grain">
        <ThemeProvider>
          <LocaleProvider>
            <ToastProvider>
              <ConnectionBanner />
              {children}
            </ToastProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
