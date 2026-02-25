"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IssuanceResponse } from "@/lib/types";
import { assetExplorerUrl } from "@/lib/explorers";

function formatCompact(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

const METHOD_LABELS: Record<string, string> = {
  "evm:erc20-totalSupply": "ERC-20 totalSupply()",
  "solana:getTokenSupply": "Solana getTokenSupply(mint)",
  "stellar:horizon-assets": "Stellar Horizon /assets issued balances",
  "xrpl:gateway_balances": "XRPL gateway_balances obligations",
  "algorand:indexer-total-minus-reserve": "Algorand ASA total - reserve balance",
  "cosmos:bank-supply-by-denom": "Cosmos bank supply/by_denom",
  "tezos:tzkt-token-totalSupply": "Tezos token totalSupply (TzKT)",
  "ic:canister-metrics-ledger_total_supply": "IC ledger_total_supply metric",
  "coingecko:circulating-supply-remainder": "CoinGecko circulating-supply remainder",
};

function humanMethod(method: string, source: string): string {
  const label = METHOD_LABELS[method];
  if (label) return label;
  if (source === "unavailable") return "Unavailable";
  return method;
}

export default function SourcesPage() {
  const [data, setData] = useState<IssuanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const res = await fetch("/api/stablecoins", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch issuance (${res.status})`);
        }
        const payload = (await res.json()) as IssuanceResponse;
        setData(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];

    const list: Array<{
      tokenSymbol: string;
      tokenName: string;
      chainName: string;
      chainId: string;
      kind: "native" | "bridged";
      supply: number | null;
      address: string;
      source: "rpc" | "coingecko" | "unavailable";
      method: string;
      explorerUrl: string | null;
      status: "ok" | "error" | "unsupported";
      error?: string;
    }> = [];

    for (const token of data.stablecoins) {
      for (const contract of token.contracts) {
        list.push({
          tokenSymbol: token.symbol,
          tokenName: token.name,
          chainName: contract.chainName,
          chainId: contract.chainId,
          kind: contract.kind,
          supply: contract.supply,
          address: contract.address,
          source: contract.source,
          method: contract.method,
          explorerUrl: assetExplorerUrl(contract.chainId, contract.address),
          status: contract.status,
          error: contract.error,
        });
      }
    }

    return list.sort((a, b) => {
      const sourceRank = (v: string) => (v === "rpc" ? 0 : v === "coingecko" ? 1 : 2);
      const rankDiff = sourceRank(a.source) - sourceRank(b.source);
      if (rankDiff !== 0) return rankDiff;
      return (b.supply ?? -1) - (a.supply ?? -1);
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;

    const counts: Record<"rpc" | "coingecko" | "unavailable", number> = {
      rpc: 0,
      coingecko: 0,
      unavailable: 0,
    };
    for (const row of rows) {
      counts[row.source] += 1;
    }

    return {
      ...counts,
      trackedTokens: data.sourceStats.trackedTokens,
      trackedContracts: data.sourceStats.trackedContracts,
      unsupportedContracts: data.sourceStats.unsupportedContracts,
      failedContracts: data.sourceStats.failedContracts,
    };
  }, [data, rows]);

  return (
    <main className="page">
      <nav className="top-nav">
        <Link href="/">Home</Link>
        <Link href="/sources" className="active">
          Sources
        </Link>
        <a href="https://x.com/usdc_cool" target="_blank" rel="noreferrer">
          @eur_cool
        </a>
      </nav>

      <h1 className="brand">
        <span className="brand-icon">€</span> sources
      </h1>

      {loading ? <p className="state">Loading source map…</p> : null}
      {error ? <p className="state error">{error}</p> : null}

      <section className="contracts-card">
        <div className="contracts-head">
          <h2>Strict on-chain source policy</h2>
          <p>Issuance totals are derived from chain-native methods only (no fallback attribution).</p>
        </div>

        <div style={{ padding: "1rem", lineHeight: 1.72 }}>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>
              <strong>Source column:</strong> shows the exact on-chain mechanism used for each row (for example,
              ERC-20 <code>totalSupply()</code>, Solana <code>getTokenSupply</code>, or XRPL
              <code> gateway_balances</code>).
            </li>
            <li>
              <strong>Contract / Asset column:</strong> links to an external explorer whenever one is available.
            </li>
            <li>
              <strong>Unavailable rows:</strong> represent temporary read failures only; issuance is never backfilled via
              CoinGecko fallback.
            </li>
          </ul>
          <p style={{ marginTop: "0.9rem", color: "#555d70" }}>
            Internal identifiers are still available via hover tooltips for advanced debugging, but not shown as visible
            primary labels.
          </p>
        </div>
      </section>

      {stats ? (
        <section className="contracts-card">
          <div className="contracts-head">
            <h2>Coverage summary</h2>
            <p>
              {stats.trackedTokens} tokens • {stats.trackedContracts} contracts • on-chain {stats.rpc} •
              {" "}fallback {stats.coingecko} • unavailable {stats.unavailable}
            </p>
          </div>
        </section>
      ) : null}

      {data ? (
        <section className="contracts-card">
          <div className="contracts-head">
            <h2>Contract source table</h2>
            <p>Rows sorted by source and then issued amount.</p>
          </div>

          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Chain</th>
                  <th>Type</th>
                  <th>Issued</th>
                  <th>Contract / Asset</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.tokenSymbol}-${row.chainId}-${index}`}>
                    <td>
                      {row.tokenSymbol} <span className="token-name">{row.tokenName}</span>
                    </td>
                    <td title={`internal chain id: ${row.chainId}`}>{row.chainName}</td>
                    <td>
                      <span className={`pill ${row.kind}`}>{row.kind}</span>
                    </td>
                    <td>{formatCompact(row.supply)}</td>
                    <td className="mono tiny" title={row.address}>
                      {row.explorerUrl ? (
                        <a href={row.explorerUrl} target="_blank" rel="noreferrer">
                          {row.address}
                        </a>
                      ) : (
                        row.address
                      )}
                    </td>
                    <td title={row.method}>{humanMethod(row.method, row.source)}</td>
                    <td className={row.status === "ok" ? "ok" : "warn"} title={row.error}>
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
