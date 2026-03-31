import * as React from "react";

import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_140%)] text-white shadow-[0_18px_40px_rgba(15,118,110,0.24)] hover:brightness-105 focus-visible:ring-primary/30",
  secondary:
    "border border-[rgba(240,138,93,0.18)] bg-[rgba(255,255,255,0.88)] text-foreground shadow-[0_12px_30px_rgba(240,138,93,0.08)] hover:bg-accent-soft/60 focus-visible:ring-accent/20",
  ghost:
    "bg-transparent text-foreground hover:bg-[rgba(15,118,110,0.08)] focus-visible:ring-primary/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonClasses({
  className,
  variant = "primary",
  size = "md",
}: {
  className?: string | undefined;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return cn(
    "inline-flex max-w-full items-center justify-center rounded-full text-center font-semibold whitespace-normal [overflow-wrap:normal] transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ className, variant, size })}
      {...props}
    />
  ),
);

Button.displayName = "Button";
