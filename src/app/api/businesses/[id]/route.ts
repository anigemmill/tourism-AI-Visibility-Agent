import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      competitorLinks: true,
      products: true,
      experiences: true,
      locations: true,
      faqs: true,
      policies: true,
      reviews: true,
      credentials: true,
      differentiators: true,
      crawlSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  return NextResponse.json({ business });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.business.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
