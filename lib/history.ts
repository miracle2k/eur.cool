import { promises as fs } from "fs";
import path from "path";
import { IntervalChange, IssuanceSnapshot } from "@/lib/types";

const HISTORY_FILE = path.join(process.cwd(), "data", "issuance-history.json");
const RETAIN_MS = 120 * 24 * 60 * 60 * 1000;

async function ensureDataDir() {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
}

export async function readHistory(): Promise<IssuanceSnapshot[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw) as IssuanceSnapshot[];

    return parsed
      .filter((entry) => entry?.timestamp)
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

export function computeIntervalChanges(
  history: IssuanceSnapshot[],
  currentWithBridged: number,
): IntervalChange[] {
  const intervals: Array<{ interval: IntervalChange["interval"]; ms: number }> = [
    { interval: "month", ms: 30 * 24 * 60 * 60 * 1000 },
    { interval: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { interval: "day", ms: 24 * 60 * 60 * 1000 },
    { interval: "hour", ms: 60 * 60 * 1000 },
  ];

  const now = Date.now();

  return intervals.map(({ interval, ms }) => {
    const snapshot = findSnapshotBefore(history, now - ms);

    if (!snapshot) {
      return {
        interval,
        absChange: null,
        pctChange: null,
      };
    }

    const previous = snapshot.withBridged;
    const absChange = currentWithBridged - previous;
    const pctChange = previous === 0 ? null : (absChange / previous) * 100;

    return {
      interval,
      absChange,
      pctChange,
    };
  });
}
