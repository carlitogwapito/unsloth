// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import test from "node:test";
import { isAudioSttEngine } from "../src/features/audio/stt-artifacts.ts";

test("the STT engine guard accepts the four supported names", () => {
  const values = ["transformers", "gguf", "mtmd", "audiocpp"];
  for (const value of values) assert.equal(isAudioSttEngine(value), true);
  console.log(`supported_names=${values.length}`);
});

test("the STT engine guard rejects malformed names and non-string primitives", () => {
  const values: unknown[] = [
    undefined, null, false, true, 0, 1, NaN, Infinity, 1n, Symbol("gguf"),
    "", "GGUF", "Gguf", "TRANSFORMERS", " gguf", "gguf ", "mtmd\n",
    "audiocpp\t", "cpu", "cuda", "mlx", "other",
  ];
  assert.equal(values.length, 22);
  for (const value of values) assert.equal(isAudioSttEngine(value), false);
  console.log(`rejected_primitives=${values.length}`);
});

test("the STT engine guard does not coerce objects into an engine name", () => {
  let conversions = 0;
  const conversion = () => {
    conversions += 1;
    throw new Error("unexpected engine-name coercion");
  };
  const values: unknown[] = [
    new String("gguf"), ["gguf"], new Set(["gguf"]), { engine: "gguf" },
    Object.create(null),
    {
      [Symbol.toPrimitive]: conversion,
      toString: conversion,
      valueOf: conversion,
    },
  ];
  for (const value of values) assert.equal(isAudioSttEngine(value), false);
  assert.equal(conversions, 0);
  console.log(`rejected_objects=${values.length}; conversions=${conversions}`);
});
