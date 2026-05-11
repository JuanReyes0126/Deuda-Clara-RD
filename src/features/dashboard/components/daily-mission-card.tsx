"use client";

import { Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardDto } from "@/lib/types/app";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";

import { buildDailyMission } from "../lib/daily-mission";

type DailyMissionCardProps = {
  data: DashboardDto;
};

export function DailyMissionCard({ data }: DailyMissionCardProps) {
  const { navigate } = useAppNavigation();
  const mission = buildDailyMission(data);

  return (
    <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(240,248,245,0.95),rgba(255,255,255,0.98))] shadow-soft">
      <CardHeader className="gap-3 pb-2 pr-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
            <Target className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/90">
              {mission.title}
            </p>
            <CardTitle className="mt-1 text-balance text-lg sm:text-xl">
              {mission.body}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              {data.habitSignals.microFeedback}
            </CardDescription>
          </div>
        </div>
        {mission.streakWeeks > 0 ? (
          <Badge variant="success" className="shrink-0">
            Racha {mission.streakWeeks} sem.
          </Badge>
        ) : (
          <Badge variant="default" className="shrink-0">
            Empieza tu racha
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            trackPlanEvent("dashboard_daily_mission_click", {
              href: mission.ctaHref,
            });
            navigate(mission.ctaHref);
          }}
        >
          {mission.ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
