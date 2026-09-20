import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { businessCreateSchema } from "@/lib/validation";
import { requireSession } from "@/lib/auth/api-guard";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const businesses = await prisma.business.findMany({
    where: { accountId: session.accountId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { discoveryResults: true, contentOpportunities: true, factCheckIssues: true } },
    },
  });
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await req.json();
  const parsed = businessCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const business = await prisma.business.create({
    data: {
      accountId: session.accountId,
      name: input.name,
      website: normalizeUrl(input.website),
      destination: input.destination,
      category: input.category,
      bookingUrl: input.bookingUrl ? normalizeUrl(input.bookingUrl) : null,
      description: input.description ?? null,
      targetMarkets: input.targetMarkets,
      targetSegments: input.targetSegments,
      socialProfiles: (input.socialProfiles ?? undefined) as Prisma.InputJsonValue | undefined,
      competitorLinks: {
        create: input.competitors.map((c) => ({
          competitorName: c.name,
          competitorWebsite: c.website ?? null,
        })),
      },
      products: {
        create: input.products.map((p) => ({
          name: p.name,
          description: p.description,
          confidence: 1,
        })),
      },
    },
    include: { competitorLinks: true, products: true },
  });

  return NextResponse.json({ business }, { status: 201 });
}

function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}
