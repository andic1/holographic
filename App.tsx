
import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { VisionService } from './services/mediaPipe';
import HologramEarth from './components/HologramEarth';
import HUD from './components/HUD';
import { distance, mapRange, lerp } from './utils/math';
import { Loader2, Power } from 'lucide-react';
import { playSound, speak } from './utils/audio';
import * as THREE from 'three';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // App State
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  // Interaction State
  const [handDetected, setHandDetected] = useState(false);
  const [gestureState, setGestureState] = useState("系统待机，等待手势指令...");
  const [currentTime, setCurrentTime] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Earth Control State
  const earthRotationRef = useRef({ x: 0, y: 0 }); 
  const ANCHOR_POS = { x: -2.5, y: 0 }; 
  const earthPositionRef = useRef({ x: ANCHOR_POS.x, y: ANCHOR_POS.y, z: 0 }); 
  const [earthScale, setEarthScale] = useState(1.5);
  const [activeContinent, setActiveContinent] = useState("全局拓扑载入中...");
  
  // Elimination Sequence State
  const [eliminationStage, setEliminationStage] = useState<'idle' | 'locking' | 'exploding' | 'destroyed'>('idle');
  const eliminationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interaction Flags
  const isGrabbingRef = useRef(false);
  const [isGrabbingState, setIsGrabbingState] = useState(false);

  // Panel Control State
  const [rightHandPos, setRightHandPos] = useState<{x: number, y: number} | null>(null);

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize MediaPipe and Camera
  useEffect(() => {
    const init = async () => {
      try {
        await VisionService.initialize();
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
             video: {
               width: { ideal: 1280 },
               height: { ideal: 720 },
               facingMode: "user"
             }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', () => {
              setLoading(false);
            });
          }
        } else {
          // 无摄像头或不支持时，进入演示模式
          setGestureState("当前设备未检测到摄像头，已切换为演示模式。");
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        // 初始化失败同样进入演示模式，而不是整屏错误
        setGestureState("视觉模块初始化失败，已进入离线演示模式。");
        setLoading(false);
      }
    };
    init();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Fallback: 如果初始化过慢，强制关闭 loading 遮罩，避免一直卡在 INITIALIZING 画面
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // Startup Sequence
  const handleStart = () => {
    // 1. Audio Context Resume (Must happen on click)
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume().then(() => {
        playSound('boot');
    });

    setHasStarted(true);
    
    // 2. Speak immediately
    setIsSpeaking(true);
    speak("系统启动完成，手势控制台已就绪。");
    
    setTimeout(() => {
        setIsSpeaking(false);
        predictWebcam();
    }, 3000);
  };

  // Logic to Trigger Demo Alert Protocol
  const triggerElimination = () => {
    if (eliminationStage !== 'idle') return;
    
    setEliminationStage('locking');
    setGestureState("演示模式：锁定异常节点");
    
    // Voice: Trigger
    setIsSpeaking(true);
    speak("检测到高危手势，进入安全演示模式，开始隔离异常节点。");
    setTimeout(() => setIsSpeaking(false), 2500);

    // Sound: Charge
    playSound('charge'); 

    // 3.0 seconds lock time then explode
    eliminationTimerRef.current = setTimeout(() => {
       setEliminationStage('exploding');
       setGestureState("演示模式：模拟流量清洗中");
       playSound('explosion');
       
       // 2.0 second explosion animation then destroyed
       setTimeout(() => {
          setEliminationStage('destroyed');
          setGestureState("演示完成：异常节点已被隔离");
          
          // Voice: Aftermath
          setIsSpeaking(true);
          speak("模拟清洗已完成，核心链路状态稳定，准备退出演示模式。");
          setTimeout(() => setIsSpeaking(false), 4000);
          
          // Reset after 8 seconds
          setTimeout(() => {
             setEliminationStage('idle');
          }, 8000);
       }, 2000);
    }, 3000);
  };

  // Robust Middle Finger Detection
  const detectMiddleFinger = (hand: any[], wrist: any) => {
      // Logic: The middle finger tip (12) should be the HIGHEST point (lowest Y value)
      // And significantly higher than index (8), ring (16), and pinky (20)
      const tipY = hand[12].y;
      const indexY = hand[8].y;
      const ringY = hand[16].y;
      const pinkyY = hand[20].y;
      const wristY = wrist.y;

      // Threshold: fingers must be lower than middle finger by at least 0.05 (normalized coord)
      // And wrist must be lower than tip (hand is upright)
      const isUpright = wristY > tipY + 0.1;
      const isMiddleHighest = tipY < indexY - 0.03 && tipY < ringY - 0.03 && tipY < pinkyY - 0.03;
      
      return isUpright && isMiddleHighest;
  };

  // Main Prediction Loop
  const predictWebcam = useCallback(() => {
    if (!videoRef.current || !canvas2dRef.current) return;

    const startTime = performance.now();
    const results = VisionService.detect(videoRef.current);
    
    const ctx = canvas2dRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas2dRef.current.width, canvas2dRef.current.height);
      
      if (canvas2dRef.current.width !== videoRef.current.videoWidth) {
        canvas2dRef.current.width = videoRef.current.videoWidth;
        canvas2dRef.current.height = videoRef.current.videoHeight;
      }

      if (results && results.landmarks && results.landmarks.length > 0) {
        setHandDetected(true);
        const landmarks = results.landmarks;
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
        ctx.fillStyle = "#FFFFFF";

        let leftHand = null;
        let rightHand = null;

        // Basic Hand Classification and Drawing
        for (const hand of landmarks) {
          for (let i = 0; i < hand.length; i++) {
             const x = hand[i].x * ctx.canvas.width;
             const y = hand[i].y * ctx.canvas.height;
             ctx.beginPath();
             ctx.arc(x, y, 3, 0, 2 * Math.PI);
             ctx.fill();
          }
          const wrist = hand[0];
          // Simple classifier based on X position
          if (wrist.x < 0.5) leftHand = hand;
          else rightHand = hand;
        }

        let statusText = "系统待机";
        let isGrabbingFrame = isGrabbingRef.current;

        // --- GLOBAL GESTURE CHECK (High-priority demo trigger) ---
        // High priority check before any movement logic
        let eliminationTriggered = false;
        if (eliminationStage === 'idle') {
            if ((leftHand && detectMiddleFinger(leftHand, leftHand[0])) || 
                (rightHand && detectMiddleFinger(rightHand, rightHand[0]))) {
                triggerElimination();
                eliminationTriggered = true;
            }
        }

        // Only process movement if NOT eliminating
        if (eliminationStage === 'idle' && !eliminationTriggered) {

            // 1. DUAL HAND MODE (Flip Control)
            if (leftHand && rightHand) {
              statusText = "双重链接模式";
              const leftY = leftHand[0].y;
              const rightY = rightHand[0].y;
              const diffY = leftY - rightY; 
              const targetTilt = mapRange(diffY, -0.3, 0.3, -1.0, 1.0);
              earthRotationRef.current.x = lerp(earthRotationRef.current.x, targetTilt, 0.1);
            }
            
            // 2. LEFT HAND (Rotation & Z-Depth)
            if (leftHand) {
              const wrist = leftHand[0];
              const targetRotY = mapRange(wrist.x, 0, 0.5, -1.5, 1.5);
              earthRotationRef.current.y = targetRotY;

              const handSize = distance(leftHand[0].x, leftHand[0].y, leftHand[9].x, leftHand[9].y);
              const targetZ = mapRange(handSize, 0.05, 0.25, 3, -8); 
              earthPositionRef.current.z = lerp(earthPositionRef.current.z, targetZ, 0.05);

              if (!rightHand) statusText = "姿态控制 (推/拉)";
            }

            // 3. RIGHT HAND (Manipulation)
            if (rightHand) {
              const wrist = rightHand[0];
              const thumb = rightHand[4];
              const index = rightHand[8];
              
              setRightHandPos({ x: 1 - rightHand[0].x, y: rightHand[0].y });
              
              // Helper for fingers extended
              const isFingerExtended = (tipIdx: number, pipIdx: number) => {
                 return distance(wrist.x, wrist.y, rightHand[tipIdx].x, rightHand[tipIdx].y) > 
                        distance(wrist.x, wrist.y, rightHand[pipIdx].x, rightHand[pipIdx].y) * 1.2;
              };

              const pinchDist = distance(thumb.x, thumb.y, index.x, index.y);
              
              // Hysteresis for pinch
              if (isGrabbingFrame) {
                 if (pinchDist > 0.08) isGrabbingFrame = false;
              } else {
                 if (pinchDist < 0.05) isGrabbingFrame = true;
              }
              isGrabbingRef.current = isGrabbingFrame;

              if (isGrabbingFrame) {
                 // Check if OK gesture (Middle, Ring, Pinky extended)
                 const isMiddleExt = isFingerExtended(12, 10);
                 const isRingExt = isFingerExtended(16, 14);
                 const isPinkyExt = isFingerExtended(20, 18);
                 const extendedCount = (isMiddleExt ? 1 : 0) + (isRingExt ? 1 : 0) + (isPinkyExt ? 1 : 0);
                 const isOkGesture = extendedCount >= 2;

                 if (isOkGesture) {
                    statusText = "引力旋转模式";
                    earthRotationRef.current.y += 0.25; 
                    setEarthScale(prev => lerp(prev, 0.8, 0.1));
                 } else {
                    statusText = "物体抓取中";
                 }
                 
                 // Move Logic (Unprojection)
                 const cameraZ = 5; 
                 const objectZ = earthPositionRef.current.z;
                 const distToCam = cameraZ - objectZ;
                 const vFov = (45 * Math.PI) / 180;
                 const visibleHeight = 2 * Math.tan(vFov / 2) * distToCam;
                 const aspect = window.innerWidth / window.innerHeight;
                 const visibleWidth = visibleHeight * aspect;

                 const rawX = 1 - thumb.x;
                 const rawY = thumb.y;

                 const targetX = (rawX - 0.5) * visibleWidth;
                 const targetY = -(rawY - 0.5) * visibleHeight;

                 earthPositionRef.current.x = lerp(earthPositionRef.current.x, targetX, 0.15);
                 earthPositionRef.current.y = lerp(earthPositionRef.current.y, targetY, 0.15);

                 // Draw Connection Line
                 const tx = thumb.x * ctx.canvas.width;
                 const ty = thumb.y * ctx.canvas.height;
                 const ix = index.x * ctx.canvas.width;
                 const iy = index.y * ctx.canvas.height;
                 ctx.beginPath();
                 ctx.moveTo(tx, ty);
                 ctx.lineTo(ix, iy);
                 ctx.strokeStyle = isOkGesture ? "#FFD700" : "#00FFFF";
                 ctx.lineWidth = isOkGesture ? 6 : 4;
                 ctx.stroke();

              } else {
                 // Scale Logic (Spread)
                 const targetScale = mapRange(pinchDist, 0.08, 0.25, 0.5, 2.5);
                 setEarthScale(prev => lerp(prev, targetScale, 0.06));
                 earthPositionRef.current.x = lerp(earthPositionRef.current.x, ANCHOR_POS.x, 0.08);
                 earthPositionRef.current.y = lerp(earthPositionRef.current.y, ANCHOR_POS.y, 0.08);
                 if (!leftHand) statusText = "精密缩放 (捏合)";
              }
            } else {
               // No right hand
               earthPositionRef.current.x = lerp(earthPositionRef.current.x, ANCHOR_POS.x, 0.05);
               earthPositionRef.current.y = lerp(earthPositionRef.current.y, ANCHOR_POS.y, 0.05);
               isGrabbingRef.current = false;
            }
        }

        // Sync grab state
        if (isGrabbingState !== isGrabbingRef.current) {
           setIsGrabbingState(isGrabbingRef.current);
        }
        
        // Override status text if eliminating
        if (eliminationStage !== 'idle') {
           if (eliminationStage === 'locking') statusText = "演示模式：锁定异常节点";
           if (eliminationStage === 'exploding') statusText = "演示模式：清洗流量中";
           if (eliminationStage === 'destroyed') statusText = "演示模式：节点已隔离";
        }

        setGestureState(statusText);

      } else {
        // No hands detected
        setHandDetected(false);
        setGestureState("扫描中...");
        if (eliminationStage === 'idle') {
           earthRotationRef.current.y += 0.002; 
        }
        earthPositionRef.current.z = lerp(earthPositionRef.current.z, 0, 0.02);
        earthPositionRef.current.x = lerp(earthPositionRef.current.x, ANCHOR_POS.x, 0.05);
        earthPositionRef.current.y = lerp(earthPositionRef.current.y, ANCHOR_POS.y, 0.05);
        isGrabbingRef.current = false;
        if(isGrabbingState) setIsGrabbingState(false);
      }
    }
    
    const endTime = performance.now();
    setFps(Math.round(1000 / (endTime - startTime)));

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [isGrabbingState, eliminationStage]); 


  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
        autoPlay
        playsInline
        muted
      />
      <canvas 
        ref={canvas2dRef}
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none opacity-60 z-10"
      />
      <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
           <ambientLight intensity={0.5} />
           <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
           <Suspense fallback={null}>
              <HologramEarth 
                rotation={earthRotationRef.current} 
                position={earthPositionRef.current}
                scale={earthScale}
                onContinentChange={setActiveContinent}
                eliminationStage={eliminationStage}
              />
           </Suspense>
        </Canvas>
      </div>
      {hasStarted && !loading && !error && (
        <HUD 
          currentTime={currentTime}
          isHandDetected={handDetected}
          gestureState={gestureState}
          activeContinent={activeContinent}
          rightHandPos={rightHandPos}
          isDraggingRight={isGrabbingState} 
          systemFPS={fps}
          isSpeaking={isSpeaking}
        />
      )}
      {(!hasStarted || loading) && !error && (
        <div className="absolute inset-0 flex flex-col bg-black z-50 text-cyan-500">
          {/* 顶部状态条 */}
          <div className="flex items-center justify-between px-10 pt-8 text-[11px] tracking-[0.25em] text-cyan-400/80">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase text-cyan-500/70">HoloNet 控制台</span>
              <span className="px-2 py-0.5 rounded-full border border-cyan-700/60 bg-black/40 text-[10px]">
                {loading ? "VISION MODULE · BOOTING" : "READY · GESTURE ONLINE"}
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-[10px] text-cyan-500/70">EDGE NODE</span>
              <span className="text-[11px]">ESA-PAGES</span>
            </div>
          </div>

          {/* 中央启动按钮 */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer" onClick={!loading ? handleStart : undefined}>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
              <div className={`relative w-24 h-24 rounded-full bg-black border-2 ${loading ? 'border-cyan-800' : 'border-cyan-400'} flex items-center justify-center`}>
                {loading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-cyan-600" />
                ) : (
                  <Power className="w-10 h-10 text-cyan-400 group-hover:text-white transition-colors" />
                )}
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-[0.35em] mt-8 animate-pulse text-center">
              {loading ? "INITIALIZING SYSTEMS" : "HoloNet CONSOLE"}
            </h2>
            <p className="text-xs mt-3 text-cyan-700 tracking-widest uppercase">
              {loading ? "LOADING VISION MODULE..." : "TOUCH TO INITIALIZE"}
            </p>
          </div>

          {/* 底部功能提示 */}
          <div className="px-10 pb-6 flex items-center justify-between text-[11px] text-cyan-700/80">
            <div className="flex flex-wrap gap-3">
              <span className="px-2 py-0.5 rounded border border-cyan-800/60 bg-black/40">
                手势追踪 · MediaPipe
              </span>
              <span className="px-2 py-0.5 rounded border border-cyan-800/60 bg-black/40">
                三维地球 · Three.js
              </span>
              <span className="px-2 py-0.5 rounded border border-cyan-800/60 bg-black/40">
                HUD 控制台 · React
              </span>
            </div>
            <span className="text-cyan-700/60 hidden sm:inline">
              允许浏览器访问摄像头以体验完整手势控制
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="border border-red-500 p-8 text-red-500 text-center rounded bg-red-950/20 backdrop-blur-md">
             <h2 className="text-2xl font-bold mb-2 tracking-widest">SYSTEM FAILURE</h2>
             <p className="font-mono">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
