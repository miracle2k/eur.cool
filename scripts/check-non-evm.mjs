#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/nonEvm.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const module = { exports: {} };
new Function("module", "exports", outputText)(module, module.exports);
const { fetchNonEvmTotalSupply } = module.exports;
const originalFetch = globalThis.fetch;
const envNames = ["SOLANA_RPC_URL", "SOLANA_RPC_URLS", "XRPL_RPC_URL", "XRPL_RPC_URLS"];
const previousEnv = envNames.map((name) => process.env[name]);
for (const name of envNames) delete process.env[name];
const requests = [];
const issuer = "rLPtwF4FZi8bNVmbQ8JgoDUooozhwMNXr3";
const gateway = { account: issuer, status: "success", ledger_index: 108420710, ledger_hash: "A".repeat(64) };
const xrplParams = { chainId: "xrp", address: `VEUR-${issuer}`, symbol: "VEUR" };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });

try {
  process.env.SOLANA_RPC_URLS = "https://dedicated.example/rpc";
  globalThis.fetch = async (endpoint, options) => {
    requests.push(String(endpoint));
    assert.ok(options.signal instanceof AbortSignal);
    if (String(endpoint).includes("dedicated.example")) return response({ error: { message: "Unavailable" } }, 503);
    return response({ result: { value: { amount: "123456789", decimals: 6 } } });
  };
  const solana = await fetchNonEvmTotalSupply({ chainId: "solana", address: "sample", symbol: "EURC" });
  assert.equal(solana.ok, true);
  assert.equal(solana.supply, 123.456789);
  assert.deepEqual(requests, ["https://dedicated.example/rpc", "https://api.mainnet-beta.solana.com"]);

  globalThis.fetch = async () => response({ result: gateway });
  const zero = await fetchNonEvmTotalSupply(xrplParams);
  assert.equal(zero.ok, true);
  assert.equal(zero.supply, 0);

  globalThis.fetch = async () => response({ result: { ...gateway, obligations: {} } });
  assert.equal((await fetchNonEvmTotalSupply(xrplParams)).supply, 0);

  globalThis.fetch = async () => response({ result: { ...gateway, obligations: { "5645555200000000000000000000000000000000": "123.45" } } });
  assert.equal((await fetchNonEvmTotalSupply(xrplParams)).supply, 123.45);

  for (const invalid of [
    { status: "error", error: "actNotFound" },
    {},
    { ...gateway, account: "another-account" },
    { ...gateway, validated: false },
    { ...gateway, ledger_hash: undefined },
    { ...gateway, obligations: null },
    { ...gateway, obligations: { USD: "10" } },
  ]) {
    globalThis.fetch = async () => response({ result: invalid });
    assert.equal((await fetchNonEvmTotalSupply(xrplParams)).ok, false);
  }
  globalThis.fetch = async () => { throw new Error("Request timed out"); };
  assert.equal((await fetchNonEvmTotalSupply(xrplParams)).ok, false);
  assert.equal((await fetchNonEvmTotalSupply({ chainId: "solana", address: "sample", symbol: "EURC" })).ok, false);
  console.log("Non-EVM checks passed: Solana RPC fallback, XRPL zero issuance, and rejected failed or unverified reads.");
} finally {
  globalThis.fetch = originalFetch;
  envNames.forEach((name, index) => {
    if (previousEnv[index] === undefined) delete process.env[name];
    else process.env[name] = previousEnv[index];
  });
}
