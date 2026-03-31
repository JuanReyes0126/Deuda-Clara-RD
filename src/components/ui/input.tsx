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
        "h-12 min-w-0 w-full max-w-full overflow-hidden text-ellipsis rounded-2xl border border-border bg-white/92 px-4 text-sm text-foreground shadow-[0_10px_24px_rgba(24,49,59,0.05)] outline-none transition placeholder:text-muted/80 focus:border-accent/50 focus:ring-4 focus:ring-accent/10",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
