import { NextRequest, NextResponse } from "next/server";
import { generateContentForOpportunity, saveGeneratedContent } from "@/lib/digest/generate-content";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; oppId: string }> }
) {
  const { id, oppId } = await params;
  const drafts = await generateContentForOpportunity(oppId);
  await saveGeneratedContent(id, oppId, drafts);
  return NextResponse.json({ drafts });
}
