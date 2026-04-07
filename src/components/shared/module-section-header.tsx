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
      <div className="min-w-0 max-w-none md:max-w-4xl">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="font-display text-foreground mt-3 text-[clamp(1.42rem,5.4vw,2.45rem)] leading-[1.05] tracking-tight sm:text-[clamp(1.55rem,6vw,2.45rem)]">
          {title}
        </h2>
        {description ? (
          <p className="section-summary mt-3 max-w-none text-pretty md:max-w-3xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 md:w-auto">{action}</div> : null}
    </div>
  );
}
