import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";

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
  title: "Valetti — personal style atelier with Carlo Valetti",
  description:
    "Valetti is a personal style atelier led by stylist Carlo Valetti. Share a few photos, answer honest questions, and receive a calm, practical plan — hair, colours, clothing, silhouettes, and a precise shopping list. AI-assisted personal styling.",
  metadataBase: getSiteUrl(),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Valetti — personal style atelier",
    description:
      "AI-assisted personal styling with Carlo Valetti — explainable recommendations, photorealistic looks, and a precise shopping plan.",
    type: "website",
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
      "AI-assisted personal styling with Carlo Valetti — find your own style, not the latest trend.",
    images: [BRAND.ogImage],
  },
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
        {children}
      </body>
    </html>
  );
}
