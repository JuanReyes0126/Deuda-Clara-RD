"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { TrendingUp, AlertCircle, CheckCircle2, DollarSign, Target, Zap, Trophy, Sparkles } from "lucide-react";
import type { Debt, DebtStatus } from "@prisma/client";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";

interface VisualPortfolioProps {
  debts: any[]; // Usamos any temporalmente hasta definir el tipo exacto del schema
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

export function VisualPortfolio({ debts, totalAmount }: VisualPortfolioProps) {
  const [focusMode, setFocusMode] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Efecto de confeti al lograr hitos
  useEffect(() => {
    if (debts.length > 0 && showConfetti) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b"]
      });
      setShowConfetti(false);
    }
  }, [showConfetti, debts.length]);

  // Calcular distribución por estado (Manejando ambos formatos de status)
  const getStatusKey = (status: string) => status.toUpperCase().replace("-", "_");
  
  const distribution = [
    { 
      name: "Al día", 
      value: debts.filter(d => getStatusKey(d.status) === "AL_DIA").reduce((sum, d) => sum + (d.balance || d.totalAmount || d.amount || 0), 0), 
      color: STATUS_COLORS["AL_DIA"] 
    },
    { 
      name: "Atrasada", 
      value: debts.filter(d => getStatusKey(d.status) === "ATRASADA").reduce((sum, d) => sum + (d.balance || d.totalAmount || d.amount || 0), 0), 
      color: STATUS_COLORS["ATRASADA"] 
    },
    { 
      name: "Crítica", 
      value: debts.filter(d => getStatusKey(d.status) === "CRITICA").reduce((sum, d) => sum + (d.balance || d.totalAmount || d.amount || 0), 0), 
      color: STATUS_COLORS["CRITICA"] 
    },
  ].filter(item => item.value > 0);

  // Calcular salud financiera
  const healthyDebts = debts.filter(d => getStatusKey(d.status) === "AL_DIA").length;
  const financialHealth = debts.length > 0 ? Math.round((healthyDebts / debts.length) * 100) : 100;

  // Filtrar deudas para modo focus
  const displayedDebts = focusMode 
    ? debts.filter(d => d.id === focusMode)
    : debts;

  const triggerConfetti = () => {
    setShowConfetti(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#10b981", "#3b82f6"]
    });
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Resumen con Gamificación */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
        >
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Trophy className="w-24 h-24 text-emerald-600" />
            </div>
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Salud Financiera
                  </p>
                  <p className="text-3xl font-bold text-emerald-900 mt-1">{financialHealth}%</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {financialHealth >= 80 ? "¡Excelente trabajo! 🏆" : financialHealth >= 50 ? "Vas por buen camino 🚀" : "¡Tú puedes mejorar! 💪"}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              {/* Barra de progreso */}
              <div className="mt-3 h-2 bg-emerald-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${financialHealth}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Deudas</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">${totalAmount.toLocaleString('es-DO')}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
        >
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Meta Libertad
                  </p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{100 - financialHealth}%</p>
                  <p className="text-xs text-purple-600 mt-1">Falta poco para ser libre</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              {/* Barra de progreso inversa */}
              <div className="mt-3 h-2 bg-purple-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - financialHealth}%` }}
                  transition={{ duration: 1, delay: 0.7 }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Botón de Modo Focus si hay deudas */}
      {debts.length > 1 && !focusMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            onClick={() => {}}
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Zap className="w-4 h-4" />
            Activar Modo Enfoque (Próximamente)
          </Button>
        </motion.div>
      )}

      {/* Gráfico y Lista */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Dona */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-500" />
                Distribución de Cartera
              </CardTitle>
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
                        onMouseEnter={triggerConfetti}
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
                  <p className="text-center">Agrega deudas para ver tu gráfico 📊</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Lista de Deudas Estilo Qik */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center justify-between">
                <span>Tus Deudas</span>
                {focusMode && (
                  <Button variant="ghost" size="sm" onClick={() => setFocusMode(null)} className="text-xs h-8">
                    Salir del enfoque
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {displayedDebts.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="text-center py-8 text-slate-400"
                    >
                      <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tienes deudas registradas</p>
                    </motion.div>
                  ) : (
                    displayedDebts.map((debt, index) => (
                      <motion.div
                        key={debt.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className="group p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => setFocusMode(focusMode === debt.id ? null : debt.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.div 
                              whileTap={{ scale: 0.9 }}
                              className={`p-2 rounded-full ${
                                getStatusKey(debt.status) === "AL_DIA" ? "bg-emerald-100" :
                                getStatusKey(debt.status) === "ATRASADA" ? "bg-amber-100" : "bg-red-100"
                              }`}
                            >
                              {getStatusKey(debt.status) === "AL_DIA" ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                              )}
                            </motion.div>
                            <div>
                              <div className="font-semibold text-slate-800">{debt.name || debt.creditorName}</div>
                              <div className="text-xs text-slate-500">
                                {debt.interestRate ? `${debt.interestRate}% interés` : 'Sin interés'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-800">
                              ${(debt.balance || debt.totalAmount || debt.amount || 0).toLocaleString('es-DO')}
                            </div>
                            <Badge variant="secondary" className={`text-xs mt-1 ${
                              getStatusKey(debt.status) === "AL_DIA" ? "bg-emerald-100 text-emerald-700" :
                              getStatusKey(debt.status) === "ATRASADA" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            }`}>
                              {STATUS_LABELS[debt.status] || STATUS_LABELS[getStatusKey(debt.status)]}
                            </Badge>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
