// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import test from "node:test";

import { hfModelFitsDevice } from "../src/features/model-picker/components/model-selector/recommended-fit.ts";
import { checkVramFit, estimateLoadingVram } from "../src/lib/vram.ts";

test("discrete safetensors filtering agrees with the badge regardless of spare RAM", () => {
  for (const memoryTotalGb of [8, 24, 72]) {
    for (const totalParams of [1e9, 14e9, 24e9, 32e9, 70e9, 100e9]) {
      const expected =
        checkVramFit(estimateLoadingVram(totalParams, "qlora"), memoryTotalGb) !==
        "exceeds";
      for (const systemRamAvailableGb of [0, 128]) {
        assert.equal(
          hfModelFitsDevice(
            { id: "org/checkpoint", totalParams, isGguf: false },
            { memoryTotalGb, systemRamAvailableGb, budgetKnown: true },
          ),
          expected,
          JSON.stringify({ memoryTotalGb, totalParams, systemRamAvailableGb }),
        );
      }
    }
  }
});

test("inferred safetensors parameter counts use the badge rule too", () => {
  const gpu = { memoryTotalGb: 24, systemRamAvailableGb: 128, budgetKnown: true };
  assert.equal(hfModelFitsDevice({ id: "org/checkpoint-14B" }, gpu), true);
  assert.equal(hfModelFitsDevice({ id: "org/checkpoint-32B" }, gpu), false);
});

test("curated artifact sizes and media loads keep their explicit fit paths", () => {
  const gpu = { memoryTotalGb: 24, systemRamAvailableGb: 64, budgetKnown: true };
  const row = { id: "org/checkpoint-70B", totalParams: 70e9, isGguf: false };
  assert.equal(hfModelFitsDevice(row, gpu), false);
  assert.equal(
    hfModelFitsDevice({ ...row, curatedSizeBytes: 1024 ** 3 }, gpu),
    true,
  );
  assert.equal(hfModelFitsDevice(row, gpu, { mediaLoad: true }), true);
});
