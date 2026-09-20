import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyDigest, saveDailyDigest } from "@/lib/digest/daily-digest";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const history = req.nextUrl.searchParams.get("history") === "true";

  if (history) {
    const digests = await prisma.dailyDigest.findMany({
      where: { businessId: id },
      orderBy: { date: "desc" },
      take: 30,
    });
    return NextResponse.json({ digests });
  }

  const latest = await prisma.dailyDigest.findFirst({ where: { businessId: id }, orderBy: { date: "desc" } });
  return NextResponse.json({ digest: latest });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const content = await generateDailyDigest(id);
  const digest = await saveDailyDigest(id, content);
  return NextResponse.json({ digest });
}
