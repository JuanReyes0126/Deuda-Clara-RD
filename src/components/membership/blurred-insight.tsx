"use client";

import { cn } from "@/lib/utils/cn";

type BlurredInsightProps = {
  title: string;
  value: string;
  support: string;
  className?: string;
};

export function BlurredInsight({
  title,
  value,
  support,
  className,
}: BlurredInsightProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/85 px-4 py-4",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {title}
      </p>
      <div className="mt-3 select-none blur-[6px]">
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{support}</p>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.28)_35%,rgba(255,255,255,0.62)_100%)]" />
    </div>
  );
}
