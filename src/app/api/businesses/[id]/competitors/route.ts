import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitors } from "@/lib/competitors/analyze-competitors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await analyzeCompetitors(id);
  return NextResponse.json(result);
}
