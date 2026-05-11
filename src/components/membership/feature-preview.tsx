"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type FeaturePreviewProps = {
  title: string;
  description: string;
  label?: string;
  className?: string;
};

export function FeaturePreview({
  title,
  description,
  label = "Vista parcial",
  className,
}: FeaturePreviewProps) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border border-border/50 bg-white/85 px-4 py-4",
        className,
      )}
    >
      <Badge variant="default">{label}</Badge>
      <p className="mt-3 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
