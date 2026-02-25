import { buildIssuanceSnapshot } from "@/lib/issuance";
import { IssuanceResponse } from "@/lib/types";

const CACHE_TTL_MS = Number(process.env.ISSUANCE_CACHE_TTL_MS ?? 5 * 60 * 1000);

let cache: { data: IssuanceResponse; fetchedAt: number } | null = null;
let inFlight: Promise<IssuanceResponse> | null = null;

export async function getIssuanceData(force = false): Promise<IssuanceResponse> {
  const now = Date.now();

  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (!force && inFlight) {
    return inFlight;
  }

  inFlight = buildIssuanceSnapshot()
    .then((data) => {
      cache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
