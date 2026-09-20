import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/lib/pipeline";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const steps = await runFullPipeline(id);
  return NextResponse.json({ steps });
}
