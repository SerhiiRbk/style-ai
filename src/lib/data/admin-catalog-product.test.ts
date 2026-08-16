import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminProduct } from "./admin-catalog-product";

test("parseAdminProduct requires title, category, price, deeplink", () => {
  const miss = parseAdminProduct({ title: "Blazer" });
  assert.equal(miss.ok, false);
  const ok = parseAdminProduct({
    title: "Navy Wool Blazer",
    category: "Outerwear",
    price: 189,
    currency: "EUR",
    deeplink: "https://shop.example/blazer",
    brand: "COS",
    color: "navy",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.product.source, "manual:admin");
  assert.equal(ok.product.category, "Outerwear");
  assert.equal(ok.product.priceEur, 189);
  assert.equal(ok.product.market, "EU");
  assert.equal(ok.product.sourceType, "manual");
});

test("parseAdminProduct converts USD to EUR and rejects bad category/url", () => {
  const usd = parseAdminProduct({
    title: "Loafers",
    category: "Footwear",
    price: 108,
    currency: "USD",
    deeplink: "https://shop.example/loafers",
  });
  assert.equal(usd.ok, true);
  if (usd.ok) assert.equal(usd.product.priceEur, 100);

  assert.equal(
    parseAdminProduct({
      title: "X",
      category: "NotACat",
      price: 10,
      deeplink: "https://shop.example/x",
    }).ok,
    false,
  );
  assert.equal(
    parseAdminProduct({
      title: "X",
      category: "Shirts",
      price: 10,
      deeplink: "not-a-url",
    }).ok,
    false,
  );
});
