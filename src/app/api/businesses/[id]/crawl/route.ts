import { NextRequest, NextResponse } from "next/server";
import { crawlAndPersist } from "@/lib/crawler/run-crawl";
import { requireBusinessAccess } from "@/lib/auth/api-guard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessAccess(id);
  if (!auth) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  try {
    const result = await crawlAndPersist(id);
    if (result.pagesCrawled === 0) {
      return NextResponse.json({ result, error: "Could not crawl any pages from this website." }, { status: 422 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Crawl failed" }, { status: 400 });
  }
}
