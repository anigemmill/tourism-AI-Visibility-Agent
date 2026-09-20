import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitors } from "@/lib/competitors/analyze-competitors";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const result = await analyzeCompetitors(id);
  return NextResponse.json(result);
}
