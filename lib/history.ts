import { promises as fs } from "fs";
import path from "path";
import { IntervalChange, IssuanceSnapshot } from "@/lib/types";

const HISTORY_FILE = path.join(process.cwd(), "data", "issuance-history.json");
const RETAIN_MS = 120 * 24 * 60 * 60 * 1000;

const INTERVALS: Array<{ interval: IntervalChange["interval"]; ms: number }> = [
  { interval: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { interval: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { interval: "day", ms: 24 * 60 * 60 * 1000 },
  { interval: "hour", ms: 60 * 60 * 1000 },
];

async function ensureDataDir() {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseContractSupplies(value: unknown): Record<string, number> | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const parsed: Record<string, number> = {};

  for (const [key, supply] of Object.entries(value)) {
    if (typeof supply !== "number" || !Number.isFinite(supply)) {
      return null;
    }

    parsed[key] = supply;
  }

  return parsed;
}

function parseSnapshot(value: unknown): IssuanceSnapshot | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const timestamp = typeof value.timestamp === "string" ? value.timestamp : "";
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) {
    return null;
  }

  const native = value.native;
  const withBridged = value.withBridged;
  if (
    typeof native !== "number" ||
    !Number.isFinite(native) ||
    typeof withBridged !== "number" ||
    !Number.isFinite(withBridged)
  ) {
    return null;
  }

  const contractSupplies = parseContractSupplies(value.contractSupplies);
  if (!contractSupplies) {
    return null;
  }

  return {
    timestamp,
    native,
    withBridged,
    contractSupplies,
  };
}

function emptyIntervalChanges(): IntervalChange[] {
  return INTERVALS.map(({ interval }) => ({
    interval,
    absChange: null,
    pctChange: null,
  }));
}

export async function readHistory(): Promise<IssuanceSnapshot[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => parseSnapshot(entry))
      .filter((entry): entry is IssuanceSnapshot => entry !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    return [];
  }
}

export async function appendSnapshot(snapshot: IssuanceSnapshot): Promise<IssuanceSnapshot[]> {
  await ensureDataDir();

  const history = await readHistory();
  history.push(snapshot);

  const cutoff = Date.now() - RETAIN_MS;
  const pruned = history.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff);

  await fs.writeFile(HISTORY_FILE, JSON.stringify(pruned, null, 2));
  return pruned;
}

function findSnapshotBefore(history: IssuanceSnapshot[], targetTs: number): IssuanceSnapshot | null {
  let best: IssuanceSnapshot | null = null;

  for (const snapshot of history) {
    const ts = new Date(snapshot.timestamp).getTime();
    if (Number.isNaN(ts) || ts > targetTs) {
      continue;
    }

    if (!best || ts > new Date(best.timestamp).getTime()) {
      best = snapshot;
    }
  }

  return best;
}

function sumComparableSupplies(
  current: Record<string, number>,
  previous: Record<string, number>,
): {
  currentTotal: number;
  previousTotal: number;
  comparableContracts: number;
} {
  let currentTotal = 0;
  let previousTotal = 0;
  let comparableContracts = 0;

  for (const [key, previousValue] of Object.entries(previous)) {
    const currentValue = current[key];
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) {
      continue;
    }

    previousTotal += previousValue;
    currentTotal += currentValue;
    comparableContracts += 1;
  }

  return {
    currentTotal,
    previousTotal,
    comparableContracts,
  };
}

export function computeIntervalChanges(history: IssuanceSnapshot[]): IntervalChange[] {
  const current = history[history.length - 1];
  if (!current) {
    return emptyIntervalChanges();
  }

  const currentTs = new Date(current.timestamp).getTime();
  if (Number.isNaN(currentTs)) {
    return emptyIntervalChanges();
  }

  return INTERVALS.map(({ interval, ms }) => {
    const previousSnapshot = findSnapshotBefore(history, currentTs - ms);

    if (!previousSnapshot) {
      return {
        interval,
        absChange: null,
        pctChange: null,
      };
    }

    const { currentTotal, previousTotal, comparableContracts } = sumComparableSupplies(
      current.contractSupplies,
      previousSnapshot.contractSupplies,
    );

    if (comparableContracts === 0) {
      return {
        interval,
        absChange: null,
        pctChange: null,
      };
    }

    const absChange = currentTotal - previousTotal;
    const pctChange = previousTotal === 0 ? null : (absChange / previousTotal) * 100;

    return {
      interval,
      absChange,
      pctChange,
    };
  });
}
