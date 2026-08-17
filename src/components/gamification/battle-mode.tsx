"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sword, Shield, Heart, Trophy } from "lucide-react";
import { useState } from "react";
import confetti from "canvas-confetti";

interface DebtMonster {
  id: string;
  name: string;
  amount: number;
  maxHealth: number;
  currentHealth: number;
  level: number;
  type: string;
}

interface BattleModeProps {
  debts: any[];
  onDebtPaid?: (id: string, amount: number) => void;
}

export function BattleMode({ debts, onDebtPaid }: BattleModeProps) {
  const [monsters, setMonsters] = useState<DebtMonster[]>(() => 
    debts.map((d, i) => ({
      id: d.id,
      name: d.name,
      amount: d.balance || d.amount || 0,
      maxHealth: 100 + (i * 20),
      currentHealth: 100 + (i * 20),
      level: Math.floor((d.balance || d.amount || 0) / 10000) + 1,
      type: d.type || "generic"
    }))
  );

  const handleAttack = (monsterId: string, damage: number) => {
    setMonsters(prev => prev.map(m => {
      if (m.id !== monsterId) return m;
      
      const newHealth = Math.max(0, m.currentHealth - damage);
      const isDefeated = newHealth === 0;

      if (isDefeated) {
        // Efecto de victoria
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
        });
        
        if (onDebtPaid) onDebtPaid(m.id, m.amount);
      } else {
        // Efecto de golpe pequeño
        confetti({
          particleCount: 30,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#FF6B6B']
        });
      }

      return { ...m, currentHealth: newHealth };
    }));
  };

  const getMonsterEmoji = (type: string) => {
    switch(type) {
      case 'CREDIT_CARD': return '👹';
      case 'PERSONAL': return '👻';
      case 'MORTGAGE': return '🐉';
      case 'STUDENT': return '🧛';
      default: return '👾';
    }
  };

  const getMonsterColor = (healthPercent: number) => {
    if (healthPercent > 60) return 'from-red-600 to-orange-600';
    if (healthPercent > 30) return 'from-orange-600 to-yellow-600';
    return 'from-green-600 to-emerald-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      <AnimatePresence>
        {monsters.map((monster, index) => {
          const healthPercent = (monster.currentHealth / monster.maxHealth) * 100;
          const isDefeated = monster.currentHealth === 0;

          if (isDefeated) return null;

          return (
            <motion.div
              key={monster.id}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0, rotate: 180 }}
              transition={{ delay: index * 0.1, type: "spring" }}
              className="relative group"
            >
              {/* Carta del Monstruo */}
              <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${getMonsterColor(healthPercent)} p-1 shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,107,107,0.5)]`}>
                <div className="bg-slate-900/95 backdrop-blur-sm rounded-[22px] p-6 h-full">
                  
                  {/* Header con Nivel */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-yellow-400 bg-yellow-400/20 px-3 py-1 rounded-full border border-yellow-400/30">
                      NIVEL {monster.level}
                    </span>
                    <Heart className={`w-5 h-5 ${healthPercent < 30 ? 'text-red-500 animate-pulse' : 'text-pink-500'}`} />
                  </div>

                  {/* Avatar del Monstruo */}
                  <div className="text-center mb-6">
                    <motion.div 
                      className="text-7xl mb-2 inline-block"
                      animate={{ 
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      {getMonsterEmoji(monster.type)}
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-1">{monster.name}</h3>
                    <p className="text-slate-400 text-sm">Deuda: RD$ {monster.amount.toLocaleString()}</p>
                  </div>

                  {/* Barra de Vida */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      <span>SALUD</span>
                      <span>{Math.round(healthPercent)}%</span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <motion.div 
                        className={`h-full bg-gradient-to-r ${getMonsterColor(healthPercent)}`}
                        initial={{ width: '100%' }}
                        animate={{ width: `${healthPercent}%` }}
                        transition={{ type: "spring", bounce: 0.3 }}
                      />
                    </div>
                  </div>

                  {/* Botón de Ataque */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAttack(monster.id, 20)}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 group-hover:shadow-red-500/50 transition-all text-lg"
                  >
                    <Sword className="w-6 h-6" />
                    <span>ATACAR (-RD$20)</span>
                  </motion.button>

                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {monsters.every(m => m.currentHealth === 0) && (
        <div className="col-span-full text-center py-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
          >
            <Trophy className="w-32 h-32 mx-auto text-yellow-400 mb-6 drop-shadow-[0_0_30px_rgba(255,215,0,0.5)]" />
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">
              ¡VICTORIA TOTAL!
            </h2>
            <p className="text-xl text-slate-300">Has derrotado a todos los monstruos de deuda.</p>
            <p className="text-slate-400 mt-2">¡Eres un héroe financiero! 🎉</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
