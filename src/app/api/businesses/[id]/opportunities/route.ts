import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const status = req.nextUrl.searchParams.get("status");
  const opportunities = await prisma.contentOpportunity.findMany({
    where: { businessId: id, ...(status ? { status } : {}) },
    orderBy: { priorityScore: "desc" },
    include: { generatedContent: true },
  });
  return NextResponse.json({ opportunities });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = await req.json();
  const { opportunityId, status } = body as { opportunityId: string; status: string };
  if (!opportunityId || !status) {
    return NextResponse.json({ error: "opportunityId and status are required" }, { status: 400 });
  }
  await prisma.contentOpportunity.updateMany({
    where: { id: opportunityId, businessId: id },
    data: { status },
  });
  const updated = await prisma.contentOpportunity.findUnique({ where: { id: opportunityId } });
  return NextResponse.json({ opportunity: updated });
}
