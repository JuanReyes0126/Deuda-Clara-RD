import { ArrowRight, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ActionButton = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | undefined;
};

type PrimaryActionCardProps = {
  eyebrow?: string | undefined;
  title: string;
  description: string;
  badgeLabel?: string | undefined;
  badgeVariant?: "default" | "success" | "warning" | "danger" | undefined;
  primaryAction: ActionButton;
  secondaryAction?: ActionButton | undefined;
  notes?: string[] | undefined;
  icon?: LucideIcon | undefined;
  tone?: "default" | "premium" | "warning" | undefined;
  className?: string | undefined;
};

const toneClassName: Record<
  NonNullable<PrimaryActionCardProps["tone"]>,
  string
> = {
  default:
    "border-primary/12 bg-[rgba(240,248,245,0.92)] shadow-[0_20px_44px_rgba(15,88,74,0.08)]",
  premium:
    "border-primary/18 bg-[linear-gradient(135deg,rgba(240,248,245,0.96),rgba(255,248,241,0.92))] shadow-[0_22px_46px_rgba(15,88,74,0.1)]",
  warning:
    "border-accent/20 bg-[rgba(255,248,241,0.95)] shadow-[0_18px_40px_rgba(240,138,93,0.08)]",
};

export function PrimaryActionCard({
  eyebrow = "Mini IA Clara",
  title,
  description,
  badgeLabel,
  badgeVariant = "default",
  primaryAction,
  secondaryAction,
  notes = [],
  icon: Icon,
  tone = "default",
  className,
}: PrimaryActionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-4 sm:p-6",
        toneClassName[tone],
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="section-kicker">{eyebrow}</p>
            {badgeLabel ? (
              <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            ) : null}
          </div>
          <div className="mt-4 flex items-start gap-4">
            {Icon ? (
              <span className="bg-white/85 text-primary mt-1 grid size-11 shrink-0 place-items-center rounded-2xl border border-border/50">
                <Icon className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-foreground text-[clamp(1.22rem,5.2vw,2rem)] font-semibold leading-[1.08] text-balance">
                {title}
              </p>
              <p className="section-summary mt-2.5 max-w-3xl text-pretty text-sm leading-6 sm:text-base sm:leading-7">
                {description}
              </p>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            onClick={primaryAction.onClick}
            variant={primaryAction.variant ?? "primary"}
          >
            {primaryAction.label}
            <ArrowRight className="size-4" />
          </Button>
          {secondaryAction ? (
            <Button
              className="min-h-12 w-full text-base sm:w-auto"
              variant={secondaryAction.variant ?? "secondary"}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      {notes.length ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {notes.map((note) => (
            <div
              key={note}
              className="rounded-xl border border-border/50 bg-white/86 px-4 py-3 text-sm leading-6 text-foreground"
            >
              {note}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
