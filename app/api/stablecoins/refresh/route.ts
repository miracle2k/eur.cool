import { NextRequest, NextResponse } from "next/server";
import { getIssuanceData } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const requiredSecret = process.env.REFRESH_SECRET;
  if (!requiredSecret) {
    return true;
  }

  const provided =
    request.headers.get("x-refresh-secret") ?? request.nextUrl.searchParams.get("secret") ?? "";

  return provided === requiredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getIssuanceData(true);
    return NextResponse.json({
      ok: true,
      generatedAt: data.generatedAt,
      totals: data.totals,
      sourceStats: data.sourceStats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST /api/stablecoins/refresh",
    note: "Optionally set REFRESH_SECRET and pass x-refresh-secret header.",
  });
}
