"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IssuanceResponse, Interval } from "@/lib/types";

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

const TOKEN_COLORS = ["#2f5ef9", "#7c3aed", "#0284c7", "#0f766e", "#c2410c", "#9f1239", "#1d4ed8"];

type GroupMode = "stablecoin" | "chain";

type BreakdownRow = {
  key: string;
  primary: string;
  secondary: string;
  kind: "native" | "bridged";
  supply: number;
  contractCount: number;
};

type GroupRow = {
  key: string;
  title: string;
  subtitle: string;
  iconText: string;
  iconColor: string;
  nativeSupply: number;
  bridgedSupply: number;
  shownSupply: number;
  breakdown: BreakdownRow[];
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

function stablecoinColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TOKEN_COLORS[Math.abs(hash) % TOKEN_COLORS.length];
}

function badgeLabel(nativeSupply: number, bridgedSupply: number): string {
  if (nativeSupply > 0 && bridgedSupply > 0) return "NATIVE + BRIDGED";
  if (bridgedSupply > 0) return "BRIDGED";
  return "NATIVE";
}

export default function HomePage() {
  const [data, setData] = useState<IssuanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeBridged, setIncludeBridged] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>("stablecoin");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    setExpandedRows({});
  }, [groupMode, includeBridged]);

  const totalIssued = useMemo(() => {
    if (!data) return 0;
    return includeBridged ? data.totals.withBridged : data.totals.native;
  }, [data, includeBridged]);

  const stablecoinGroupRows = useMemo<GroupRow[]>(() => {
    if (!data) return [];

    return data.stablecoins
      .map((token) => {
        const breakdownMap = new Map<string, BreakdownRow>();

        for (const contract of token.contracts) {
          if (contract.supply === null) continue;
          if (!includeBridged && contract.kind === "bridged") continue;

          const breakdownKey = `${contract.chainId}::${contract.kind}`;
          const existing = breakdownMap.get(breakdownKey) ?? {
            key: breakdownKey,
            primary: contract.chainName,
            secondary: contract.chainId,
            kind: contract.kind,
            supply: 0,
            contractCount: 0,
          };

          existing.supply += contract.supply;
          existing.contractCount += 1;
          breakdownMap.set(breakdownKey, existing);
        }

        const bridgedShown = includeBridged ? token.bridgedSupply : 0;
        const shownSupply = token.nativeSupply + bridgedShown;

        return {
          key: token.id,
          title: token.symbol,
          subtitle: token.name,
          iconText: token.symbol.slice(0, 2).toUpperCase(),
          iconColor: stablecoinColor(token.symbol),
          nativeSupply: token.nativeSupply,
          bridgedSupply: bridgedShown,
          shownSupply,
          breakdown: [...breakdownMap.values()].sort((a, b) => b.supply - a.supply),
        };
      })
      .filter((row) => row.shownSupply > 0)
      .sort((a, b) => b.shownSupply - a.shownSupply);
  }, [data, includeBridged]);

  const chainGroupRows = useMemo<GroupRow[]>(() => {
    if (!data) return [];

    const chainMap = new Map<
      string,
      {
        chainName: string;
        nativeSupply: number;
        bridgedSupply: number;
        breakdownMap: Map<string, BreakdownRow>;
      }
    >();

    for (const token of data.stablecoins) {
      for (const contract of token.contracts) {
        if (contract.supply === null) continue;
        if (!includeBridged && contract.kind === "bridged") continue;

        const chainGroup = chainMap.get(contract.chainId) ?? {
          chainName: contract.chainName,
          nativeSupply: 0,
          bridgedSupply: 0,
          breakdownMap: new Map<string, BreakdownRow>(),
        };

        if (contract.kind === "bridged") {
          chainGroup.bridgedSupply += contract.supply;
        } else {
          chainGroup.nativeSupply += contract.supply;
        }

        const breakdownKey = `${token.id}::${contract.kind}`;
        const existing = chainGroup.breakdownMap.get(breakdownKey) ?? {
          key: breakdownKey,
          primary: token.symbol,
          secondary: token.name,
          kind: contract.kind,
          supply: 0,
          contractCount: 0,
        };

        existing.supply += contract.supply;
        existing.contractCount += 1;
        chainGroup.breakdownMap.set(breakdownKey, existing);

        chainMap.set(contract.chainId, chainGroup);
      }
    }

    return [...chainMap.entries()]
      .map(([chainId, group]) => ({
        key: chainId,
        title: group.chainName,
        subtitle: chainId,
        iconText: group.chainName.slice(0, 1).toUpperCase(),
        iconColor: CHAIN_COLORS[chainId] ?? "#94a3b8",
        nativeSupply: group.nativeSupply,
        bridgedSupply: group.bridgedSupply,
        shownSupply: group.nativeSupply + group.bridgedSupply,
        breakdown: [...group.breakdownMap.values()].sort((a, b) => b.supply - a.supply),
      }))
      .filter((row) => row.shownSupply > 0)
      .sort((a, b) => b.shownSupply - a.shownSupply);
  }, [data, includeBridged]);

  const activeGroupRows = useMemo(
    () => (groupMode === "stablecoin" ? stablecoinGroupRows : chainGroupRows),
    [chainGroupRows, groupMode, stablecoinGroupRows],
  );

  function toggleExpanded(rowKey: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  }

  return (
    <main className="page">
      <nav className="top-nav">
        <Link href="/" className="active">
          Home
        </Link>
        <Link href="/sources">Sources</Link>
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
            <div className="group-tabs" role="tablist" aria-label="Grouping mode">
              <button
                type="button"
                role="tab"
                aria-selected={groupMode === "stablecoin"}
                className={`group-tab ${groupMode === "stablecoin" ? "active" : ""}`}
                onClick={() => setGroupMode("stablecoin")}
              >
                By stablecoin
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={groupMode === "chain"}
                className={`group-tab ${groupMode === "chain" ? "active" : ""}`}
                onClick={() => setGroupMode("chain")}
              >
                By chain
              </button>
            </div>

            <p className="group-hint">
              Click a row to expand breakdown by{" "}
              {groupMode === "stablecoin" ? "chain + native/bridged" : "stablecoin + native/bridged"} tuples.
            </p>

            {activeGroupRows.map((row) => {
              const expansionKey = `${groupMode}:${row.key}`;
              const expanded = !!expandedRows[expansionKey];

              return (
                <article className="group-row" key={expansionKey}>
                  <button
                    type="button"
                    className="group-row-main"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(expansionKey)}
                  >
                    <div className="group-meta">
                      <span className="group-icon" style={{ backgroundColor: row.iconColor }} aria-hidden>
                        {row.iconText}
                      </span>
                      <div>
                        <p className="group-badge">{badgeLabel(row.nativeSupply, row.bridgedSupply)}</p>
                        <p className="group-name">{row.title}</p>
                        <p className="group-subname">{row.subtitle}</p>
                      </div>
                    </div>
                    <div className="group-right">
                      <p className="group-value">{formatPrecise(row.shownSupply)}</p>
                      <span className="group-expand" aria-hidden>
                        {expanded ? "▾" : "▸"}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="group-breakdown">
                      {row.breakdown.length === 0 ? (
                        <p className="breakdown-empty">No resolved breakdown for this group yet.</p>
                      ) : (
                        row.breakdown.map((entry) => (
                          <div className="breakdown-row" key={`${expansionKey}:${entry.key}`}>
                            <div className="breakdown-left">
                              <p className="breakdown-title">{entry.primary}</p>
                              <p className="breakdown-subtitle">
                                {entry.secondary}
                                {entry.contractCount > 1 ? ` • ${entry.contractCount} contracts` : ""}
                              </p>
                            </div>
                            <div className="breakdown-right">
                              <span className={`pill ${entry.kind}`}>{entry.kind}</span>
                              <span className="breakdown-value">{formatCompact(entry.supply)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>

          <p className="group-hint">
            Contract-level data sources have moved to the <Link href="/sources">Sources</Link> page.
          </p>
        </>
      ) : null}
    </main>
  );
}
