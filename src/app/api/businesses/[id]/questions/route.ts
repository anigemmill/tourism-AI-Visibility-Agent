import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const queries = await prisma.travellerQuery.findMany({
    where: { businessId: id },
    orderBy: { commercialIntent: "desc" },
    include: {
      discoveryResults: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
  return NextResponse.json({ queries });
}
