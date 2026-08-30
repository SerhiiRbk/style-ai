import assert from "node:assert/strict";
import test from "node:test";
import { buildNotFoundMarkdown } from "./agent-404";

test("404 markdown points agents at home, sitemap, and llms.txt", () => {
  const md = buildNotFoundMarkdown("https://www.valetti.fit");
  assert.match(md, /^# Not found/m);
  assert.match(md, /\[Home\]\(https:\/\/www\.valetti\.fit\/\)/);
  assert.match(md, /\[Agent map \(llms\.txt\)\]\(https:\/\/www\.valetti\.fit\/llms\.txt\)/);
  assert.match(md, /\[Sitemap\]\(https:\/\/www\.valetti\.fit\/sitemap\)/);
  assert.match(md, /\[Machine-readable sitemap\]\(https:\/\/www\.valetti\.fit\/sitemaps\/pages\.xml\)/);
});
