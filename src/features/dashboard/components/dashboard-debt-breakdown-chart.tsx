"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export function DashboardDebtBreakdownChart({
  data,
}: {
  data: DashboardDto["debtBreakdown"];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(20,72,60,0.08)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{
            borderRadius: 20,
            border: "1px solid rgba(20,72,60,0.12)",
            boxShadow: "0 22px 48px rgba(24,59,50,0.09)",
          }}
        />
        <Bar dataKey="value" fill="#89b3a6" radius={[14, 14, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
