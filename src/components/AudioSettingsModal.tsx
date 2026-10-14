import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Volume1, VolumeX, Music, Sparkles, X, RotateCcw, Home, Play, Tv } from 'lucide-react';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bgmVolume: number;
  onBgmVolumeChange: (vol: number) => void;
  sfxVolume: number;
  onSfxVolumeChange: (vol: number) => void;
  retroMode?: boolean;
  onToggleRetroMode?: () => void;
  inGame?: boolean;
  onRestartGame?: () => void;
  onExitToMenu?: () => void;
}

export function AudioSettingsModal({
  isOpen,
  onClose,
  bgmVolume,
  onBgmVolumeChange,
  sfxVolume,
  onSfxVolumeChange,
  retroMode = false,
  onToggleRetroMode,
  inGame = false,
  onRestartGame,
  onExitToMenu
}: AudioSettingsModalProps) {
  const prevBgmRef = useRef(bgmVolume > 0 ? bgmVolume : 0.6);
  const prevSfxRef = useRef(sfxVolume > 0 ? sfxVolume : 0.7);

  // Play quick sample SFX when testing
  const playSampleSfx = (volume: number) => {
    if (volume <= 0) return;
    try {
      const audio = new Audio('/attacksound_1.mp3');
      audio.volume = Math.max(0, Math.min(1, volume * 0.6));
      audio.play().catch(() => {
        // Fallback synthesizer
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      });
    } catch (e) {
      console.log('Audio test error:', e);
    }
  };

  const toggleBgmMute = () => {
    if (bgmVolume > 0) {
      prevBgmRef.current = bgmVolume;
      onBgmVolumeChange(0);
    } else {
      onBgmVolumeChange(prevBgmRef.current > 0 ? prevBgmRef.current : 0.6);
    }
  };

  const toggleSfxMute = () => {
    if (sfxVolume > 0) {
      prevSfxRef.current = sfxVolume;
      onSfxVolumeChange(0);
    } else {
      const restored = prevSfxRef.current > 0 ? prevSfxRef.current : 0.7;
      onSfxVolumeChange(restored);
      playSampleSfx(restored);
    }
  };

  // Keyboard shortcut: close with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-gradient-to-b from-stone-900 via-stone-950 to-stone-950 border-2 border-yellow-600/50 rounded-2xl shadow-[0_0_50px_rgba(202,138,4,0.25)] p-6 md:p-8 font-serif text-stone-200 overflow-hidden"
          >
            {/* Ornate corner accents */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-yellow-400 pointer-events-none" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-yellow-400 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-yellow-400 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-yellow-400 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-600 uppercase">
                    {inGame ? 'Pausa & Configurações' : 'Configurações de Áudio'}
                  </h2>
                  <p className="text-xs text-stone-400 tracking-wider">
                    {inGame ? 'Ajuste os volumes ou retome sua batalha' : 'Personalize o som e a música do jogo'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-100 flex items-center justify-center transition-all border border-stone-700/60 active:scale-95"
                title="Fechar [ESC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="py-6 space-y-6">
              {/* Background Music Volume Slider */}
              <div className="bg-stone-950/70 p-4 rounded-xl border border-stone-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={toggleBgmMute}
                      className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-700 text-yellow-400 hover:text-yellow-300 transition-colors border border-yellow-500/20"
                      title={bgmVolume === 0 ? 'Desmutar Música' : 'Mutar Música'}
                    >
                      {bgmVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : bgmVolume < 0.5 ? (
                        <Volume1 className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <span className="text-sm font-bold tracking-wider text-stone-200 uppercase flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-yellow-500" />
                        Música de Fundo (BGM)
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        Trilha sonora do menu e das arenas
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-md bg-stone-900 border border-stone-700 text-yellow-300">
                    {Math.round(bgmVolume * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={bgmVolume}
                    onChange={(e) => onBgmVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400 transition-all focus:outline-none"
                  />
                </div>
              </div>

              {/* Sound Effects Volume Slider */}
              <div className="bg-stone-950/70 p-4 rounded-xl border border-stone-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={toggleSfxMute}
                      className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-700 text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/20"
                      title={sfxVolume === 0 ? 'Desmutar Efeitos' : 'Mutar Efeitos'}
                    >
                      {sfxVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : sfxVolume < 0.5 ? (
                        <Volume1 className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <span className="text-sm font-bold tracking-wider text-stone-200 uppercase flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Efeitos Sonoros (SFX)
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        Golpes, impactos, magias, esquivas e passos
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playSampleSfx(sfxVolume)}
                      className="px-2.5 py-1 text-[11px] rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 border border-stone-700 hover:border-amber-500/40 uppercase tracking-wider font-bold transition-all"
                    >
                      Testar
                    </button>
                    <span className="font-mono text-sm font-black px-2.5 py-0.5 rounded-md bg-stone-900 border border-stone-700 text-amber-300">
                      {Math.round(sfxVolume * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sfxVolume}
                    onChange={(e) => {
                      const newVol = parseFloat(e.target.value);
                      onSfxVolumeChange(newVol);
                    }}
                    onMouseUp={() => playSampleSfx(sfxVolume)}
                    onTouchEnd={() => playSampleSfx(sfxVolume)}
                    className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all focus:outline-none"
                  />
                </div>
              </div>

              {/* Extra settings: Retro Mode toggle */}
              {onToggleRetroMode && (
                <div className="bg-stone-950/70 p-4 rounded-xl border border-stone-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-stone-800/80 flex items-center justify-center text-stone-300 border border-stone-700">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold tracking-wider text-stone-200 uppercase block">
                        Modo 16-Bits
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        Filtro pixelado CRT nostálgico
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onToggleRetroMode}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase border transition-all ${
                      retroMode
                        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/60 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                        : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    {retroMode ? 'Ativado' : 'Desativado'}
                  </button>
                </div>
              )}

              {/* Controls Quick Hint */}
              <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-900 text-[11px] text-stone-500 flex items-center justify-between">
                <span>Dica: Pressione <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px] border border-stone-700">ESC</kbd> durante a partida para abrir esta tela.</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-stone-800 flex flex-wrap gap-3 justify-end items-center">
              {inGame ? (
                <>
                  {onExitToMenu && (
                    <button
                      onClick={onExitToMenu}
                      className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-bold uppercase tracking-wider rounded-xl border border-stone-800 hover:border-stone-700 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Home className="w-4 h-4" />
                      Menu Principal
                    </button>
                  )}

                  {onRestartGame && (
                    <button
                      onClick={onRestartGame}
                      className="px-4 py-2.5 bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-bold uppercase tracking-wider rounded-xl border border-stone-700 flex items-center gap-2 transition-all active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reiniciar
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-stone-950 text-xs font-black uppercase tracking-widest rounded-xl border border-yellow-400/80 shadow-[0_0_20px_rgba(202,138,4,0.3)] flex items-center gap-2 transition-all active:scale-95 ml-auto"
                  >
                    <Play className="w-4 h-4 fill-stone-950" />
                    Continuar
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-stone-950 text-xs font-black uppercase tracking-widest rounded-xl border border-yellow-400/80 shadow-[0_0_20px_rgba(202,138,4,0.3)] flex items-center gap-2 transition-all active:scale-95"
                >
                  Concluir
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
