import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshots = await prisma.crawlSnapshot.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ snapshots });
}
