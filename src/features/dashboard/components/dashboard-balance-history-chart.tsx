"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export function DashboardBalanceHistoryChart({
  data,
}: {
  data: DashboardDto["balanceHistory"];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f584a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#0f584a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="totalBalance"
          stroke="#0f584a"
          strokeWidth={3}
          fill="url(#balanceGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
