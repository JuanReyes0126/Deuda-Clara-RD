"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SimulatorResultDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export function SimulatorProjectionChart({
  data,
}: {
  data: SimulatorResultDto["monthlyProjection"];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(20,72,60,0.08)" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
        <Line
          type="monotone"
          dataKey="totalBalance"
          stroke="#0f584a"
          strokeWidth={3}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
