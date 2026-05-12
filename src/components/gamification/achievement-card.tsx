"use client";

import { motion } from "framer-motion";
import { Trophy, Star, Download, Share2 } from "lucide-react";
import { useRef } from "react";
import htmlToImage from 'html-to-image';

interface AchievementCardProps {
  userName: string;
  totalPaid: number;
  debtsDefeated: number;
  rank: string;
}

export function AchievementCard({ userName, totalPaid, debtsDefeated, rank }: AchievementCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, { quality: 1.0 });
      const link = document.createElement('a');
      link.download = `logro-deuda-clara-${userName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al generar imagen:', err);
    }
  };

  const getRankIcon = (r: string) => {
    if (r.includes('Legendario')) return '👑';
    if (r.includes('Épico')) return '💎';
    if (r.includes('Raro')) return '⭐';
    return '🛡️';
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Tarjeta Visual */}
      <motion.div 
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative p-8 text-white">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-black mb-1">Deuda Clara RD</h3>
              <p className="text-purple-200 text-sm">Certificado de Logro</p>
            </div>
            <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-lg" />
          </div>

          {/* Contenido Principal */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{getRankIcon(rank)}</div>
            <h2 className="text-3xl font-bold mb-2">¡Felicidades, {userName}!</h2>
            <p className="text-purple-100">Has alcanzado el rango</p>
            <div className="text-4xl font-black text-yellow-400 my-4 drop-shadow-md">
              {rank}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-300 mb-1">
                {debtsDefeated}
              </div>
              <div className="text-xs text-purple-200 uppercase tracking-wider">
                Deudas Derrotadas
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold text-green-300 mb-1">
                RD$ {totalPaid.toLocaleString()}
              </div>
              <div className="text-xs text-purple-200 uppercase tracking-wider">
                Pagado Total
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-purple-300 pt-4 border-t border-white/10">
            Generado el {new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}
            <br />
            #DeudaClaraRD #LibertadFinanciera
          </div>
        </div>
      </motion.div>

      {/* Botones de Acción */}
      <div className="flex gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={downloadImage}
          className="px-6 py-3 bg-white text-indigo-900 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Download className="w-5 h-5" />
          Guardar Imagen
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Share2 className="w-5 h-5" />
          Compartir
        </motion.button>
      </div>
    </div>
  );
}
