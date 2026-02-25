import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main className="page">
      <nav className="top-nav">
        <Link href="/">Home</Link>
        <Link href="/sources">Sources</Link>
        <Link href="/methodology" className="active">
          Methodology
        </Link>
        <a href="https://x.com/usdc_cool" target="_blank" rel="noreferrer">
          @eur_cool
        </a>
      </nav>

      <h1 className="brand">
        <span className="brand-icon">€</span> methodology
      </h1>

      <section className="contracts-card">
        <div className="contracts-head">
          <h2>How numbers are computed</h2>
          <p>RPC-first issuance tracker</p>
        </div>

        <div style={{ padding: "1rem", lineHeight: 1.75 }}>
          <ol>
            <li>
              <strong>Token universe:</strong> EUR stablecoins discovered via CoinGecko, with contracts curated in
              <code> data/eurStablecoinRegistry.ts</code>.
            </li>
            <li>
              <strong>Issuance source:</strong> For EVM contracts, <code>totalSupply()</code> is read directly from RPC
              nodes (Alchemy + public fallbacks).
            </li>
            <li>
              <strong>Coverage fallback:</strong> if a token has non-EVM supply that cannot be resolved by RPC, an
              unattributed remainder is estimated from CoinGecko circulating supply. See the
              <Link href="/sources"> Sources</Link> page for per-contract attribution status.
            </li>
            <li>
              <strong>Caching:</strong> <code>/api/stablecoins</code> serves cached snapshots (default TTL: 5m).
              <code> /api/stablecoins/refresh</code> forces an immediate rebuild.
            </li>
            <li>
              <strong>History:</strong> each refresh writes a snapshot to
              <code> data/issuance-history.json</code> and computes 1h/24h/7d/30d changes.
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
