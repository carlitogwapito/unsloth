// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import test from "node:test";

import { toApiProvider } from "../src/features/recipe-studio/dialogs/tool-profile/helpers.ts";
import { buildLlmMcpProvider } from "../src/features/recipe-studio/utils/payload/builders-llm.ts";

type Provider = Parameters<typeof toApiProvider>[0];

function fixture(
  transport: Provider["provider_type"],
  apiKey = " fixture-value ",
  apiKeyEnv = " FIXTURE_KEY_NAME ",
): Provider {
  const provider: Provider = {
    id: "fixture-provider",
    name: " docs ",
    provider_type: transport,
    endpoint: " https://fixture.invalid/mcp ",
    command: " fixture-command ",
    args: [" alpha ", "", "\t", " beta "],
    env: [
      { key: " KEEP ", value: " first " },
      { key: " BLANK ", value: " " },
      { key: "", value: "drop" },
      { key: "KEEP", value: " last " },
    ],
    api_key: apiKey,
    api_key_env: apiKeyEnv,
  };
  for (const entry of provider.env ?? []) Object.freeze(entry);
  Object.freeze(provider.env);
  Object.freeze(provider.args);
  return Object.freeze(provider);
}

function verifyParity(provider: Provider, expected: Record<string, unknown>) {
  const before = JSON.stringify(provider);
  const errors: string[] = [];
  const dialog = toApiProvider(provider);
  const run = buildLlmMcpProvider(provider, errors);
  assert.deepEqual(errors, []);
  assert.deepEqual(dialog, expected);
  assert.deepEqual(run, expected);
  assert.equal(JSON.stringify(provider), before);
  return dialog;
}

test("dialog and run serializers preserve both remote transports without mutation", () => {
  for (const transport of ["sse", "streamable_http"] as const) {
    verifyParity(fixture(transport), {
      provider_type: transport,
      name: "docs",
      endpoint: "https://fixture.invalid/mcp",
      api_key: "fixture-value",
      api_key_env: "FIXTURE_KEY_NAME",
    });
  }
  console.log("remote_provider_cases=2; input_mutations=0");
});

test("empty remote auth is omitted from serialized JSON on both transports", () => {
  for (const transport of ["sse", "streamable_http"] as const) {
    const dialog = verifyParity(fixture(transport, " \t ", " \n "), {
      provider_type: transport,
      name: "docs",
      endpoint: "https://fixture.invalid/mcp",
      api_key: undefined,
      api_key_env: undefined,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(dialog)), {
      provider_type: transport,
      name: "docs",
      endpoint: "https://fixture.invalid/mcp",
    });
  }
  console.log("empty_auth_cases=2; input_mutations=0");
});

test("stdio remains a command payload with matching argument and environment normalization", () => {
  verifyParity(fixture("stdio"), {
    provider_type: "stdio",
    name: "docs",
    command: "fixture-command",
    args: ["alpha", "beta"],
    env: { KEEP: "last" },
  });
  console.log("stdio_cases=1; input_mutations=0");
});
