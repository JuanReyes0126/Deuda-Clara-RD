import Image from "next/image";

import { cn } from "@/lib/utils/cn";

const brandLogoSrc = "/brand/deuda-clara-logo-20260408.png";

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
    <Image
      src={brandLogoSrc}
      alt={title}
      width={1024}
      height={1024}
      className={cn(
        "shrink-0 object-contain mix-blend-darken scale-[1.14]",
        className,
      )}
      sizes="(max-width: 640px) 48px, 64px"
      priority
    />
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
        "grid size-12 place-items-center overflow-hidden rounded-2xl",
        className,
      )}
    >
      <BrandMark
        {...(title ? { title } : {})}
        className={cn("size-[92%]", markClassName)}
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
