import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export type ExecutiveSummaryItem = {
  label: string;
  value: string;
  support?: string | undefined;
  icon?: LucideIcon | undefined;
  featured?: boolean | undefined;
  badgeLabel?: string | undefined;
  badgeVariant?: "default" | "success" | "warning" | "danger" | undefined;
  valueKind?: "value" | "date" | "text" | undefined;
};

type ExecutiveSummaryStripProps = {
  items: ExecutiveSummaryItem[];
  className?: string;
};

function getValueClassName(kind: ExecutiveSummaryItem["valueKind"]) {
  if (kind === "date") {
    return "date-stable";
  }

  if (kind === "text") {
    return "";
  }

  return "value-stable";
}

export function ExecutiveSummaryStrip({
  items,
  className,
}: ExecutiveSummaryStripProps) {
  if (!items.length) {
    return null;
  }

  const featured = (items.find((item) => item.featured) ?? items[0])!;
  const compactItems = items.filter((item) => item !== featured);
  const FeaturedIcon = featured.icon;

  return (
    <div
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
        className,
      )}
    >
      <Card className="min-w-0 border-primary/12 bg-[rgba(240,248,245,0.92)] p-4 sm:p-6">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {featured.badgeLabel ? (
              <Badge variant={featured.badgeVariant ?? "default"}>
                {featured.badgeLabel}
              </Badge>
            ) : null}
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.22em]">
              {featured.label}
            </CardDescription>
          </div>
          <div className="flex items-start gap-4">
            {FeaturedIcon ? (
              <span className="bg-white/85 text-primary mt-1 grid size-11 shrink-0 place-items-center rounded-2xl border border-border/50">
                <FeaturedIcon className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <CardTitle
                className={cn(
                  getValueClassName(featured.valueKind),
                  "mt-0 text-[clamp(1.75rem,7vw,3rem)] leading-none",
                )}
              >
                {featured.value}
              </CardTitle>
              {featured.support ? (
                <p className="support-copy mt-3 max-w-2xl text-pretty">
                  {featured.support}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {compactItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={`${item.label}-${item.value}`} className="min-w-0 p-4 sm:p-5">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {Icon ? (
                    <span className="bg-secondary text-primary grid size-9 shrink-0 place-items-center rounded-2xl">
                      <Icon className="size-4" />
                    </span>
                  ) : null}
                  {item.badgeLabel ? (
                    <Badge variant={item.badgeVariant ?? "default"}>
                      {item.badgeLabel}
                    </Badge>
                  ) : null}
                </div>
                <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                  {item.label}
                </CardDescription>
                <CardTitle
                  className={cn(
                    getValueClassName(item.valueKind),
                    "mt-1 text-[clamp(1.2rem,5vw,1.8rem)] leading-tight",
                  )}
                >
                  {item.value}
                </CardTitle>
              </CardHeader>
              {item.support ? (
                <CardContent className="pt-1">
                  <p className="support-copy">{item.support}</p>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
