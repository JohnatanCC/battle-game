/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HealthBar } from './components/HealthBar';
import { ShieldAlert, Sword, Sparkles, Volume2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BGMPlayer } from './game/BGMPlayer';
import { AudioSettingsModal } from './components/AudioSettingsModal';


export default function App() {
  const [playerHp, setPlayerHp] = useState(8);
  const [enemyHp, setEnemyHp] = useState(750);
  const [enemyMaxHp, setEnemyMaxHp] = useState(750);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameMode, setGameMode] = useState<'devastated_path' | 'battle' | null>(null);
  const [menuView, setMenuView] = useState<'main' | 'stage_selection'>('main');
  const [retroMode, setRetroMode] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<'knight' | 'witch'>('knight');
  const [gameId, setGameId] = useState(0);
  const [vitalCharges, setVitalCharges] = useState(0);
  const bgmRef = useRef<BGMPlayer | null>(null);
  const menuMusicRef = useRef<HTMLAudioElement | null>(null);
  const [bossFightStarted, setBossFightStarted] = useState(false);

  // Audio Volume State & Persistence
  const [bgmVolume, setBgmVolume] = useState<number>(() => {
    const saved = localStorage.getItem('angel_knight_bgm_volume');
    return saved !== null ? Math.max(0, Math.min(1, parseFloat(saved))) : 0.6;
  });
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const saved = localStorage.getItem('angel_knight_sfx_volume');
    return saved !== null ? Math.max(0, Math.min(1, parseFloat(saved))) : 0.7;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleBgmVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setBgmVolume(clamped);
    localStorage.setItem('angel_knight_bgm_volume', clamped.toString());
    if (menuMusicRef.current) {
      menuMusicRef.current.volume = clamped;
    }
    if (bgmRef.current) {
      bgmRef.current.setVolume(clamped);
    }
  };

  const handleSfxVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setSfxVolume(clamped);
    localStorage.setItem('angel_knight_sfx_volume', clamped.toString());
  };

  useEffect(() => {
    if (!menuMusicRef.current) {
      menuMusicRef.current = new Audio('/menu_music.ogg');
      menuMusicRef.current.loop = true;
      menuMusicRef.current.volume = bgmVolume;
    } else {
      menuMusicRef.current.volume = bgmVolume;
    }

    const startMenuMusic = () => {
      if (menuMusicRef.current && !bossFightStarted && gameMode === null) {
        menuMusicRef.current.play().catch(e => console.log('Autoplay prevented', e));
      }
    };

    document.addEventListener('click', startMenuMusic, { once: true });
    
    return () => {
      document.removeEventListener('click', startMenuMusic);
    };
  }, [bossFightStarted, gameMode, bgmVolume]);

  useEffect(() => {
    if (bossFightStarted) {
      if (menuMusicRef.current) {
        menuMusicRef.current.pause();
        menuMusicRef.current.currentTime = 0;
      }
    } else {
      if (menuMusicRef.current) {
        menuMusicRef.current.play().catch(e => console.log('Autoplay prevented', e));
      }
    }
  }, [bossFightStarted]);

  // Global ESC key listener to toggle pause/settings
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isGameOver) return;
        setIsSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isGameOver]);

  useEffect(() => {
    if (isGameOver && bgmRef.current) {
        bgmRef.current.stop();
    }
  }, [isGameOver, enemyHp]);

  const resetGame = () => {
    setPlayerHp(selectedCharacter === 'knight' ? 8 : 6);
    setEnemyHp(gameMode === 'battle' ? 750 : 0);
    setEnemyMaxHp(750);
    setVitalCharges(0);
    setIsGameOver(false);
    setIsSettingsOpen(false);
    setGameId(prev => prev + 1);
    if (bgmRef.current) {
        bgmRef.current.stop();
        bgmRef.current.play();
    }
  };

  const exitToMenu = () => {
    if (bgmRef.current) {
      bgmRef.current.stop();
      bgmRef.current = null;
    }
    setGameMode(null);
    setMenuView('main');
    setBossFightStarted(false);
    setIsGameOver(false);
    setIsSettingsOpen(false);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-stone-950 font-serif text-stone-300 relative">
      
      <AnimatePresence>
      {/* Start Menu Overlay */}
      {gameMode === null && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#0a1128] overflow-hidden"
        >
          {/* Deep blue sky with golden glow from bottom center */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_center,rgba(250,204,21,0.4)_0%,rgba(10,17,40,1)_70%)]" />

          {/* Animated Particles (Light specs) */}
          {[...Array(60)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-200 rounded-full blur-[1px]"
              initial={{ 
                x: (Math.random() * window.innerWidth) - (window.innerWidth / 2),
                y: window.innerHeight / 2 + Math.random() * 200,
                opacity: 0,
                scale: Math.random() * 2 + 0.5
              }}
              animate={{ 
                y: -window.innerHeight / 2 - 100,
                opacity: [0, 1, 0],
                x: (Math.random() * window.innerWidth) - (window.innerWidth / 2) + (Math.random() - 0.5) * 200
              }}
              transition={{ 
                duration: Math.random() * 8 + 4,
                repeat: Infinity,
                ease: 'easeOut',
                delay: Math.random() * 5
              }}
            />
          ))}

          {/* Volumetric Golden Clouds on the sides */}
          {/* Left Side */}
          <div className="absolute top-[-10%] bottom-[-10%] -left-32 w-[500px] pointer-events-none opacity-90 z-0">
            {[
              { size: 450, top: '0%', left: '-20%' },
              { size: 500, top: '15%', left: '-10%' },
              { size: 650, top: '30%', left: '-25%' },
              { size: 550, top: '55%', left: '-15%' },
              { size: 600, top: '70%', left: '-30%' },
            ].map((cloud, i) => (
              <div key={i} className="absolute aspect-square" style={{ width: cloud.size, top: cloud.top, left: cloud.left }}>
                <div className="absolute inset-0 bg-amber-700/40 rounded-full blur-[60px] mix-blend-screen translate-x-4 translate-y-4" />
                <div className="absolute inset-8 bg-yellow-500/50 rounded-full blur-[10px] mix-blend-screen -translate-x-2 -translate-y-2" />
                <div className="absolute inset-16 bg-yellow-200/40 rounded-full blur-[16px] mix-blend-screen" />
                <div className="absolute inset-24 bg-white/20 rounded-full blur-[10px] mix-blend-overlay" />
              </div>
            ))}
          </div>

          {/* Right Side */}
          <div className="absolute top-[-10%] bottom-[-10%] -right-32 w-[500px] pointer-events-none opacity-90 z-0">
            {[
              { size: 450, top: '0%', right: '-20%' },
              { size: 500, top: '15%', right: '-10%' },
              { size: 650, top: '30%', right: '-25%' },
              { size: 550, top: '55%', right: '-15%' },
              { size: 600, top: '70%', right: '-30%' },
            ].map((cloud, i) => (
              <div key={i} className="absolute aspect-square" style={{ width: cloud.size, top: cloud.top, right: cloud.right }}>
                <div className="absolute inset-0 bg-amber-700/40 rounded-full blur-[60px] mix-blend-screen -translate-x-4 translate-y-4" />
                <div className="absolute inset-8 bg-yellow-500/50 rounded-full blur-[10px] mix-blend-screen translate-x-2 -translate-y-2" />
                <div className="absolute inset-16 bg-yellow-200/40 rounded-full blur-[16px] mix-blend-screen" />
                <div className="absolute inset-24 bg-white/20 rounded-full blur-[10px] mix-blend-overlay" />
              </div>
            ))}
          </div>

          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

          {/* Foreground Clouds (in front of blur) */}
          {/* Left Foreground Clouds */}
          <div className="absolute top-[10%] bottom-[-10%] -left-16 w-[300px] pointer-events-none opacity-100 z-10">
            {[
              { size: 350, top: '10%', left: '-25%' },
              { size: 400, top: '40%', left: '-10%' },
              { size: 450, top: '75%', left: '-20%' },
            ].map((cloud, i) => (
              <div key={i} className="absolute aspect-square" style={{ width: cloud.size, top: cloud.top, left: cloud.left }}>
                <div className="absolute inset-0 bg-amber-600/60 rounded-full blur-[10px] mix-blend-screen translate-x-4 translate-y-4" />
                <div className="absolute inset-8 bg-yellow-400/70 rounded-full blur-[16px] mix-blend-screen -translate-x-2 -translate-y-2" />
                <div className="absolute inset-16 bg-yellow-100/60 rounded-full blur-[10px] mix-blend-screen" />
                <div className="absolute inset-24 bg-white/40 rounded-full blur-[10px] mix-blend-overlay" />
              </div>
            ))}
          </div>

          {/* Right Foreground Clouds */}
          <div className="absolute top-[10%] bottom-[-10%] -right-16 w-[300px] pointer-events-none opacity-100 z-10">
            {[
              { size: 350, top: '10%', right: '-25%' },
              { size: 400, top: '40%', right: '-10%' },
              { size: 450, top: '75%', right: '-20%' },
            ].map((cloud, i) => (
              <div key={i} className="absolute aspect-square" style={{ width: cloud.size, top: cloud.top, right: cloud.right }}>
                <div className="absolute inset-0 bg-amber-600/60 rounded-full blur-[10px] mix-blend-screen -translate-x-4 translate-y-4" />
                <div className="absolute inset-8 bg-yellow-400/70 rounded-full blur-[16px] mix-blend-screen translate-x-2 -translate-y-2" />
                <div className="absolute inset-16 bg-yellow-100/60 rounded-full blur-[10px] mix-blend-screen" />
                <div className="absolute inset-24 bg-white/40 rounded-full blur-[10px] mix-blend-overlay" />
              </div>
            ))}
          </div>

           <motion.div 
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 1.5, delay: 0.5 }}
             className="max-w-4xl w-full flex flex-col items-center gap-16 relative z-10"
           >
             {/* Header */}
             <div className="text-center">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ duration: 2, ease: "easeOut" }}
                 className="relative"
               >
                 <h1 className="text-6xl md:text-8xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-yellow-600 drop-shadow-[0_0_30px_rgba(250,204,21,0.4)] flex items-center justify-center gap-6 uppercase">
                   Angel Knight
                 </h1>
               </motion.div>
             </div>

             {menuView === 'main' ? (
               <div className="flex gap-4">
                 <motion.button 
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   onClick={(e) => {
                     e.stopPropagation();
                     setMenuView('stage_selection');
                   }}
                   className="px-12 py-6 bg-gradient-to-b from-yellow-600 to-yellow-900 hover:from-yellow-500 hover:to-yellow-800 text-yellow-50 font-bold rounded-2xl border border-yellow-400/50 transition-all shadow-[0_0_40px_rgba(234,179,8,0.3)] flex items-center gap-4 text-2xl tracking-[0.2em] uppercase overflow-hidden relative group/btn"
                 >
                   <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover/btn:animate-[shine_1.5s_ease-in-out_infinite]" />
                   Batalhar
                 </motion.button>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-4">
                 <div className="flex gap-4">
                   <motion.button 
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={(e) => {
                       e.stopPropagation();
                       setGameMode('devastated_path');
                       menuMusicRef.current?.pause();
                       if (bgmRef.current) bgmRef.current.stop();
                       bgmRef.current = new BGMPlayer('/tutorial.mp3', bgmVolume);
                       setBossFightStarted(true);
                       bgmRef.current.play();
                     }}
                     className="px-8 py-5 bg-gradient-to-b from-stone-600 to-stone-900 hover:from-stone-500 hover:to-stone-800 text-stone-50 font-bold rounded-2xl border border-stone-400/50 transition-all shadow-[0_0_20px_rgba(120,113,108,0.3)] flex items-center gap-3 text-xl tracking-[0.1em] uppercase overflow-hidden relative group/btn"
                   >
                     Caminho Devastado
                   </motion.button>
                   <motion.button 
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     onClick={(e) => {
                       e.stopPropagation();
                       setGameMode('battle');
                       menuMusicRef.current?.pause();
                       if (bgmRef.current) bgmRef.current.stop();
                       bgmRef.current = new BGMPlayer('/game_music.mp3', bgmVolume); setBossFightStarted(true); bgmRef.current.play();
                     }}
                     className="px-8 py-5 bg-gradient-to-b from-red-800 to-stone-900 hover:from-red-700 hover:to-stone-800 text-red-100 font-bold rounded-2xl border border-red-500/50 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-3 text-xl tracking-[0.1em] uppercase overflow-hidden relative group/btn"
                   >
                     Destino Final
                   </motion.button>
                 </div>
                 <motion.button
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                   onClick={(e) => { e.stopPropagation(); setMenuView('main'); }}
                   className="mt-2 text-stone-400 hover:text-stone-200 uppercase tracking-widest text-sm font-bold transition-colors"
                 >
                   Voltar
                 </motion.button>
               </div>
             )}
            <div className="flex gap-6 mt-6 w-full justify-center max-w-3xl px-4 z-20">
              {/* Knight Card */}
              <div 
                  onClick={() => setSelectedCharacter('knight')}
                  className={`flex-1 relative cursor-pointer overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                      selectedCharacter === 'knight' 
                          ? 'border-yellow-400 bg-stone-900/90 shadow-[0_0_30px_rgba(234,179,8,0.4)] scale-105 z-10' 
                          : 'border-stone-700 bg-stone-950/70 hover:bg-stone-900/80 hover:border-stone-500 scale-100 opacity-70 hover:opacity-100'
                  }`}
              >
                  <div className="p-5 flex flex-col items-center h-full">
                      <div className="w-20 h-20 mb-2 relative flex items-center justify-center">
                           <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse"></div>
                           <svg viewBox="0 0 100 100" className="w-16 h-16 relative z-10 drop-shadow-2xl">
                               <path d="M 40 80 L 30 20 L 70 20 L 60 80 Z" fill="#1e3a8a" />
                               <path d="M 35 20 Q 50 10 65 20 L 70 50 Q 50 60 30 50 Z" fill="#fbbf24" />
                               <rect x="40" y="25" width="20" height="30" fill="#020617" rx="10" />
                               <circle cx="50" cy="35" r="4" fill="#fef08a" />
                               <path d="M 45 35 Q 50 30 55 35 Q 50 40 45 35" fill="#ffffff" />
                           </svg>
                      </div>
                      
                      <h3 className="text-xl md:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-600 mb-1 uppercase">The Knight</h3>
                      <p className="text-stone-400 text-[11px] md:text-xs mb-4 text-center h-8">O guerreiro divino da coroa dourada.</p>
                      
                      <div className="w-full space-y-2.5 text-left">
                          <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">Vida</span>
                                  <span className="text-red-400 font-bold">8 HP</span>
                              </div>
                              <div className="flex gap-1">
                                   {[...Array(8)].map((_, i) => <div key={i} className="w-full h-1.5 bg-red-500 rounded-full"></div>)}
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                                  <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Ataque (Botão Esq)</span>
                                  <span className="text-stone-300 font-bold text-sm leading-none block">Espada Sagrada</span>
                                  <p className="text-stone-500 text-xs leading-tight mt-1">Ataque rápido e cortante.</p>
                              </div>
                              <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                                  <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Defesa (Botão Dir)</span>
                                  <span className="text-cyan-400 font-bold text-sm leading-none block">Escudo de Luz</span>
                                  <p className="text-stone-500 text-xs leading-tight mt-1">Reflete magia e recarrega cura.</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Witch Card */}
              <div 
                  onClick={() => setSelectedCharacter('witch')}
                  className={`flex-1 relative cursor-pointer overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
                      selectedCharacter === 'witch' 
                          ? 'border-purple-500 bg-stone-900/90 shadow-[0_0_30px_rgba(168,85,247,0.4)] scale-105 z-10' 
                          : 'border-stone-700 bg-stone-950/70 hover:bg-stone-900/80 hover:border-stone-500 scale-100 opacity-70 hover:opacity-100'
                  }`}
              >
                  <div className="p-5 flex flex-col items-center h-full">
                      <div className="w-20 h-20 mb-2 relative flex items-center justify-center">
                           <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl animate-pulse"></div>
                           <svg viewBox="0 0 100 100" className="w-16 h-16 relative z-10 drop-shadow-2xl">
                               <circle cx="50" cy="50" r="35" fill="#dc2626" />
                               <path d="M 30 80 L 40 20 Q 50 10 60 20 L 70 80 Z" fill="#0a0a0a" stroke="#dc2626" strokeWidth="2" />
                               <circle cx="50" cy="30" r="18" fill="#171717" />
                               <circle cx="55" cy="32" r="10" fill="#6b7280" />
                               <circle cx="58" cy="30" r="3" fill="#a855f7" />
                               <path d="M 75 80 L 85 20 L 90 20 L 80 80 Z" fill="#7c2d12" />
                               <circle cx="87" cy="18" r="8" fill="#9333ea" />
                           </svg>
                      </div>
                      
                      <h3 className="text-xl md:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-purple-600 mb-1 uppercase">The Witch</h3>
                      <p className="text-stone-400 text-[11px] md:text-xs mb-4 text-center h-8">Mestra arcana, tecelã do vazio.</p>
                      
                      <div className="w-full space-y-2.5 text-left">
                          <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                              <div className="flex justify-between items-center mb-1">
                                  <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">Vida</span>
                                  <span className="text-red-400 font-bold">6 HP</span>
                              </div>
                              <div className="flex gap-1 w-[75%]">
                                   {[...Array(6)].map((_, i) => <div key={i} className="w-full h-1.5 bg-red-500 rounded-full"></div>)}
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                                  <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Magia (Botão Esq)</span>
                                  <span className="text-purple-400 font-bold text-sm leading-none block">Cajado Rúnico</span>
                                  <p className="text-stone-500 text-xs leading-tight mt-1">Disparos arcanos. Frenesi a cada 10 tiros.</p>
                              </div>
                              <div className="bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/50">
                                  <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Especial (Botão Dir)</span>
                                  <span className="text-fuchsia-500 font-bold text-sm leading-none block">Explosão do Vazio</span>
                                  <p className="text-stone-500 text-xs leading-tight mt-1">Quebra magia em área e cura a própria vida.</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
            </div>

              <div className="flex flex-wrap gap-4 items-center justify-center mt-2 z-20">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRetroMode(!retroMode)}
                  className="px-6 py-2.5 bg-stone-900/80 hover:bg-stone-800 text-stone-300 font-bold rounded-xl border border-stone-700 transition-all shadow-lg flex items-center gap-2 tracking-widest uppercase text-xs"
                >
                  Modo 16-Bits: {retroMode ? 'ON' : 'OFF'}
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-6 py-2.5 bg-stone-900/90 hover:bg-yellow-950/60 text-yellow-300 font-bold rounded-xl border border-yellow-600/50 hover:border-yellow-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center gap-2.5 tracking-widest uppercase text-xs"
                >
                  <Volume2 className="w-4 h-4 text-yellow-400" />
                  Configurações de Áudio
                </motion.button>
              </div>
            </motion.div>

          {/* Top-Right Quick Audio Button in Menu */}
          <div className="absolute top-6 right-6 z-30">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-stone-950/70 hover:bg-stone-900 text-yellow-300 border border-yellow-500/30 hover:border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)] backdrop-blur-md flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all active:scale-95 group"
              title="Configurações de Áudio"
            >
              <Volume2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Áudio</span>
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      
      {retroMode && (
        <div 
          className="fixed inset-0 pointer-events-none z-[100]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='2' height='2' fill='rgba(0,0,0,0.25)'/%3E%3Crect x='2' y='2' width='2' height='2' fill='rgba(0,0,0,0.25)'/%3E%3Crect x='0' y='2' width='2' height='2' fill='rgba(255,255,255,0.05)'/%3E%3Crect x='2' y='0' width='2' height='2' fill='rgba(255,255,255,0.05)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '4px 4px',
            mixBlendMode: 'overlay',
            opacity: 0.8
          }}
        />
      )}
      {/* Game Area */}
      {gameMode !== null && (
        <div className="absolute inset-0 z-0">
          
          {/* In-game Pause & Audio Options Button */}
          <div className="absolute top-6 right-6 z-30 pointer-events-auto">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-stone-950/85 hover:bg-stone-900 text-stone-200 hover:text-yellow-300 border border-stone-700/80 hover:border-yellow-500/50 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 group"
              title="Configurações e Pausa [ESC]"
            >
              <Volume2 className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Opções</span>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] text-stone-400 border border-stone-700 font-mono">ESC</kbd>
            </button>
          </div>

          {/* Player UI */}
          <div className="absolute top-6 left-6 flex flex-col gap-3 z-10 pointer-events-none">
            <HealthBar hp={playerHp} maxHp={selectedCharacter === 'knight' ? 8 : 6} />
            
            {/* Vital Charges */}
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                    i < vitalCharges 
                      ? 'bg-purple-500 border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.8)]' 
                      : 'bg-transparent border-stone-600'
                  }`}
                />
              ))}
            </div>
          </div>
          
          {/* Enemy Health Bar UI overlay */}
          <div className="absolute top-8 right-1/2 translate-x-1/2 flex flex-col items-center gap-3 opacity-90 z-10 pointer-events-none w-full max-w-2xl px-8">
            <div className="flex items-center justify-between w-full relative">
                {/* Decorative End Caps */}
                <div className="w-4 h-8 bg-gradient-to-b from-yellow-500 to-yellow-700 rounded-l-md border-2 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] z-20"></div>
                
                {/* Health Bar Container */}
                <div className="flex-1 h-6 bg-stone-900/80 backdrop-blur-md overflow-hidden border-y-2 border-stone-700 relative shadow-2xl">
                    <div 
                        className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-500 ease-out relative"
                        style={{ width: `${Math.max(0, (enemyHp / enemyMaxHp) * 100)}%` }}
                    >
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJub25lIiAvPgo8cGF0aCBkPSJNMCAwTDIgMkg0VjBIMHoiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKSIgLz4KPC9zdmc+')] opacity-50 mix-blend-overlay"></div>
                        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent"></div>
                    </div>
                </div>

                <div className="w-4 h-8 bg-gradient-to-b from-yellow-500 to-yellow-700 rounded-r-md border-2 border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] z-20"></div>
                
                {/* Name Tag overlapping the bar */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-950/90 border-2 border-red-500 px-6 py-1 rounded-sm shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                    <span className="text-sm font-black text-red-500 tracking-[0.3em] uppercase drop-shadow-[0_0_5px_rgba(220,38,38,1)]">O Anjo Caído</span>
                </div>
            </div>
          </div>

          <div className="absolute inset-0" key={gameId}>
            <GameCanvas 
              gameMode={gameMode} 
              retroMode={retroMode}
              character={selectedCharacter}
              sfxVolume={sfxVolume}
              isPaused={isSettingsOpen}
              onPlayerHpChange={setPlayerHp} 
              onEnemyHpChange={(hp: number, maxHp?: number) => { setEnemyHp(hp); if (maxHp) setEnemyMaxHp(maxHp); }}
              onGameOver={() => setIsGameOver(true)}
              onVitalChargesChange={setVitalCharges}
              onIntroFinish={() => {
                setBossFightStarted(true);
                bgmRef.current?.play();
              }}
            />
          </div>

          {/* Game Over / Victory Overlay */}
          {(isGameOver) && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-md z-50">
              <h2 className={`text-8xl font-black tracking-widest mb-6 ${
                playerHp <= 0 ? 'text-red-600' : 'text-amber-500'
              } drop-shadow-[0_0_30px_currentColor]`}>
                {playerHp <= 0 ? 'DERROTA' : 'VITÓRIA'}
              </h2>
              <p className="text-stone-400 mb-10 text-2xl">
                {playerHp <= 0 ? 'O cavaleiro caiu...' : 'O inimigo foi derrotado.'}
              </p>
              <button 
                onClick={exitToMenu}
                className="px-10 py-4 bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold rounded-xl border-2 border-stone-600 transition-all active:scale-95 shadow-2xl flex items-center gap-3 text-xl"
              >
                <Sword className="w-6 h-6" />
                VOLTAR AO MENU
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio Settings & Pause Modal */}
      <AudioSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        bgmVolume={bgmVolume}
        onBgmVolumeChange={handleBgmVolumeChange}
        sfxVolume={sfxVolume}
        onSfxVolumeChange={handleSfxVolumeChange}
        retroMode={retroMode}
        onToggleRetroMode={() => setRetroMode(!retroMode)}
        inGame={gameMode !== null}
        onRestartGame={resetGame}
        onExitToMenu={exitToMenu}
      />
    </div>
  );
}

