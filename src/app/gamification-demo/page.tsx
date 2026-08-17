"use client";

import { useState } from "react";
import { BattleMode } from "@/components/gamification/battle-mode";
import { AchievementCard } from "@/components/gamification/achievement-card";
import { motion } from "framer-motion";
import { Gamepad2, Trophy } from "lucide-react";

// Datos de ejemplo (simulados)
const MOCK_DEBTS = [
  { id: "1", name: "Tarjeta Banco Popular", balance: 45000, type: "CREDIT_CARD" },
  { id: "2", name: "Préstamo Personal", balance: 120000, type: "PERSONAL" },
  { id: "3", name: "Compra La Sirena", balance: 15000, type: "CREDIT_CARD" },
];

export default function GamificationDemoPage() {
  const [totalPaid, setTotalPaid] = useState(0);
  const [defeatedCount, setDefeatedCount] = useState(0);

  const handleDebtPaid = (id: string, amount: number) => {
    setTotalPaid(prev => prev + amount);
    setDefeatedCount(prev => prev + 1);
  };

  const getRank = (count: number) => {
    if (count >= 10) return "Legendario";
    if (count >= 5) return "Épico";
    if (count >= 2) return "Raro";
    return "Novato";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-900 to-slate-950 pt-20 pb-32">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Gamepad2 className="w-20 h-20 mx-auto mb-6 text-purple-400" />
            <h1 className="text-5xl md:text-7xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
              Modo Batalla
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Transforma tus deudas en monstruos épicos. Atácalas con cada pago y conviértete en un héroe financiero.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-20 relative z-20 space-y-20">
        
        {/* Sección 1: Batalla */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">
              ⚔️ Tus Enemigos
            </h2>
            <p className="text-slate-400">
              Haz clic en "Atacar" para simular un pago y reducir la salud de la deuda.
            </p>
          </div>
          <BattleMode debts={MOCK_DEBTS} onDebtPaid={handleDebtPaid} />
        </section>

        {/* Sección 2: Logros */}
        <section className="border-t border-slate-800 pt-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">
              🏆 Tus Logros
            </h2>
            <p className="text-slate-400">
              Comparte tu progreso con el mundo y motiva a otros.
            </p>
          </div>
          <AchievementCard
            userName="Juan Pérez"
            totalPaid={totalPaid}
            debtsDefeated={defeatedCount}
            rank={getRank(defeatedCount)}
          />
        </section>

      </div>
    </div>
  );
}
