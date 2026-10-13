// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import test from "node:test";
import {
  compactionDividerRows,
  compactionNoticeMessageIds,
} from "../src/components/assistant-ui/message-derived.ts";

const metadata = (value: Record<string, unknown>) => ({
  custom: { contextTruncation: value },
});

test("explicit failed-fit boundaries draw dividers without legacy or user high-water pollution", () => {
  const messages = [
    { id: "u0", role: "user" },
    {
      id: "a0", role: "assistant",
      metadata: metadata({ dropped_messages: 2, boundary_messages: 5, fits: false }),
    },
    {
      id: "u1", role: "user",
      metadata: metadata({ dropped_messages: 100, boundary_messages: 100, fits: true }),
    },
    {
      id: "a1", role: "assistant",
      metadata: metadata({ dropped_messages: 100, fits: false }),
    },
    { id: "u2", role: "user" },
    {
      id: "a2", role: "assistant",
      metadata: metadata({ dropped_messages: 1, boundary_messages: 6, fits: true }),
    },
  ];
  const rows = compactionDividerRows(messages);
  assert.deepEqual([...rows.keys()], ["u0", "u2"]);
  assert.equal(rows.get("u0"), messages[1].metadata!.custom.contextTruncation);
  assert.equal(rows.size, compactionNoticeMessageIds(messages).size);
});

test("checkpoint dividers survive a lower boundary without lowering the rolling high-water mark", () => {
  const messages = [
    { id: "u0", role: "user" },
    {
      id: "a0", role: "assistant",
      metadata: metadata({ dropped_messages: 8, boundary_messages: 8, fits: true }),
    },
    { id: "u1", role: "user" },
    {
      id: "a1", role: "assistant",
      metadata: metadata({
        dropped_messages: 1, boundary_messages: 2,
        checkpoint_started: true, fits: false,
      }),
    },
    { id: "u2", role: "user" },
    {
      id: "a2", role: "assistant",
      metadata: metadata({ dropped_messages: 4, boundary_messages: 4, fits: true }),
    },
  ];
  const rows = compactionDividerRows(messages);
  assert.deepEqual([...rows.keys()], ["u0", "u1"]);
  assert.equal(rows.get("u1"), messages[3].metadata!.custom.contextTruncation);
  assert.equal(rows.size, compactionNoticeMessageIds(messages).size);
});

test("a streamed array revision refreshes divider metadata and preserves the prior map", () => {
  const firstValue = { dropped_messages: 2, boundary_messages: 2, fits: true };
  const first = [
    { id: "u0", role: "user" },
    { id: "a0", role: "assistant", metadata: metadata(firstValue) },
  ];
  const before = compactionDividerRows(first);
  const nextValue = { dropped_messages: 3, boundary_messages: 3, fits: true };
  const next = [first[0], { ...first[1], metadata: metadata(nextValue) }];
  const after = compactionDividerRows(next);
  assert.notEqual(after, before);
  assert.deepEqual([...after.keys()], ["u0"]);
  assert.equal(after.get("u0"), nextValue);
  assert.equal(before.get("u0"), firstValue);
  assert.equal(compactionDividerRows(first), before);
  assert.equal(compactionDividerRows(next), after);
  assert.equal(after.size, compactionNoticeMessageIds(next).size);
});
