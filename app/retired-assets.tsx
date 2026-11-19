import type { StablecoinIssuance } from "@/lib/types";

function formatDate(value: string, includeTime = false): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  });
}

export default function RetiredAssets({ assets, showContracts = false }: {
  assets?: StablecoinIssuance[];
  showContracts?: boolean;
}) {
  if (!assets?.length) return null;

  return (
    <section className="contracts-card retired-assets" aria-labelledby="retired-assets-title">
      <div className="contracts-head">
        <h2 id="retired-assets-title">Retired assets</h2>
        <p>Excluded from active supply</p>
      </div>
      {assets.map((token) => {
        const retirement = token.retirement;
        if (!retirement) return null;
        return (
          <article className="retired-asset" key={token.id}>
            <div className="retired-name">
              <h3>{token.symbol} · {token.name}</h3>
              <span className="pill">Retired</span>
            </div>
            <p className="retired-details">
              €0 contribution to active supply since {formatDate(retirement.effectiveDate)}.
              {" "}{retirement.reason}{" "}
              <a href={retirement.sourceUrl} target="_blank" rel="noreferrer">Issuer notice ↗</a>
            </p>
            <p className="retired-details">Recorded token balances remain listed for reference.</p>
            <div className="retired-balances">
              {token.contracts.map((contract) => (
                <div className="retired-balance" key={`${contract.chainId}:${contract.address}`}>
                  <div className="retired-balance-meta">
                    <strong>{contract.chainName}</strong>
                    <small>
                      {contract.supply === null ? "No verified balance available" : contract.observedAt
                        ? `Last observed ${formatDate(contract.observedAt, true)} UTC`
                        : "Observation date unknown"}
                    </small>
                    {showContracts ? <code>{contract.address}</code> : null}
                  </div>
                  <span className="retired-amount">
                    {contract.supply === null ? "Unknown balance" : `${contract.supply.toLocaleString("en-US", {
                      maximumFractionDigits: Math.min(contract.decimals ?? 8, 20),
                    })} ${token.symbol}`}
                  </span>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
