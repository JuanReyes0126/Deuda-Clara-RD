import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 min-w-0 w-full max-w-full overflow-hidden text-ellipsis rounded-2xl border border-border bg-white/92 px-4 text-base text-foreground shadow-[0_10px_24px_rgba(24,49,59,0.05)] outline-none transition-all duration-200 ease-out placeholder:text-muted/80 focus:border-primary/35 focus:bg-white focus:shadow-[0_16px_34px_-26px_rgba(23,56,74,0.45)] focus:ring-4 focus:ring-primary/10 motion-reduce:transition-none sm:text-sm",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
