import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
