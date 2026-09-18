"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  endpoint: string;
  method?: "POST" | "PATCH";
  body?: Record<string, unknown>;
  label: string;
  loadingLabel?: string;
  icon?: React.ReactNode;
  onDone?: (data: unknown) => void;
}

export function ActionButton({
  endpoint,
  method = "POST",
  body,
  label,
  loadingLabel,
  icon,
  onDone,
  ...buttonProps
}: ActionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      onDone?.(data);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || isPending;

  return (
    <Button {...buttonProps} onClick={handleClick} disabled={busy || buttonProps.disabled}>
      {busy ? <Loader2 className="animate-spin" /> : icon}
      {busy ? (loadingLabel ?? label) : label}
    </Button>
  );
}
