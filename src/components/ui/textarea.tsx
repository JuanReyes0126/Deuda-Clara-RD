import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-28 min-w-0 w-full max-w-full rounded-3xl border border-border bg-white/92 px-4 py-3 text-sm text-foreground shadow-[0_10px_24px_rgba(24,49,59,0.05)] outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-4 focus:ring-accent/10",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
