import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicHttpUrl,
  parsePageOgMeta,
  parseProductPageMeta,
  resolveHttpUrl,
} from "./og-page-meta";

test("isPublicHttpUrl rejects private and non-http targets", () => {
  assert.equal(isPublicHttpUrl("https://www.zara.com/item"), true);
  assert.equal(isPublicHttpUrl("http://shop.example/p"), true);
  assert.equal(isPublicHttpUrl("ftp://shop.example/p"), false);
  assert.equal(isPublicHttpUrl("https://localhost/p"), false);
  assert.equal(isPublicHttpUrl("https://127.0.0.1/p"), false);
  assert.equal(isPublicHttpUrl("https://192.168.1.4/p"), false);
  assert.equal(isPublicHttpUrl("https://user:pass@shop.example/p"), false);
});

test("parsePageOgMeta reads og title, description and image", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Linen Camp-Collar Shirt" />
      <meta property="og:description" content="Dusty rose linen shirt." />
      <meta property="og:image" content="/images/shirt.jpg" />
      <title>Ignored</title>
    </head></html>
  `;
  const meta = parsePageOgMeta(html, "https://shop.example/shirt");
  assert.equal(meta.title, "Linen Camp-Collar Shirt");
  assert.equal(meta.description, "Dusty rose linen shirt.");
  assert.equal(meta.imageUrl, "https://shop.example/images/shirt.jpg");
});

test("parsePageOgMeta falls back to twitter tags and HTML title", () => {
  const html = `
    <html><head>
      <title>Reserved &amp; Co Loafers</title>
      <meta name="twitter:description" content="Greige suede loafers" />
      <meta name="twitter:image" content="https://cdn.example/loafers.jpg" />
    </head></html>
  `;
  const meta = parsePageOgMeta(html, "https://shop.example/loafers");
  assert.equal(meta.title, "Reserved & Co Loafers");
  assert.equal(meta.description, "Greige suede loafers");
  assert.equal(meta.imageUrl, "https://cdn.example/loafers.jpg");
});

test("parsePageOgMeta handles reversed meta attribute order", () => {
  const html = `<meta content="Navy blazer" property="og:title">`;
  const meta = parsePageOgMeta(html, "https://shop.example/blazer");
  assert.equal(meta.title, "Navy blazer");
});

test("parseProductPageMeta prefers JSON-LD Product over OG", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="OG noisy title for Sale" />
      <meta property="og:description" content="Free shipping promo" />
      <meta property="og:image" content="https://cdn.example/og.jpg" />
      <meta property="og:price:amount" content="731,00" />
      <meta property="og:price:currency" content="CZK" />
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Full-Wall UFO Mural Shirt",
          "description": "Cotton camp-collar shirt.",
          "image": "https://cdn.example/ld.jpg",
          "brand": { "@type": "Brand", "name": "Geeksoutfit" },
          "offers": [
            {
              "@type": "Offer",
              "price": "877",
              "priceCurrency": "CZK",
              "url": "https://shop.example/shirt?sku=abc"
            }
          ]
        }
      </script>
    </head></html>
  `;
  const meta = parseProductPageMeta(html, "https://shop.example/shirt?sku=abc");
  assert.equal(meta.title, "Full-Wall UFO Mural Shirt");
  assert.equal(meta.description, "Cotton camp-collar shirt.");
  assert.equal(meta.imageUrl, "https://cdn.example/ld.jpg");
  assert.equal(meta.brand, "Geeksoutfit");
  assert.equal(meta.price, "877");
  assert.equal(meta.currency, "CZK");
});

test("parseProductPageMeta falls back to OG when JSON-LD is missing", () => {
  const html = `
    <meta property="og:title" content="Linen Shirt" />
    <meta property="og:description" content="Dusty rose" />
    <meta property="og:image" content="https://cdn.example/og.jpg" />
    <meta property="og:site_name" content="Reserved" />
  `;
  const meta = parseProductPageMeta(html, "https://shop.example/shirt");
  assert.equal(meta.title, "Linen Shirt");
  assert.equal(meta.description, "Dusty rose");
  assert.equal(meta.imageUrl, "https://cdn.example/og.jpg");
  assert.equal(meta.brand, "Reserved");
});

test("resolveHttpUrl keeps absolute https images", () => {
  assert.equal(
    resolveHttpUrl("https://shop.example/p", "https://cdn.example/a.jpg"),
    "https://cdn.example/a.jpg",
  );
  assert.equal(resolveHttpUrl("https://shop.example/p", "javascript:alert(1)"), null);
});
