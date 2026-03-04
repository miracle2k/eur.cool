import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main className="page">
      <div className="header-line">
        <div />
        <nav className="top-nav">
          <Link href="/">Home</Link>
          <Link href="/sources">Sources</Link>
          <a href="https://farcaster.xyz/nix" target="_blank" rel="noreferrer">
            @nix
          </a>
        </nav>
        <a
          className="header-cta"
          href="https://github.com/miracle2k/eur.cool/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          Submit / correct data ↗
        </a>
      </div>

      <h1 className="brand">
        <span className="brand-icon">€</span> methodology
      </h1>

      <section className="contracts-card">
        <div className="contracts-head">
          <h2>How numbers are computed</h2>
          <p>Strict on-chain issuance tracker</p>
        </div>

        <div style={{ padding: "1rem", lineHeight: 1.75 }}>
          <ol>
            <li>
              <strong>Token universe:</strong> EUR stablecoins and contracts are curated in
              <code> data/eurStablecoinRegistry.ts</code>.
            </li>
            <li>
              <strong>Issuance source:</strong> every included amount is read from a chain-native method (EVM
              <code> totalSupply()</code>, Solana mint supply, Stellar issued balances, XRPL obligations, Algorand ASA
              state, Cosmos bank denom supply, Tezos token totals, and IC ledger metrics).
            </li>
            <li>
              <strong>No off-chain fallback attribution:</strong> production totals never invent or estimate issuance
              from third-party market APIs. If a contract read fails, the latest fresh on-chain value may be carried
              forward for a limited window; otherwise the row is marked unavailable.
            </li>
            <li>
              <strong>Caching:</strong> <code>/api/stablecoins</code> serves cached snapshots (default TTL: 5m).
              <code> /api/stablecoins/refresh</code> forces an immediate rebuild.
            </li>
            <li>
              <strong>History:</strong> each refresh writes per-contract snapshot data. With
              <code> TURSO_DATABASE_URL</code> set, snapshots and contract rows are persisted in Turso; otherwise they
              are stored locally in <code> data/issuance-history.json</code>. 1h/24h/7d/30d changes are computed only
              from contracts present in both snapshots being compared, so newly added contracts join each interval
              once enough history exists for that window.
            </li>
          </ol>
          <p style={{ marginTop: "0.8rem", color: "#555d70" }}>
            See the <Link href="/sources">Sources</Link> page for contract-level method labels and explorer links.
          </p>
        </div>
      </section>

      <footer className="inspired-footer">
        Inspired by the excellent <a href="https://usdc.cool/" target="_blank" rel="noreferrer">usdc.cool</a>{" "}
        project.
      </footer>
    </main>
  );
}
