"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FactCheckIssue } from "@prisma/client";

const SEVERITY_VARIANT: Record<string, "danger" | "warning" | "info" | "default"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "default",
};

export function FactCheckIssueRow({ businessId, issue }: { businessId: string; issue: FactCheckIssue }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function resolve() {
    await fetch(`/api/businesses/${businessId}/fact-check`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId: issue.id, status: "resolved" }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <Badge variant={SEVERITY_VARIANT[issue.severity] ?? "default"} className="mt-0.5 shrink-0">
        {issue.severity}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">
          <span className="font-medium capitalize">{issue.field}</span> via {issue.sourcePlatform}: &ldquo;{issue.claimedValue}&rdquo;
          {issue.actualValue && (
            <>
              {" "}
              — actual: <span className="font-medium">{issue.actualValue}</span>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">Booking impact: {Math.round(issue.bookingImpact * 100)}%</p>
      </div>
      <Button variant="ghost" size="icon" disabled={isPending} title="Mark resolved" onClick={resolve} className="shrink-0">
        <Check className="size-4 text-emerald-600" />
      </Button>
    </li>
  );
}
