import { buildIssuanceSnapshot } from "@/lib/issuance";
import { isTursoEnabled, readLatestIssuancePayload } from "@/lib/turso-store";
import { IssuanceResponse } from "@/lib/types";

const CACHE_TTL_MS = Number(process.env.ISSUANCE_CACHE_TTL_MS ?? 60 * 1000);

let cache: { data: IssuanceResponse; fetchedAt: number } | null = null;
let inFlightRefresh: Promise<IssuanceResponse> | null = null;

function writeCache(data: IssuanceResponse) {
  cache = { data, fetchedAt: Date.now() };
}

export async function refreshIssuanceData(): Promise<IssuanceResponse> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = buildIssuanceSnapshot()
    .then((data) => {
      writeCache(data);
      return data;
    })
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

export async function getIssuanceData(): Promise<IssuanceResponse> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (isTursoEnabled()) {
    try {
      const persisted = await readLatestIssuancePayload();
      if (persisted) {
        writeCache(persisted);
        return persisted;
      }
    } catch (error) {
      if (cache) {
        return cache.data;
      }

      throw error;
    }

    if (cache) {
      return cache.data;
    }

    throw new Error("No persisted snapshot available yet. Trigger POST /api/stablecoins/refresh (e.g. via CronJob).");
  }

  return refreshIssuanceData();
}
