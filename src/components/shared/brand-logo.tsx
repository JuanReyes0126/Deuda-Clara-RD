import { cn } from "@/lib/utils/cn";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

type BrandBadgeProps = {
  className?: string;
  markClassName?: string;
  title?: string;
};

type BrandLockupProps = {
  className?: string;
  markClassName?: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function BrandMark({
  className,
  title = "Logo de Deuda Clara RD",
}: BrandMarkProps) {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
      className={cn("shrink-0 text-[#2e8c80]", className)}
      style={{ maxWidth: "100%", height: "auto" }}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      <circle
        cx="48"
        cy="48"
        r="33.5"
        stroke="currentColor"
        strokeWidth="5.5"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M24 57.5L36 45.5L44 53.5L57 40.5L71 40.5"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d="M63 32.5L71 40.5L63 48.5"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function BrandBadge({
  className,
  markClassName,
  title,
}: BrandBadgeProps) {
  return (
    <div
      className={cn(
        "grid size-12 place-items-center overflow-hidden rounded-2xl border border-[#d5e8e2] bg-[linear-gradient(180deg,#ffffff_0%,#f4faf8_100%)] shadow-[0_18px_40px_-28px_rgba(23,56,74,0.38)]",
        className,
      )}
    >
      <BrandMark
        {...(title ? { title } : {})}
        className={cn("size-7", markClassName)}
      />
    </div>
  );
}

export function BrandLockup({
  className,
  markClassName,
  subtitle = "Control real de deudas personales",
  titleClassName,
  subtitleClassName,
}: BrandLockupProps) {
  return (
    <div className={cn("inline-flex max-w-max items-center gap-3", className)}>
      <BrandMark className={cn("size-10 sm:size-11", markClassName)} />
      <div className="min-w-0">
        <p
          className={cn(
            "text-[1.65rem] font-semibold leading-none tracking-[-0.04em] text-[#17384a] sm:text-[2rem]",
            titleClassName,
          )}
        >
          Deuda Clara RD
        </p>
        <p
          className={cn(
            "mt-1.5 text-sm leading-6 text-[#5e7481] sm:text-[0.98rem]",
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
