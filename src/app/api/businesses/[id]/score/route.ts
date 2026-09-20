import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeAndSaveVisibilitySnapshot } from "@/lib/scoring/visibility-score";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const snapshot = await computeAndSaveVisibilitySnapshot(id);
  return NextResponse.json({ snapshot });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const history = req.nextUrl.searchParams.get("history") === "true";

  if (history) {
    const snapshots = await prisma.visibilitySnapshot.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { components: true },
    });
    return NextResponse.json({ snapshots });
  }

  const latest = await prisma.visibilitySnapshot.findFirst({
    where: { businessId: id },
    orderBy: { createdAt: "desc" },
    include: { components: true },
  });
  return NextResponse.json({ snapshot: latest });
}
