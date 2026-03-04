import { buildIssuanceSnapshot } from "@/lib/issuance";
import { isTursoEnabled, readLatestIssuancePayload } from "@/lib/turso-store";
import { IssuanceResponse } from "@/lib/types";

const CACHE_TTL_MS = Number(process.env.ISSUANCE_CACHE_TTL_MS ?? 5 * 60 * 1000);

let cache: { data: IssuanceResponse; fetchedAt: number } | null = null;
let inFlight: Promise<IssuanceResponse> | null = null;

function launchRefresh(): Promise<IssuanceResponse> {
  if (inFlight) {
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

function isPersistedSnapshotStale(snapshot: IssuanceResponse, now: number): boolean {
  const ts = new Date(snapshot.generatedAt).getTime();
  if (Number.isNaN(ts)) {
    return true;
  }

  return now - ts >= CACHE_TTL_MS;
}

export async function getIssuanceData(force = false): Promise<IssuanceResponse> {
  const now = Date.now();

  if (force) {
    return launchRefresh();
  }

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (inFlight) {
    return inFlight;
  }

  if (isTursoEnabled()) {
    try {
      const persisted = await readLatestIssuancePayload();
      if (persisted) {
        cache = {
          data: persisted,
          fetchedAt: Date.now(),
        };

        if (isPersistedSnapshotStale(persisted, now)) {
          void launchRefresh().catch(() => {
            // stale snapshot is still served; background refresh can retry later
          });
        }

        return persisted;
      }
    } catch {
      // fall through to a live rebuild path
    }
  }

  return launchRefresh();
}
