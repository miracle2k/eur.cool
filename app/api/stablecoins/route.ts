import { NextResponse } from "next/server";
import { getIssuanceData } from "@/lib/server-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getIssuanceData();
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
