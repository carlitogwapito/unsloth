// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import test from "node:test";

import { resolveAddress, type SearchEngineId } from "../src/features/browser/address.ts";

const engines: [SearchEngineId, string][] = [
  ["duckduckgo", "https://html.duckduckgo.com/html/?q="],
  ["google", "https://www.google.com/search?q="],
  ["bing", "https://www.bing.com/search?q="],
  ["brave", "https://search.brave.com/search?q="],
];

test("bare filenames use each chosen engine after trimming, regardless of case", () => {
  const inputs = [
    "  llama.cpp  ",
    "NODE.JS",
    "index.TSX",
    "model.safetensors",
    "Qwen3-8B.Q4_K_M.gguf",
  ];
  let checks = 0;
  for (const [engine, prefix] of engines) {
    for (const input of inputs) {
      assert.equal(resolveAddress(input, engine), prefix + encodeURIComponent(input.trim()));
      checks += 1;
    }
  }
  assert.equal(checks, 20);
  console.log(`filename_checks=${checks}`);
});

test("URL suffixes bypass the filename exception, while bare host controls still navigate", () => {
  const inputs = ["guide.py", "notes.md", "docs.rs"];
  for (const host of ["build.ts", "data.json"]) {
    for (const suffix of [":8443", "/admin", "?view=1&mode=2", "#section"]) {
      inputs.push(host + suffix);
    }
  }
  let checks = 0;
  for (const [engine] of engines) {
    for (const input of inputs) {
      assert.equal(resolveAddress(input, engine), `https://${input}`);
      checks += 1;
    }
  }
  assert.equal(checks, 44);
  console.log(`host_checks=${checks}`);
});

test("explicit URLs keep their scheme, case and suffixes on every engine", () => {
  const inputs = [
    "http://node.js:8080/admin?q=1#part",
    "https://model.gguf/download",
    "https://BUILD.TS",
  ];
  let checks = 0;
  for (const [engine] of engines) {
    for (const input of inputs) {
      assert.equal(resolveAddress(`  ${input}  `, engine), input);
      checks += 1;
    }
  }
  assert.equal(checks, 12);
  console.log(`explicit_url_checks=${checks}`);
});
