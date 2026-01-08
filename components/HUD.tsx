
import React, { useEffect, useRef, useState } from 'react';
import { Activity, Globe, Hand, Lock } from 'lucide-react';

interface HUDProps {
  currentTime: string;
  isHandDetected: boolean;
  gestureState: string;
  activeContinent: string;
  rightHandPos: { x: number, y: number } | null;
  isDraggingRight: boolean; // Also acts as isGrabbing
  systemFPS: number;
  isSpeaking: boolean;
}

const HUD: React.FC<HUDProps> = ({ 
  currentTime, 
  isHandDetected, 
  gestureState, 
  activeContinent,
  rightHandPos,
  isDraggingRight,
  systemFPS,
  isSpeaking
}) => {
  const [hexCodes, setHexCodes] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Mock data generation
  useEffect(() => {
    const interval = setInterval(() => {
      const code = `0x${Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0')}`;
      setHexCodes(prev => [code, ...prev].slice(0, 8));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 text-cyan-400 font-mono overflow-hidden">
      <div className="scanline" />
      
      {/* --- Top Left: System Status --- */}
      <div className="absolute top-8 left-8 flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-cyan-500/50 pb-2">
          <Activity className="w-6 h-6 animate-pulse" />
          <span className="text-xl font-bold tracking-widest glow-text">SYSTEM ONLINE</span>
        </div>
        <div className="flex flex-col text-xs space-y-1 opacity-80">
          <div className="flex justify-between w-48">
            <span>CPU LOAD</span>
            <div className="w-24 bg-cyan-900/50 h-3 border border-cyan-500/30">
              <div className="bg-cyan-400 h-full animate-[pulse_2s_infinite]" style={{ width: '45%' }}></div>
            </div>
          </div>
          <div className="flex justify-between w-48">
             <span>FPS</span>
             <span className="text-white">{systemFPS}</span>
          </div>
        </div>
        
        {/* Hex Dump */}
        <div className="mt-4 font-mono text-[10px] opacity-60 flex flex-col text-cyan-600">
           {hexCodes.map((hex, i) => (
             <span key={i} style={{ opacity: 1 - i * 0.1 }}>{`>> MEM_ALLOC: ${hex}`}</span>
           ))}
        </div>
      </div>

      {/* --- Top Center: Audio Visualizer (Dynamic) --- */}
      {isSpeaking && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 h-12">
           {Array.from({ length: 20 }).map((_, i) => (
             <div 
               key={i} 
               className="w-1 bg-cyan-400 animate-pulse"
               style={{ 
                 height: `${Math.random() * 100}%`,
                 animationDuration: `${Math.random() * 0.5 + 0.1}s`
               }}
             />
           ))}
        </div>
      )}

      {/* --- Top Right: Title & Time --- */}
      <div className="absolute top-8 right-8 text-right">
        <div className="flex items-start justify-end gap-3">
          <div>
            <h1 className="text-6xl font-bold tracking-tighter glow-text opacity-90">HoloNet</h1>
            <div className="text-[10px] tracking-[0.35em] text-cyan-500/70 uppercase">Gesture Console</div>
          </div>
        </div>
        <div className="text-2xl tracking-[0.2em] text-cyan-100">{currentTime}</div>
        <div className="flex justify-end gap-2 mt-2 items-center">
          <span className="text-[10px] tracking-widest mr-2">{isSpeaking ? "VOICE ACTIVE" : "LISTENING"}</span>
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-white animate-ping' : 'bg-cyan-900'}`}></div>
          <div className="w-12 h-2 bg-cyan-900 border border-cyan-500"></div>
        </div>
      </div>

      {/* --- Bottom Left: Hand Status --- */}
      <div className="absolute bottom-8 left-8 border-l-4 border-cyan-500 pl-4 py-2 bg-black/40 backdrop-blur-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-2">
          {isDraggingRight ? (
            <Lock className="w-5 h-5 text-yellow-400 animate-pulse" />
          ) : (
            <Hand className={`w-5 h-5 ${isHandDetected ? 'text-cyan-400' : 'text-red-500'}`} />
          )}
          <span className={`text-sm font-semibold tracking-wider ${isDraggingRight ? 'text-yellow-400' : ''}`}>
            {isDraggingRight ? 'OBJECT LOCKED' : (isHandDetected ? 'HAND TRACKING ACTIVE' : 'SEARCHING...')}
          </span>
        </div>
        <div className="text-xs space-y-1 text-cyan-300">
          <div>COMMAND: <span className="text-white font-bold">{gestureState}</span></div>
        </div>
      </div>

      {/* --- Right: Analysis Panel (Floating) --- */}
      <div 
        className="absolute top-1/2 right-8 -translate-y-1/2 w-64 bg-black/80 backdrop-blur-md border border-cyan-500/40 p-4 rounded-br-2xl shadow-[0_0_15px_rgba(0,255,255,0.15)]"
      >
        <div className="flex items-center justify-between mb-4 border-b border-cyan-500/30 pb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <h3 className="font-bold tracking-widest text-sm">TARGET ANALYSIS</h3>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-cyan-900/20 p-2 border-l-2 border-cyan-500">
            <div className="text-[10px] text-cyan-400 mb-1">REGION</div>
            <div className="text-lg font-bold text-white leading-tight">{activeContinent}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-black/40 p-2 border border-cyan-500/20">
              <div className="text-[10px] opacity-70">THREAT LEVEL</div>
              <div className="text-sm font-bold text-green-400">SAFE</div>
            </div>
            <div className="bg-black/40 p-2 border border-cyan-500/20">
              <div className="text-[10px] opacity-70">ENERGY</div>
              <div className="text-sm font-bold">{Math.floor(Math.random() * 40 + 60)}%</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Center Target Recticle (Only when grabbing) */}
      {isDraggingRight && rightHandPos && (
         <div 
           className="absolute w-20 h-20 border-2 border-yellow-400/50 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
           style={{ 
             left: rightHandPos.x * window.innerWidth, 
             top: rightHandPos.y * window.innerHeight 
           }}
         >
           <div className="absolute inset-0 animate-ping border border-yellow-400/30 rounded-full"></div>
         </div>
      )}

      {/* Help Launcher (更显眼的中文入口) */}
      <button
        type="button"
        className="pointer-events-auto absolute top-7 right-8 z-30 px-3 py-2 rounded-full border border-cyan-500/50 bg-black/50 hover:bg-black/70 text-[12px] tracking-[0.25em] text-cyan-200 shadow-[0_0_18px_rgba(0,255,255,0.18)]"
        onClick={() => setHelpOpen(true)}
      >
        使用帮助
      </button>

      {/* Help Overlay */}
      {helpOpen && (
        <div className="absolute inset-0 pointer-events-auto z-30 bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setHelpOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[calc(100vw-32px)] bg-black/85 border border-cyan-500/40 shadow-[0_0_35px_rgba(0,255,255,0.16)] p-6">
            <div className="flex items-center justify-between mb-4 border-b border-cyan-500/30 pb-3">
              <div>
                <div className="text-[12px] tracking-[0.32em] text-cyan-300/90">使用帮助</div>
                <div className="text-[10px] tracking-[0.25em] text-cyan-500/70 mt-1">手势操作速查 · HoloNet 控制台</div>
              </div>
              <button
                type="button"
                className="px-3 py-2 text-[10px] tracking-[0.25em] rounded border border-cyan-500/30 bg-black/40 hover:bg-black/60 transition-colors"
                onClick={() => setHelpOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px] text-cyan-200/90 leading-relaxed">
              <div className="border border-cyan-500/20 bg-black/40 p-4">
                <div className="text-[10px] tracking-widest text-cyan-500/70 mb-2">启动</div>
                <div>允许浏览器访问摄像头 → 点击启动按钮进入主界面。</div>
              </div>
              <div className="border border-cyan-500/20 bg-black/40 p-4">
                <div className="text-[10px] tracking-widest text-cyan-500/70 mb-2">左手 · 推/拉</div>
                <div>控制视角深度：手靠近/远离镜头，对应拉近/拉远全息地球。</div>
              </div>
              <div className="border border-cyan-500/20 bg-black/40 p-4">
                <div className="text-[10px] tracking-widest text-cyan-500/70 mb-2">右手 · 捏合抓取</div>
                <div>捏合进入抓取模式：拖拽地球位置；松开回到缩放模式。</div>
              </div>
              <div className="border border-cyan-500/20 bg-black/40 p-4">
                <div className="text-[10px] tracking-widest text-cyan-500/70 mb-2">双手模式</div>
                <div>双手同时入镜，会触发姿态联动（翻转/倾角）演示。</div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-cyan-500/70">
              提示：光线充足、手掌完整入镜、手离镜头适中时识别更稳定。
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HUD;
