#!/usr/bin/env node

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.STRICT_CHECK_PORT ?? 4310);
const url = `http://127.0.0.1:${port}/api/stablecoins?force=1`;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function waitForSnapshot() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch {
      await delay(1000);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    const snapshot = await waitForSnapshot();

    const contracts = snapshot.stablecoins.flatMap((token) => token.contracts);
    const fallbackRows = contracts.filter((contract) => contract.chainId === "other");

    if (fallbackRows.length > 0) {
      const preview = fallbackRows
        .slice(0, 5)
        .map((row) => `${row.chainId}:${row.address}`)
        .join(", ");
      throw new Error(`Found ${fallbackRows.length} fallback rows (${preview})`);
    }

    console.log(
      `✅ strict on-chain check passed: ${snapshot.sourceStats.trackedContracts} contracts, ${snapshot.sourceStats.rpcSuccessContracts} resolved on-chain, fallback rows=0`,
    );
  } finally {
    child.kill("SIGTERM");
    await delay(800);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
