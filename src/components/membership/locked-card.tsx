"use client";

import type { ReactNode } from "react";

import {
  MEMBERSHIP_COMMERCIAL_COPY,
  getCommercialPriceSummary,
} from "@/config/membership-commercial-copy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type LockedCardProps = {
  title: string;
  description: string;
  requiredPlan: "Premium" | "Pro";
  reason: string;
  children?: ReactNode;
  className?: string;
};

function getLockedPlanLabel(requiredPlan: LockedCardProps["requiredPlan"]) {
  return requiredPlan === "Premium"
    ? "Mejor escenario en Premium"
    : "Control total en Pro";
}

export function LockedCard({
  title,
  description,
  requiredPlan,
  reason,
  children,
  className,
}: LockedCardProps) {
  const priceSummary = getCommercialPriceSummary(requiredPlan);

  return (
    <Card
      className={cn(
        "border-dashed border-primary/18 bg-[rgba(255,248,241,0.8)]",
        className,
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="warning">{getLockedPlanLabel(requiredPlan)}</Badge>
          <Badge variant="default">Lo que todavía no estás viendo</Badge>
          <Badge variant="success">{priceSummary}</Badge>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <p className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-sm leading-7 text-muted">
          {reason}
        </p>
        <p className="text-xs leading-6 text-primary">
          {MEMBERSHIP_COMMERCIAL_COPY.reinforcement.checkout}{" "}
          {MEMBERSHIP_COMMERCIAL_COPY.reinforcement.riskFree}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}
