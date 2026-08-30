import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { LuxeProviders } from "@/components/luxe/LuxeProviders";
import { ReportGenerationNavProvider } from "@/components/CreateReportButton";
import { NavSessionProvider } from "@/components/NavSession";
import { ReportReadyNotifier } from "@/components/ReportReadyNotifier";

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
  title: BRAND.seoTitle,
  description:
    "Valetti is an AI-assisted men's personal styling atelier. Colour analysis, photorealistic looks, and a precise shopping plan — with the reason behind every call.",
  metadataBase: getSiteUrl(),
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: BRAND.seoTitle,
    description:
      "AI-assisted men's personal styling from Valetti — colour analysis, photorealistic looks, and a precise shopping plan.",
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
    title: BRAND.seoTitle,
    description:
      "AI-assisted men's personal styling from Valetti. Colour analysis, photorealistic looks, and a shopping plan.",
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
          <ReportGenerationNavProvider>
            <NavSessionProvider>
              {children}
              <ReportReadyNotifier />
            </NavSessionProvider>
          </ReportGenerationNavProvider>
        </LuxeProviders>
        <Analytics />
      </body>
    </html>
  );
}
