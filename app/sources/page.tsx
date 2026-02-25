"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IssuanceResponse } from "@/lib/types";

function formatCompact(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function humanSource(source: string, chainId: string): string {
  if (source === "rpc") return "on-chain rpc";
  if (source === "coingecko" && chainId === "other") return "coingecko remainder";
  if (source === "coingecko") return "coingecko";
  return "unavailable";
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
        <Link href="/methodology">Methodology</Link>
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
          <h2>Why do some rows use CoinGecko?</h2>
          <p>RPC-first, but not every chain can be queried with ERC-20 style calls.</p>
        </div>

        <div style={{ padding: "1rem", lineHeight: 1.72 }}>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>
              <strong>source = rpc:</strong> we read <code>totalSupply()</code> directly on EVM contracts.
            </li>
            <li>
              <strong>source = coingecko remainder:</strong> token-level circulating supply is known, but part of that
              supply lives on ledgers where we do not yet have per-chain adapters.
            </li>
            <li>
              <strong>chain = Other / Unattributed:</strong> the fallback remainder bucket. It means supply exists, but
              we cannot attribute it to a specific chain with current on-chain adapters.
            </li>
            <li>
              <strong>source = unavailable:</strong> either unsupported non-EVM chain format or missing/failed RPC
              endpoint.
            </li>
          </ul>
          <p style={{ marginTop: "0.9rem", color: "#555d70" }}>
            We can still move more of this to full on-chain by implementing chain-specific adapters (Solana mint
            supply, Stellar issued assets, XRPL trust lines, Algorand assets, IBC/cosmos bank supply, etc.).
          </p>
        </div>
      </section>

      {stats ? (
        <section className="contracts-card">
          <div className="contracts-head">
            <h2>Coverage summary</h2>
            <p>
              {stats.trackedTokens} tokens • {stats.trackedContracts} contracts • rpc {stats.rpc} • coingecko {stats.coingecko}
              {" "}• unavailable {stats.unavailable}
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
                    <td>
                      {row.chainName}
                      <span className="token-name"> ({row.chainId})</span>
                    </td>
                    <td>
                      <span className={`pill ${row.kind}`}>{row.kind}</span>
                    </td>
                    <td>{formatCompact(row.supply)}</td>
                    <td className="mono tiny" title={row.address}>
                      {row.address}
                    </td>
                    <td>{humanSource(row.source, row.chainId)}</td>
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
