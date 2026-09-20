import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContentForOpportunity, saveGeneratedContent } from "@/lib/digest/generate-content";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; oppId: string }> }
) {
  const { id, oppId } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const opportunity = await prisma.contentOpportunity.findUnique({ where: { id: oppId } });
  if (!opportunity || opportunity.businessId !== id) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const drafts = await generateContentForOpportunity(oppId);
  await saveGeneratedContent(id, oppId, drafts);
  return NextResponse.json({ drafts });
}
