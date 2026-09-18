import { NextRequest, NextResponse } from "next/server";
import { generateContentOpportunities, saveContentOpportunities } from "@/lib/opportunities/generate-opportunities";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drafts = await generateContentOpportunities(id);
  const created = await saveContentOpportunities(id, drafts);
  return NextResponse.json({ generated: drafts.length, created: created.length });
}
