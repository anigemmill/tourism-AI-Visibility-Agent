import { NextRequest, NextResponse } from "next/server";
import { generateContentOpportunities, saveContentOpportunities } from "@/lib/opportunities/generate-opportunities";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const drafts = await generateContentOpportunities(id);
  const created = await saveContentOpportunities(id, drafts);
  return NextResponse.json({ generated: drafts.length, created: created.length });
}
