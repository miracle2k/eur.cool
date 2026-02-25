import { NextRequest, NextResponse } from "next/server";
import { getIssuanceData } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const data = await getIssuanceData(force);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build issuance snapshot",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
