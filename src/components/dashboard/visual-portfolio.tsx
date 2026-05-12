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

const STATUS_COLORS: Record<string, string> = {
  "AL_DIA": "#10b981",
  "ATRASADA": "#f59e0b",
  "CRITICA": "#ef4444",
  "al-dia": "#10b981",
  "atrasada": "#f59e0b",
  "critica": "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  "AL_DIA": "Al día",
  "ATRASADA": "Atrasada",
  "CRITICA": "Crítica",
  "al-dia": "Al día",
  "atrasada": "Atrasada",
  "critica": "Crítica",
};

const STATUS_ICONS: Record<string, any> = {
  "AL_DIA": CheckCircle2,
  "ATRASADA": AlertCircle,
  "CRITICA": AlertCircle,
  "al-dia": CheckCircle2,
  "atrasada": AlertCircle,
  "critica": AlertCircle,
};

export function VisualPortfolio({ debts, totalAmount }: VisualPortfolioProps) {
  const getStatusKey = (status: string) => {
    const key = status.toUpperCase().replace("-", "_");
    if (STATUS_COLORS[key]) return key;
    if (STATUS_COLORS[status]) return status;
    return "AL_DIA";
  };

  const distribution = [
    { name: "Al día", value: debts.filter(d => getStatusKey(d.status) === "AL_DIA" || getStatusKey(d.status) === "al-dia").reduce((sum, d) => sum + d.amount, 0), color: "#10b981" },
    { name: "Atrasada", value: debts.filter(d => getStatusKey(d.status) === "ATRASADA" || getStatusKey(d.status) === "atrasada").reduce((sum, d) => sum + d.amount, 0), color: "#f59e0b" },
    { name: "Crítica", value: debts.filter(d => getStatusKey(d.status) === "CRITICA" || getStatusKey(d.status) === "critica").reduce((sum, d) => sum + d.amount, 0), color: "#ef4444" },
  ].filter(item => item.value > 0);

  const healthyCount = debts.filter(d => getStatusKey(d.status) === "AL_DIA" || getStatusKey(d.status) === "al-dia").length;
  const financialHealth = debts.length > 0 ? Math.round((healthyCount / debts.length) * 100) : 100;

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
                <div className="p-3 bg-emerald-100 rounded-full"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
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
                <div className="p-3 bg-blue-100 rounded-full"><DollarSign className="w-6 h-6 text-blue-600" /></div>
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
                <div className="p-3 bg-purple-100 rounded-full"><Target className="w-6 h-6 text-purple-600" /></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader><CardTitle className="text-lg font-semibold text-slate-800">Distribución de Cartera</CardTitle></CardHeader>
            <CardContent>
              {distribution.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {distribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString('es-DO')}`} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400"><p>Agrega deudas para ver el gráfico</p></div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader><CardTitle className="text-lg font-semibold text-slate-800">Tus Deudas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {debts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400"><DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No tienes deudas registradas</p></div>
                ) : (
                  debts.map((debt, index) => {
                    const statusKey = getStatusKey(debt.status);
                    const IconComponent = STATUS_ICONS[statusKey] || AlertCircle;
                    const bgColor = statusKey === "AL_DIA" || statusKey === "al-dia" ? "bg-emerald-100" : statusKey === "ATRASADA" || statusKey === "atrasada" ? "bg-amber-100" : "bg-red-100";
                    const textColor = statusKey === "AL_DIA" || statusKey === "al-dia" ? "text-emerald-700" : statusKey === "ATRASADA" || statusKey === "atrasada" ? "text-amber-700" : "text-red-700";
                    const badgeBg = statusKey === "AL_DIA" || statusKey === "al-dia" ? "bg-emerald-100" : statusKey === "ATRASADA" || statusKey === "atrasada" ? "bg-amber-100" : "bg-red-100";
                    const badgeText = statusKey === "AL_DIA" || statusKey === "al-dia" ? "text-emerald-700" : statusKey === "ATRASADA" || statusKey === "atrasada" ? "text-amber-700" : "text-red-700";
                    
                    return (
                      <motion.div key={debt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="group p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${bgColor}`}>
                              <IconComponent className="w-5 h-5" style={{ color: textColor.replace('text-', '').replace('-700', '') === 'emerald' ? '#059669' : textColor.replace('text-', '').replace('-700', '') === 'amber' ? '#d97706' : '#dc2626' }} />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{debt.name}</div>
                              <div className="text-xs text-slate-500">{debt.interestRate ? `${debt.interestRate}% interés` : 'Sin interés'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-800">${debt.amount.toLocaleString('es-DO')}</div>
                            <Badge variant="secondary" className={`text-xs ${badgeBg} ${badgeText}`}>{STATUS_LABELS[statusKey] || debt.status}</Badge>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
