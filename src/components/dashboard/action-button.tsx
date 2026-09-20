"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Info } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  endpoint: string;
  method?: "POST" | "PATCH";
  body?: Record<string, unknown>;
  label: string;
  loadingLabel?: string;
  icon?: React.ReactNode;
  onDone?: (data: unknown) => void;
  /** Extracts a short inline note from the response to show under the button (e.g. a rate-limit notice). Return null to show nothing. */
  getNote?: (data: unknown) => string | null;
}

export function ActionButton({
  endpoint,
  method = "POST",
  body,
  label,
  loadingLabel,
  icon,
  onDone,
  getNote,
  ...buttonProps
}: ActionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      onDone?.(data);
      setNote(getNote?.(data) ?? null);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button {...buttonProps} onClick={handleClick} disabled={busy || buttonProps.disabled}>
        {busy ? <Loader2 className="animate-spin" /> : icon}
        {busy ? (loadingLabel ?? label) : label}
      </Button>
      {note && (
        <p className="flex items-center gap-1 text-xs text-amber-600">
          <Info className="size-3" /> {note}
        </p>
      )}
    </div>
  );
}
