import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "warning" | "danger" | "success";

const badgeClasses: Record<BadgeVariant, string> = {
  default: "bg-secondary text-foreground",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-rose-100 text-rose-700",
  success: "bg-emerald-100 text-emerald-700",
};

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string | undefined;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        badgeClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
