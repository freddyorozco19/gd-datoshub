"use client";

import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenuePoint } from "@/lib/dashboard/metrics";
import { ANNUAL_GOAL_COP } from "@/lib/dashboard/config";
import { Card, fmtMoney } from "./ui";

export default function RevenueChart({ data, company }: { data: RevenuePoint[]; company: "COP" | "USD" }) {
  const hasGoal = !!ANNUAL_GOAL_COP && company === "COP";
  return (
    <Card title="Ganado acumulado del año" subtitle={hasGoal ? "Real, proyección con forecast y meta anual" : "Real y proyección con forecast · sin meta anual configurada"}>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-real" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => fmtMoney(v, company)} />
          <Tooltip
            contentStyle={{ background: "rgba(13,13,26,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
            formatter={(v, name) => [fmtMoney(Number(v), company), String(name)]}
          />
          <Area type="monotone" dataKey="real" name="Real" stroke="#10B981" strokeWidth={2.5} fill="url(#rev-real)" connectNulls={false} />
          <Line type="monotone" dataKey="proyeccion" name="Proyección" stroke="#10B981" strokeWidth={2} strokeDasharray="4 5" dot={false} connectNulls={false} />
          {hasGoal && <Line type="linear" dataKey="meta" name="Meta" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
