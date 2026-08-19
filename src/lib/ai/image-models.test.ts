import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL_FALLBACKS,
  imageModelChain,
  imageModelUsesChat,
  parseImageModelList,
} from "./image-models";

test("primary stays on the preview checkpoint for identity", () => {
  assert.equal(DEFAULT_IMAGE_MODEL, "google/gemini-3.1-flash-image-preview");
});

test("GA flash is the first fallback, then pro / gpt / kontext", () => {
  assert.deepEqual([...DEFAULT_IMAGE_MODEL_FALLBACKS], [
    "google/gemini-3.1-flash-image",
    "google/gemini-3-pro-image",
    "openai/gpt-image-2",
    "bfl/flux-kontext-max",
  ]);
});

test("gemini image models use the chat/generateText path", () => {
  assert.equal(imageModelUsesChat("google/gemini-3.1-flash-image"), true);
  assert.equal(imageModelUsesChat("google/gemini-3-pro-image"), true);
  assert.equal(imageModelUsesChat("google/gemini-2.5-flash-image"), true);
  assert.equal(imageModelUsesChat("openai/gpt-image-2"), false);
  assert.equal(imageModelUsesChat("bfl/flux-kontext-max"), false);
});

test("parseImageModelList splits a comma list and falls back when empty", () => {
  assert.deepEqual(parseImageModelList(" a ,b, ", ["x"]), ["a", "b"]);
  assert.deepEqual(parseImageModelList("", ["x"]), ["x"]);
  assert.deepEqual(parseImageModelList(undefined, ["x"]), ["x"]);
});

test("imageModelChain puts primary first and drops duplicates", () => {
  assert.deepEqual(
    imageModelChain(DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_MODEL_FALLBACKS),
    [
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image",
      "openai/gpt-image-2",
      "bfl/flux-kontext-max",
    ],
  );
  assert.deepEqual(
    imageModelChain("openai/gpt-image-2", DEFAULT_IMAGE_MODEL_FALLBACKS),
    [
      "openai/gpt-image-2",
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image",
      "bfl/flux-kontext-max",
    ],
  );
});
