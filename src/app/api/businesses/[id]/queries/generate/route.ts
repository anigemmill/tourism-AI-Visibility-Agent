import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTravellerQueries } from "@/lib/queries/generate-queries";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const business = await prisma.business.findUnique({
    where: { id },
    include: { experiences: true },
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const generated = generateTravellerQueries({
    destination: business.destination,
    category: business.category,
    targetSegments: business.targetSegments,
    experienceNames: business.experiences.map((e) => e.name),
    businessName: business.name,
  });

  const existing = await prisma.travellerQuery.findMany({ where: { businessId: id }, select: { text: true } });
  const seen = new Set(existing.map((q) => q.text.toLowerCase()));
  const toCreate = generated.filter((q) => !seen.has(q.text.toLowerCase()));

  if (toCreate.length > 0) {
    await prisma.travellerQuery.createMany({
      data: toCreate.map((q) => ({
        businessId: id,
        text: q.text,
        intent: q.intent,
        segment: q.segment,
        commercialIntent: q.commercialIntent,
      })),
    });
  }

  const queries = await prisma.travellerQuery.findMany({ where: { businessId: id }, orderBy: { commercialIntent: "desc" } });
  return NextResponse.json({ created: toCreate.length, queries });
}
