import { Sparkles } from 'lucide-react';

interface HealthBarProps {
  hp: number;
  maxHp: number;
}

export function HealthBar({ hp, maxHp }: HealthBarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Decorative HUD Element */}
      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-stone-600 bg-stone-900/80 shadow-[0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-sm relative">
        <Sparkles className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
        <div className="absolute -inset-1 border border-yellow-500/30 rounded-full animate-pulse"></div>
      </div>
      
      {/* Health Points */}
      <div className="flex gap-1.5 p-2 bg-stone-900/60 backdrop-blur-sm rounded-r-2xl border-y-2 border-r-2 border-stone-800 shadow-xl">
        {Array.from({ length: maxHp }).map((_, i) => (
          <div key={i} className="relative w-6 h-8">
             <div className="absolute inset-0 bg-stone-800 transform -skew-x-12 rounded-sm border border-stone-700 shadow-inner"></div>
             <div 
               className={`absolute inset-0 transform -skew-x-12 rounded-sm border transition-all duration-500 ${
                 i < hp 
                   ? 'bg-gradient-to-b from-blue-400 to-blue-600 border-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.8)]' 
                   : 'bg-transparent border-transparent opacity-0'
               }`}
             />
             {/* Inner highlight for full health */}
             {i < hp && (
                 <div className="absolute inset-0 w-full h-1/3 bg-gradient-to-b from-white/40 to-transparent transform -skew-x-12 rounded-t-sm"></div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
