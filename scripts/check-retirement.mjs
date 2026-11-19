#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
const mocks = new Map();
function load(file) {
  if (mocks.has(file)) return mocks.get(file);
  if (modules.has(file)) return modules.get(file);
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((id) => id.startsWith("@/")
    ? load(`${id.slice(2)}.ts`) : require(id), module, module.exports);
  modules.set(file, module.exports);
  return module.exports;
}

const { EUR_STABLECOIN_REGISTRY: registry } = load("data/eurStablecoinRegistry.ts");
const { retirementFor, retiredContractKeys, applyRetirementPolicy } = load("lib/retirement.ts");
const { computeIntervalChanges } = load("lib/history.ts");
const eeur = registry.find((token) => token.id === "e-money-eur");
const key = (contract) => `${eeur.id}::${contract.chainId}::${contract.address.toLowerCase()}`;
const osmosisKey = key(eeur.contracts[0]);
const evmosKey = key(eeur.contracts[1]);
const retiredAt = "2024-04-09T00:00:00.000Z";

assert.equal(retirementFor(eeur.id, "2024-04-08T23:59:59.999Z"), undefined);
assert.equal(retirementFor(eeur.id, retiredAt).effectiveDate, "2024-04-09");
assert.equal(retirementFor("aryze-eeur", retiredAt), undefined); // same ticker, different issuer

function sampleToken(id, supplies) {
  const token = registry.find((entry) => entry.id === id);
  const contracts = token.contracts.slice(0, supplies.length).map((contract, index) => ({
    ...contract, chainName: contract.chainId, supply: supplies[index], decimals: 6,
    source: supplies[index] === null ? "unavailable" : "rpc",
    status: supplies[index] === null ? "error" : "ok", method: "sample:on-chain",
  }));
  const sum = (kind) => contracts.filter((contract) => contract.kind === kind).reduce((n, contract) => n + (contract.supply ?? 0), 0);
  return { id, symbol: token.symbol, name: token.name, contracts,
    nativeSupply: sum("native"), bridgedSupply: sum("bridged"), totalSupply: sum("native") + sum("bridged") };
}

const legacy = {
  generatedAt: retiredAt, totals: { native: 10, withBridged: 469896.598006 }, chains: [],
  stablecoins: [sampleToken("aryze-eeur", [10]), sampleToken(eeur.id, [469886.598006, null])],
  changes: [{ interval: "day", absChange: -500000, pctChange: -99 }],
  sourceStats: { trackedTokens: 2, trackedContracts: 3, rpcSuccessContracts: 2, failedContracts: 1, unsupportedContracts: 0 },
};
const before = JSON.stringify(legacy);
const projected = applyRetirementPolicy(legacy);
assert.equal(JSON.stringify(legacy), before);
assert.equal(projected.totals.withBridged, 10);
assert.equal(projected.stablecoins[0].id, "aryze-eeur");
assert.equal(projected.retiredStablecoins[0].contracts[0].supply, 469886.598006);
assert.equal(projected.retiredStablecoins[0].contracts[1].supply, null);
assert.equal(projected.retiredStablecoins[0].contracts[0].observedAt, retiredAt);
assert.equal(projected.sourceStats.failedContracts, 0);
assert.equal(projected.sourceStats.trackedContracts, 1);
assert.equal(projected.sourceStats.retiredContracts, 2);
assert.equal(projected.changes[0].absChange, null);
assert.equal(applyRetirementPolicy(projected), projected);
const carriedLegacy = structuredClone(legacy);
carriedLegacy.stablecoins[1].contracts[0].source = "carried";
assert.equal(applyRetirementPolicy(carriedLegacy).retiredStablecoins[0].contracts[0].observedAt, null);
const preRetirement = { ...legacy, generatedAt: "2024-04-08T23:59:59.999Z" };
assert.equal(applyRetirementPolicy(preRetirement), preRetirement);

// Exclusion changes membership, without fabricating a redemption in the series.
const history = [
  { timestamp: "2024-04-08T00:00:00Z", native: 500100, withBridged: 500100, contractSupplies: { active: 100, [osmosisKey]: 500000 } },
  { timestamp: retiredAt, native: 100, withBridged: 100, contractSupplies: { active: 100, [osmosisKey]: 469886.598006 } },
];
assert.equal(computeIntervalChanges(history, retiredContractKeys(retiredAt)).find((change) => change.interval === "day").absChange, 0);
assert.equal(history[0].contractSupplies[osmosisKey], 500000);

let useTurso = true;
let optionalReadFails = false;
const calls = [];
const persisted = [];
const observations = [];
let latestValues = new Map([
  [osmosisKey, { supply: 450000, decimals: 6, method: "cosmos:bank-supply-by-denom", valueObservedAt: "2023-01-01T00:00:00Z" }],
  [evmosKey, { supply: 123, decimals: 6, method: "evm:erc20-totalSupply", valueObservedAt: "2023-01-01T00:00:00Z" }],
]);
mocks.set("lib/turso-store.ts", {
  isTursoEnabled: () => useTurso,
  createRefreshRun: async () => 1,
  failRefreshRun: async () => {},
  finalizeRefreshRun: async () => {},
  readLatestSnapshotContractValues: async () => latestValues,
  readIntervalBaselinesFromTurso: async () => [],
  insertContractObservations: async (_id, rows) => observations.push(...rows),
  appendSnapshotToTurso: async (snapshot) => {
    persisted.push(snapshot);
    latestValues = new Map(snapshot.contracts.filter((contract) => contract.supply !== null).map((contract) => [contract.contractKey, {
      supply: contract.supply, decimals: contract.decimals, method: contract.method, valueObservedAt: contract.valueObservedAt,
    }]));
  },
});
mocks.set("lib/rpc.ts", { fetchEvmTotalSupply: async (chain, address) => {
  calls.push({ chain, address });
  return { ok: true, supply: 100, decimals: 6, rpcUrl: "https://rpc.example" };
} });
mocks.set("lib/nonEvm.ts", { fetchNonEvmTotalSupply: async ({ chainId, address }) => {
  calls.push({ chain: chainId, address });
  if (address === eeur.contracts[0].address) return optionalReadFails
    ? { ok: false, status: "error", method: "cosmos:bank-supply-by-denom", error: "Sample unavailable source" }
    : { ok: true, supply: 469886.598006, decimals: 6, method: "cosmos:bank-supply-by-denom", endpoint: "https://rpc.example" };
  return { ok: true, supply: 100, decimals: 6, method: "sample:on-chain", endpoint: "https://rpc.example" };
} });
const { buildIssuanceSnapshot } = load("lib/issuance.ts");
const result = await buildIssuanceSnapshot();
assert.equal(result.sourceStats.trackedContracts, 75);
assert.equal(result.sourceStats.rpcSuccessContracts, 75);
assert.equal(result.sourceStats.failedContracts, 0);
assert.equal(result.sourceStats.retiredContracts, 2);
assert.equal(result.totals.withBridged, 7500);
assert.ok(result.stablecoins.some((token) => token.id === "aryze-eeur"));
assert.ok(!calls.some((call) => call.chain === "evmos"));
assert.equal(result.retiredStablecoins[0].contracts[0].supply, 469886.598006);
assert.equal(result.retiredStablecoins[0].contracts[1].supply, 123);
assert.equal(result.retiredStablecoins[0].contracts[1].source, "archived");
assert.equal(result.retiredStablecoins[0].contracts[1].observedAt, "2023-01-01T00:00:00Z");
assert.equal(persisted[0].contracts.length, 77);
assert.equal(persisted[0].contracts.find((contract) => contract.contractKey === evmosKey).valueObservedAt, "2023-01-01T00:00:00Z");
assert.ok(!observations.some((observation) => observation.chainId === "evmos"));

optionalReadFails = true;
const archived = await buildIssuanceSnapshot();
assert.equal(archived.sourceStats.failedContracts, 0);
assert.equal(archived.retiredStablecoins[0].contracts[0].supply, 469886.598006);
assert.equal(archived.retiredStablecoins[0].contracts[0].observedAt, result.generatedAt);
assert.equal(archived.retiredStablecoins[0].contracts[0].source, "archived");

const directory = fs.mkdtempSync(path.join(tmpdir(), "eurcool-retirement-"));
const originalCwd = process.cwd();
try {
  useTurso = false;
  process.chdir(directory);
  // The local history path is captured when the module is loaded.
  modules.delete("lib/history.ts");
  modules.delete("lib/issuance.ts");
  const { buildIssuanceSnapshot: buildLocalSnapshot } = load("lib/issuance.ts");
  fs.mkdirSync("data");
  const initial = {
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), native: 0, withBridged: 0,
    contractSupplies: { [osmosisKey]: 469886.598006, [evmosKey]: 123 },
    contractObservedAt: { [osmosisKey]: "2023-01-01T00:00:00Z", [evmosKey]: "2023-01-01T00:00:00Z" },
  };
  fs.writeFileSync("data/issuance-history.json", JSON.stringify([initial]));
  await buildLocalSnapshot();
  const local = await buildLocalSnapshot();
  assert.equal(local.retiredStablecoins[0].contracts[0].supply, 469886.598006);
  assert.equal(local.retiredStablecoins[0].contracts[0].observedAt, "2023-01-01T00:00:00Z");
  assert.equal(local.sourceStats.failedContracts, 0);
  const saved = JSON.parse(fs.readFileSync("data/issuance-history.json", "utf8"));
  assert.deepEqual(saved[0], initial);
  assert.equal(saved.at(-1).contractSupplies[osmosisKey], 469886.598006);
  assert.equal(saved.at(-1).contractObservedAt[osmosisKey], "2023-01-01T00:00:00Z");
  const withoutDates = { ...initial };
  delete withoutDates.contractObservedAt;
  fs.writeFileSync("data/issuance-history.json", JSON.stringify([withoutDates]));
  await buildLocalSnapshot();
  const unknownDates = await buildLocalSnapshot();
  assert.equal(unknownDates.retiredStablecoins[0].contracts[0].observedAt, null);
} finally {
  process.chdir(originalCwd);
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log("Retirement checks passed: dated exclusion, legacy payloads, preserved raw values and dates, comparable changes, active-only health, and skipped inactive RPCs.");
