import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn("min-w-0 break-words text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
});

Label.displayName = "Label";
