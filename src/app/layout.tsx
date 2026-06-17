import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { LuxeProviders } from "@/components/luxe/LuxeProviders";
import { ReportGenerationNavProvider } from "@/components/CreateReportButton";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Valetti — men's personal style atelier",
  description:
    "AI-assisted men's personal styling from Valetti. Carlo Valetti — our lead stylist persona — guides you through a calm, practical plan: hair, colours, tailoring, silhouettes, and a precise shopping list, with the reason behind every call.",
  metadataBase: getSiteUrl(),
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Valetti — men's personal style atelier",
    description:
      "AI-assisted men's personal styling — Carlo Valetti is Valetti's lead stylist persona. Explainable recommendations, photorealistic looks, and a precise shopping plan.",
    type: "website",
    url: "/",
    locale: "en_US",
    siteName: BRAND.name,
    images: [
      {
        url: BRAND.ogImage,
        width: BRAND.ogImageWidth,
        height: BRAND.ogImageHeight,
        alt: "Men's style essentials flat lay — Valetti personal style atelier",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valetti — personal style atelier",
    description:
      "AI-assisted personal styling — Carlo Valetti, Valetti's stylist persona. Find your own style, not the latest trend.",
    images: [BRAND.ogImage],
  },
};

export const viewport: Viewport = {
  themeColor: "#15120d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <LuxeProviders>
          <ReportGenerationNavProvider>{children}</ReportGenerationNavProvider>
        </LuxeProviders>
        <Analytics />
      </body>
    </html>
  );
}
