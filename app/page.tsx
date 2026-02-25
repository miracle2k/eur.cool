"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IssuanceResponse, Interval, StablecoinIssuance } from "@/lib/types";

const INTERVAL_LABELS: Record<Interval, string> = {
  month: "Past month",
  week: "Past week",
  day: "Past 24 hours",
  hour: "Past hour",
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#8b5cf6",
  base: "#2563eb",
  "arbitrum-one": "#7c3aed",
  "polygon-pos": "#9333ea",
  avalanche: "#ef4444",
  "optimistic-ethereum": "#ef4444",
  xdai: "#14b8a6",
  "binance-smart-chain": "#eab308",
  solana: "#111827",
  other: "#64748b",
};

function formatLarge(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  return `€${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCompact(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "↑" : "↓"}${Math.abs(value).toFixed(2)}%`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [data, setData] = useState<IssuanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeBridged, setIncludeBridged] = useState(true);

  async function loadData(force = false) {
    setLoading((prev) => (data ? prev : true));
    setError(null);

    try {
      const res = await fetch(`/api/stablecoins${force ? "?force=1" : ""}`, { cache: "no-store" });
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

  async function triggerRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/stablecoins/refresh", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Refresh failed (${res.status})`);
      }
      await loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIssued = useMemo(() => {
    if (!data) return 0;
    return includeBridged ? data.totals.withBridged : data.totals.native;
  }, [data, includeBridged]);

  const chainRows = useMemo(() => {
    if (!data) return [];
    return [...data.chains]
      .map((chain) => ({
        ...chain,
        shownSupply: includeBridged ? chain.totalSupply : chain.nativeSupply,
      }))
      .filter((chain) => chain.shownSupply > 0)
      .sort((a, b) => b.shownSupply - a.shownSupply);
  }, [data, includeBridged]);

  const tokenRows = useMemo(() => {
    if (!data) return [];

    const rows: Array<{
      token: StablecoinIssuance;
      chainName: string;
      chainId: string;
      address: string;
      kind: "native" | "bridged";
      supply: number | null;
      source: string;
      status: string;
    }> = [];

    for (const token of data.stablecoins) {
      for (const contract of token.contracts) {
        if (!includeBridged && contract.kind === "bridged") continue;
        rows.push({
          token,
          chainName: contract.chainName,
          chainId: contract.chainId,
          address: contract.address,
          kind: contract.kind,
          supply: contract.supply,
          source: contract.source,
          status: contract.status,
        });
      }
    }

    return rows.sort((a, b) => (b.supply ?? -1) - (a.supply ?? -1));
  }, [data, includeBridged]);

  return (
    <main className="page">
      <nav className="top-nav">
        <Link href="/" className="active">
          Home
        </Link>
        <Link href="/bridges">Bridges</Link>
        <Link href="/methodology">Methodology</Link>
        <a href="https://x.com/usdc_cool" target="_blank" rel="noreferrer">
          @eur_cool
        </a>
      </nav>

      <h1 className="brand">
        <span className="brand-icon">€</span> eur.cool
      </h1>

      {loading && !data ? <p className="state">Loading issuance feed…</p> : null}
      {error ? <p className="state error">{error}</p> : null}

      {data ? (
        <>
          <section className="summary-card">
            <div className="summary-main">
              <p className="summary-big">{formatLarge(totalIssued)}</p>
              <p className="summary-label">ISSUED</p>
              <p className="summary-time">as of {formatTimestamp(data.generatedAt)}</p>
            </div>

            <div className="summary-grid">
              {data.changes.map((change) => {
                const positive = (change.pctChange ?? 0) >= 0;
                return (
                  <article key={change.interval} className="summary-stat">
                    <p className="summary-stat-label">{INTERVAL_LABELS[change.interval]}</p>
                    <p className={`summary-stat-pct ${positive ? "up" : "down"}`}>
                      {formatPct(change.pctChange)}
                    </p>
                    <p className="summary-stat-abs">{formatCompact(change.absChange)}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="controls">
            <button
              type="button"
              className={`toggle ${includeBridged ? "on" : "off"}`}
              onClick={() => setIncludeBridged((prev) => !prev)}
            >
              Show Bridged EUR Stables
            </button>
            <button type="button" className="refresh" onClick={triggerRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>

          <section className="list-card">
            {chainRows.map((chain) => {
              const badge =
                chain.nativeSupply > 0 && chain.bridgedSupply > 0
                  ? "NATIVE + BRIDGED"
                  : chain.bridgedSupply > 0
                    ? "BRIDGED"
                    : "NATIVE";

              return (
                <div className="chain-row" key={chain.chainId}>
                  <div className="chain-meta">
                    <span
                      className="chain-icon"
                      style={{ backgroundColor: CHAIN_COLORS[chain.chainId] ?? "#94a3b8" }}
                      aria-hidden
                    >
                      {chain.chainName.slice(0, 1)}
                    </span>
                    <div>
                      <p className="chain-badge">{badge}</p>
                      <p className="chain-name">{chain.chainName}</p>
                    </div>
                  </div>
                  <p className="chain-value">{formatPrecise(chain.shownSupply)}</p>
                </div>
              );
            })}
          </section>

          <section className="contracts-card">
            <div className="contracts-head">
              <h2>Tracked contracts</h2>
              <p>
                {data.sourceStats.trackedTokens} tokens • {data.sourceStats.trackedContracts} contracts •
                RPC ok {" "}
                {data.sourceStats.rpcSuccessContracts}
              </p>
            </div>

            <div className="contracts-table-wrap">
              <table className="contracts-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Chain</th>
                    <th>Type</th>
                    <th>Issued</th>
                    <th>Contract</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenRows.map((row, index) => (
                    <tr key={`${row.token.id}-${row.chainId}-${index}`}>
                      <td>
                        {row.token.symbol} <span className="token-name">{row.token.name}</span>
                      </td>
                      <td>{row.chainName}</td>
                      <td>
                        <span className={`pill ${row.kind}`}>{row.kind}</span>
                      </td>
                      <td>{row.supply === null ? "—" : formatCompact(row.supply)}</td>
                      <td className="mono tiny" title={row.address}>
                        {row.address}
                      </td>
                      <td className={row.status === "ok" ? "ok" : "warn"}>{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
