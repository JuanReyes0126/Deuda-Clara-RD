"use client";

import { Crown, LockKeyhole } from "lucide-react";

import {
  MEMBERSHIP_COMMERCIAL_COPY,
  getCommercialPriceSummary,
} from "@/config/membership-commercial-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type UpgradeCTAProps = {
  title: string;
  description: string;
  requiredPlan: "Premium" | "Pro";
  ctaText: string;
  onClick?: () => void;
  className?: string;
};

function getUpgradePlanLabel(requiredPlan: UpgradeCTAProps["requiredPlan"]) {
  return requiredPlan === "Premium"
    ? "Mejor escenario en Premium"
    : "Control total en Pro";
}

export function UpgradeCTA({
  title,
  description,
  requiredPlan,
  ctaText,
  onClick,
  className,
}: UpgradeCTAProps) {
  const priceSummary = getCommercialPriceSummary(requiredPlan);

  return (
    <div
      className={cn(
        "rounded-[1.6rem] border border-primary/14 bg-[rgba(255,248,241,0.84)] p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="warning">{getUpgradePlanLabel(requiredPlan)}</Badge>
        <Badge variant="default">
          <LockKeyhole className="mr-1 size-3.5" />
          Valor bloqueado
        </Badge>
        <Badge variant="success">{priceSummary}</Badge>
      </div>
      <p className="mt-4 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-7 text-muted">{description}</p>
      <p className="mt-3 text-xs leading-6 text-primary">
        {MEMBERSHIP_COMMERCIAL_COPY.reinforcement.checkout}{" "}
        {MEMBERSHIP_COMMERCIAL_COPY.reinforcement.riskFree}
      </p>
      {onClick ? (
        <div className="mt-4">
          <Button onClick={onClick}>
            <Crown className="mr-2 size-4" />
            {ctaText}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
