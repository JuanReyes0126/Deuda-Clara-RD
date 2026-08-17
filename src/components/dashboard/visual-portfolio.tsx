"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { TrendingUp, AlertCircle, CheckCircle2, DollarSign, Target } from "lucide-react";
import type { Debt } from "@prisma/client";

interface VisualPortfolioProps {
  debts: Debt[];
  totalAmount: number;
}

const STATUS_COLORS = {
  "al-dia": "#10b981",
  "atrasada": "#f59e0b",
  "critica": "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  "al-dia": "Al día",
  "atrasada": "Atrasada",
  "critica": "Crítica",
};

export function VisualPortfolio({ debts, totalAmount }: VisualPortfolioProps) {
  const distribution = [
    { name: "Al día", value: debts.filter(d => d.status === "al-dia").reduce((sum, d) => sum + d.amount, 0), color: STATUS_COLORS["al-dia"] },
    { name: "Atrasada", value: debts.filter(d => d.status === "atrasada").reduce((sum, d) => sum + d.amount, 0), color: STATUS_COLORS["atrasada"] },
    { name: "Crítica", value: debts.filter(d => d.status === "critica").reduce((sum, d) => sum + d.amount, 0), color: STATUS_COLORS["critica"] },
  ].filter(item => item.value > 0);

  const financialHealth = debts.length > 0 
    ? Math.round((debts.filter(d => d.status === "al-dia").length / debts.length) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Salud Financiera</p>
                  <p className="text-3xl font-bold text-emerald-900">{financialHealth}%</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Deudas</p>
                  <p className="text-3xl font-bold text-blue-900">${totalAmount.toLocaleString('es-DO')}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Meta Libertad</p>
                  <p className="text-3xl font-bold text-purple-900">{100 - financialHealth}%</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Distribución de Cartera</CardTitle>
            </CardHeader>
            <CardContent>
              {distribution.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => `$${value.toLocaleString('es-DO')}`}
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          borderRadius: '12px', 
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  <p>Agrega deudas para ver el gráfico</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Tus Deudas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {debts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No tienes deudas registradas</p>
                  </div>
                ) : (
                  debts.map((debt, index) => (
                    <motion.div
                      key={debt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            debt.status === "al-dia" ? "bg-emerald-100" :
                            debt.status === "atrasada" ? "bg-amber-100" : "bg-red-100"
                          }`}>
                            {debt.status === "al-dia" ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{debt.name}</div>
                            <div className="text-xs text-slate-500">
                              {debt.interestRate ? `${debt.interestRate}% interés` : 'Sin interés'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-800">${debt.amount.toLocaleString('es-DO')}</div>
                          <Badge variant="secondary" className={`text-xs ${
                            debt.status === "al-dia" ? "bg-emerald-100 text-emerald-700" :
                            debt.status === "atrasada" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          }`}>
                            {STATUS_LABELS[debt.status]}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
