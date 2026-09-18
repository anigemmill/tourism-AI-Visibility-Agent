"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpportunityStatusControls({ businessId, opportunityId }: { businessId: string; opportunityId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function setStatus(status: string) {
    await fetch(`/api/businesses/${businessId}/opportunities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, status }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" disabled={isPending} title="Mark done" onClick={() => setStatus("done")}>
        <Check className="size-4 text-emerald-600" />
      </Button>
      <Button variant="ghost" size="icon" disabled={isPending} title="Dismiss" onClick={() => setStatus("dismissed")}>
        <X className="size-4 text-slate-400" />
      </Button>
    </div>
  );
}
