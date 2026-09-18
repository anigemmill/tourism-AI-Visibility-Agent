import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runFactCheck, saveFactCheckIssues } from "@/lib/fact-check/fact-checker";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = req.nextUrl.searchParams.get("status");
  const issues = await prisma.factCheckIssue.findMany({
    where: { businessId: id, ...(status ? { status } : {}) },
    orderBy: [{ bookingImpact: "desc" }, { detectedAt: "desc" }],
  });
  return NextResponse.json({ issues });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drafts = await runFactCheck(id);
  const created = await saveFactCheckIssues(id, drafts);
  return NextResponse.json({ found: drafts.length, created: created.length });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { issueId, status } = (await req.json()) as { issueId: string; status: string };
  if (!issueId || !status) {
    return NextResponse.json({ error: "issueId and status are required" }, { status: 400 });
  }
  await prisma.factCheckIssue.updateMany({ where: { id: issueId, businessId: id }, data: { status } });
  const updated = await prisma.factCheckIssue.findUnique({ where: { id: issueId } });
  return NextResponse.json({ issue: updated });
}
