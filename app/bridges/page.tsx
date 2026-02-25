import Link from "next/link";

export default function BridgesPage() {
  return (
    <main className="page">
      <nav className="top-nav">
        <Link href="/">Home</Link>
        <Link href="/bridges" className="active">
          Bridges
        </Link>
        <Link href="/methodology">Methodology</Link>
        <a href="https://x.com/usdc_cool" target="_blank" rel="noreferrer">
          @eur_cool
        </a>
      </nav>

      <h1 className="brand">
        <span className="brand-icon">€</span> bridges
      </h1>

      <section className="contracts-card">
        <div className="contracts-head">
          <h2>Bridge note</h2>
          <p>Bridged contracts are tracked separately and can be toggled on/off on Home.</p>
        </div>
        <div style={{ padding: "1rem", lineHeight: 1.7 }}>
          <p>
            <strong>Current explicit bridge entries:</strong> Omnibridge EURC (Gnosis), selected synthetic/legacy
            EUR deployments, and identified non-native chain representations.
          </p>
          <p>
            As additional bridge wrappers are discovered, add them to
            <code> data/eurStablecoinRegistry.ts</code> with <code>kind: &quot;bridged&quot;</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
