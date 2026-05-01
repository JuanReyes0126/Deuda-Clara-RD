import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type ContextMetricItem = {
  label: string;
  value: string;
  support?: string | undefined;
  badgeLabel?: string | undefined;
  badgeVariant?: "default" | "success" | "warning" | "danger" | undefined;
  valueKind?: "value" | "date" | "text" | undefined;
  span?: 1 | 2 | undefined;
};

type ContextMetricsGridProps = {
  items: ContextMetricItem[];
  className?: string;
  columnsClassName?: string;
  itemClassName?: string;
};

function getValueClassName(kind: ContextMetricItem["valueKind"]) {
  if (kind === "date") {
    return "date-stable";
  }

  if (kind === "text") {
    return "";
  }

  return "value-stable";
}

export function ContextMetricsGrid({
  items,
  className,
  columnsClassName,
  itemClassName,
}: ContextMetricsGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 sm:gap-4",
        columnsClassName,
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className={cn(
            "min-w-0 rounded-2xl border border-border/55 bg-white/92 p-4 shadow-[0_14px_32px_rgba(24,49,59,0.06)] sm:p-5",
            item.span === 2 ? "sm:col-span-2" : "",
            itemClassName,
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              {item.label}
            </p>
            {item.badgeLabel ? (
              <Badge variant={item.badgeVariant ?? "default"}>
                {item.badgeLabel}
              </Badge>
            ) : null}
          </div>
          <p
            className={cn(
              getValueClassName(item.valueKind),
              "text-foreground mt-3 text-[clamp(1.1rem,5vw,1.9rem)] font-semibold leading-tight",
            )}
          >
            {item.value}
          </p>
          {item.support ? (
            <p className="support-copy mt-2 text-pretty">{item.support}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
