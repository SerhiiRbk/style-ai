import assert from "node:assert/strict";
import test from "node:test";
import { BRAND } from "./brand";
import {
  organizationJsonLd,
  organizationPostalAddress,
  serviceJsonLd,
  websiteJsonLd,
} from "./site-json-ld";

test("organization JSON-LD includes a contactPoint email", () => {
  const org = organizationJsonLd("https://www.valetti.fit/");
  const contact = org.contactPoint as { email?: string; contactType?: string };
  assert.equal(contact.email, BRAND.contactEmail);
  assert.equal(contact.contactType, "customer support");
  assert.deepEqual(org.alternateName, [
    "Valetti AI men's stylist",
    "Valetti AI style atelier",
  ]);
  assert.match(String(org.description), /AI-assisted men's personal styling/);
});

test("website and service JSON-LD name the AI men's styling niche", () => {
  const site = "https://www.valetti.fit/";
  const website = websiteJsonLd(site);
  const service = serviceJsonLd(site);
  assert.equal(website.name, BRAND.seoTitle);
  assert.equal(website.alternateName, BRAND.name);
  assert.equal(service.name, "AI-assisted personal styling");
  assert.equal(service.alternateName, "AI men's stylist");
  assert.equal(service.serviceType, "AI men's personal styling");
});

test("organization JSON-LD omits address when LEGAL_* env is unset", () => {
  const prev = {
    line1: process.env.LEGAL_ADDRESS_LINE1,
    city: process.env.LEGAL_CITY,
    country: process.env.LEGAL_COUNTRY,
  };
  delete process.env.LEGAL_ADDRESS_LINE1;
  delete process.env.LEGAL_CITY;
  delete process.env.LEGAL_COUNTRY;
  try {
    assert.equal(organizationPostalAddress(), null);
    assert.equal("address" in organizationJsonLd("https://www.valetti.fit/"), false);
  } finally {
    if (prev.line1) process.env.LEGAL_ADDRESS_LINE1 = prev.line1;
    if (prev.city) process.env.LEGAL_CITY = prev.city;
    if (prev.country) process.env.LEGAL_COUNTRY = prev.country;
  }
});

test("organization JSON-LD adds PostalAddress when LEGAL_* env is set", () => {
  const prev = {
    line1: process.env.LEGAL_ADDRESS_LINE1,
    city: process.env.LEGAL_CITY,
    country: process.env.LEGAL_COUNTRY,
  };
  process.env.LEGAL_ADDRESS_LINE1 = "1 Atelier Lane";
  process.env.LEGAL_CITY = "Lisbon";
  process.env.LEGAL_COUNTRY = "PT";
  try {
    const address = organizationPostalAddress();
    assert.equal(address?.["@type"], "PostalAddress");
    assert.equal(address?.streetAddress, "1 Atelier Lane");
    assert.equal(address?.addressLocality, "Lisbon");
    assert.equal(address?.addressCountry, "PT");
  } finally {
    if (prev.line1) process.env.LEGAL_ADDRESS_LINE1 = prev.line1;
    else delete process.env.LEGAL_ADDRESS_LINE1;
    if (prev.city) process.env.LEGAL_CITY = prev.city;
    else delete process.env.LEGAL_CITY;
    if (prev.country) process.env.LEGAL_COUNTRY = prev.country;
    else delete process.env.LEGAL_COUNTRY;
  }
});
