import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

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
  title: "StyleAI Consultant — your personal AI image consultant",
  description:
    "Upload your photos, answer a few questions, and receive a clear, visual, and practical plan to elevate your look — hair, colors, clothing, silhouettes, and a precise shopping list.",
  metadataBase: new URL("https://styleai.example"),
  openGraph: {
    title: "StyleAI Consultant",
    description:
      "A personal AI image consultant — explainable recommendations, photorealistic looks, and a precise shopping plan.",
    type: "website",
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
