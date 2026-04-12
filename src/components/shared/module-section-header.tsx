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
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4",
        className,
      )}
    >
      <div className="min-w-0 max-w-none md:max-w-4xl">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="font-display text-foreground mt-2.5 text-[clamp(1.34rem,5vw,2.28rem)] leading-[1.06] tracking-tight sm:text-[clamp(1.48rem,5.2vw,2.36rem)]">
          {title}
        </h2>
        {description ? (
          <p className="section-summary mt-2.5 max-w-none text-pretty text-sm leading-6 md:max-w-3xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 md:w-auto">{action}</div> : null}
    </div>
  );
}
