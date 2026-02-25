#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const fixturesPath = path.join(process.cwd(), "data", "solana-mint-fixtures.json");
const defaultRpc = "https://solana-rpc.publicnode.com";
const rpcUrl = process.env.SOLANA_RPC_URL || defaultRpc;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function main() {
  const fixtures = JSON.parse(await readFile(fixturesPath, "utf8"));

  for (const fixture of fixtures) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [fixture.mint],
      }),
    });

    if (!res.ok) {
      fail(`${fixture.symbol} (${fixture.mint}) returned HTTP ${res.status} from ${rpcUrl}`);
    }

    const payload = await res.json();
    if (payload.error) {
      fail(`${fixture.symbol} (${fixture.mint}) returned RPC error: ${payload.error.message ?? JSON.stringify(payload.error)}`);
    }

    const value = payload?.result?.value;
    const decimals = Number(value?.decimals);
    const uiAmount = Number(value?.uiAmount);

    if (decimals !== fixture.expectedDecimals) {
      fail(
        `${fixture.symbol} (${fixture.mint}) decimals mismatch. expected=${fixture.expectedDecimals} got=${String(value?.decimals)}`,
      );
    }

    if (!Number.isFinite(uiAmount)) {
      fail(`${fixture.symbol} (${fixture.mint}) missing numeric uiAmount`);
    }

    console.log(`✅ ${fixture.symbol}: decimals=${decimals}, supply=${uiAmount.toLocaleString("en-US")}`);
  }

  console.log(`\nAll Solana mint fixtures validated via ${rpcUrl}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
