import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type NarrativeInsightCardProps = {
  kicker?: string;
  title: string;
  description: string;
  badges?: Array<{
    label: string;
    variant?: "default" | "success" | "warning" | "danger";
  }>;
  icon?: LucideIcon;
  tone?: "default" | "soft" | "warm";
  footer?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

const toneClassName: Record<
  NonNullable<NarrativeInsightCardProps["tone"]>,
  string
> = {
  default: "border-primary/12 bg-[rgba(240,248,245,0.92)]",
  soft: "border-border bg-secondary/35",
  warm: "border-primary/15 bg-[rgba(255,248,241,0.86)]",
};

export function NarrativeInsightCard({
  kicker,
  title,
  description,
  badges = [],
  icon: Icon,
  tone = "default",
  footer,
  aside,
  className,
}: NarrativeInsightCardProps) {
  return (
    <section
      className={cn("rounded-[1.9rem] border p-5 sm:p-6", toneClassName[tone], className)}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,240px)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {kicker ? <p className="section-kicker">{kicker}</p> : null}
            {badges.map((badge) => (
              <Badge key={`${badge.label}-${badge.variant ?? "default"}`} variant={badge.variant ?? "default"}>
                {badge.label}
              </Badge>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-4">
            {Icon ? (
              <span className="bg-white/85 text-primary mt-1 grid size-11 shrink-0 place-items-center rounded-2xl border border-border/50">
                <Icon className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-foreground text-[clamp(1.35rem,3vw,2rem)] font-semibold leading-tight">
                {title}
              </p>
              <p className="section-summary mt-3 max-w-3xl text-pretty">
                {description}
              </p>
            </div>
          </div>
          {footer ? <div className="mt-5">{footer}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}
