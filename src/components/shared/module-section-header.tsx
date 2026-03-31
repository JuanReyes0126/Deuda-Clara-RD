import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ModuleSectionHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ModuleSectionHeader({
  kicker,
  title,
  description,
  action,
  className,
}: ModuleSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-4xl">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="font-display text-foreground mt-3 text-[clamp(1.7rem,4vw,2.45rem)] leading-tight tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="section-summary mt-3 max-w-3xl text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
