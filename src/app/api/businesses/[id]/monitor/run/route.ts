import { NextRequest, NextResponse } from "next/server";
import { runMonitoring } from "@/lib/monitoring/run-monitoring";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  try {
    const summary = await runMonitoring({ businessId: id });
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Monitoring run failed" },
      { status: 400 }
    );
  }
}
