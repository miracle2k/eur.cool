#!/usr/bin/env node

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.STRICT_CHECK_PORT ?? 4310);
const snapshotUrl = `http://127.0.0.1:${port}/api/stablecoins`;
const refreshUrl = `http://127.0.0.1:${port}/api/stablecoins/refresh`;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function refreshAndReadSnapshot() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const refreshRes = await fetch(refreshUrl, { method: "POST", cache: "no-store" });
      if (!refreshRes.ok) {
        throw new Error(`refresh HTTP ${refreshRes.status}`);
      }

      const res = await fetch(snapshotUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`snapshot HTTP ${res.status}`);
      }

      return await res.json();
    } catch {
      await delay(1000);
    }
  }

  throw new Error(`Timed out waiting for refresh/snapshot at ${refreshUrl}`);
}

async function main() {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});

  try {
    const snapshot = await refreshAndReadSnapshot();

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
