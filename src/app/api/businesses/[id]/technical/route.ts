import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const snapshots = await prisma.crawlSnapshot.findMany({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ snapshots });
}
