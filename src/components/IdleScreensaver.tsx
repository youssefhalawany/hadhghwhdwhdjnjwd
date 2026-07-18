"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AlertTriangle } from "lucide-react";

export function IdleScreensaver({ pendingTasksCount = 0 }: { pendingTasksCount?: number }) {
  const [isIdle, setIsIdle] = useState(false);
  const [time, setTime] = useState(new Date());
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  // 1. Idle Detection
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      setIsIdle(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsIdle(true), 60000); // 1 minute
    };
    resetTimer();
    const events = ["mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, []);

  // 2. Time & Ticker Fetch
  useEffect(() => {
    if (!isIdle) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    
    // Fetch recent audit logs for the ticker
    const fetchTicker = async () => {
      try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(10));
        const snap = await getDocs(q);
        const items = snap.docs.map(doc => {
          const d = doc.data();
          const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date();
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `${timeStr} - ${d.action} by ${d.userName || 'System'}`;
        });
        if (items.length > 0) setTickerItems(items);
        else setTickerItems(["System Online", "All systems nominal", "Monitoring active"]);
      } catch (e) {
        setTickerItems(["System Online", "Monitoring active"]);
      }
    };
    fetchTicker();
    
    return () => clearInterval(interval);
  }, [isIdle]);

  // 3. Matrix Rain Effect
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!isIdle || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "01$EGP%ANH489ALAMEINOLA".split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];
    for (let x = 0; x < columns; x++) drops[x] = 1;

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Circle K branding: Red rain
      ctx.fillStyle = "rgba(220, 38, 38, 0.7)"; 
      ctx.font = fontSize + "px monospace";
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    
    // Slow down the rain
    const interval = setInterval(draw, 70);
    return () => clearInterval(interval);
  }, [isIdle]);

  // 4. DVD Bounce Logic
  const boxRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: Math.random() * 200, y: Math.random() * 200, vx: 1.5, vy: 1.5 });
  
  useEffect(() => {
    if (!isIdle || !boxRef.current) return;
    let animationFrameId: number;
    
    const update = () => {
      const box = boxRef.current;
      if (!box) return;
      
      let { x, y, vx, vy } = pos.current;
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const maxW = window.innerWidth;
      const maxH = window.innerHeight;
      
      // We reserve bottom 40px for the ticker, so don't bounce below that
      if (x + w >= maxW || x <= 0) vx = -vx;
      if (y + h >= maxH - 50 || y <= 0) vy = -vy;
      
      x += vx;
      y += vy;
      
      pos.current = { x, y, vx, vy };
      box.style.transform = `translate(${x}px, ${y}px)`;
      
      animationFrameId = requestAnimationFrame(update);
    };
    
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isIdle]);

  // 5. Calculate Shift Time Remaining
  const getShiftTimeRemaining = () => {
    const now = time;
    const hours = now.getHours();
    
    let target = new Date(now);
    if (hours < 12) {
      // Current is AM shift. Target is 12:00 PM today
      target.setHours(12, 0, 0, 0);
    } else {
      // Current is PM shift. Target is 12:00 AM tomorrow
      target.setDate(target.getDate() + 1);
      target.setHours(0, 0, 0, 0);
    }
    
    const diffMs = target.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${diffHrs}h ${diffMins}m ${diffSecs}s remaining in shift`;
  };

  return (
    <AnimatePresence>
      {isIdle && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className={`fixed inset-0 z-[9999] bg-black text-white overflow-hidden ${
            pendingTasksCount > 0 ? "shadow-[inset_0_0_80px_rgba(239,68,68,0.5)] border-4 border-red-500/50" : ""
          }`}
        >
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .animate-marquee {
              animation: marquee 30s linear infinite;
            }
          `}</style>

          {/* Matrix Background */}
          <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40 pointer-events-none" />

          {/* Bouncing Box (DVD Style) */}
          <div ref={boxRef} className="absolute z-10 w-[400px] bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center">
            
            {/* Alert if pending tasks */}
            {pendingTasksCount > 0 && (
              <div className="absolute -top-4 -right-4 bg-red-600 text-white flex items-center gap-2 px-3 py-1.5 rounded-full font-bold shadow-lg shadow-red-500/50 animate-pulse border border-red-400">
                <AlertTriangle className="h-4 w-4" />
                {pendingTasksCount} Action{pendingTasksCount > 1 ? 's' : ''} Needed
              </div>
            )}

            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center font-bold text-2xl border-2 border-white tracking-tighter shadow-[0_0_15px_rgba(220,38,38,0.6)]">
                K
              </div>
              <span className="text-3xl font-black tracking-widest text-white/90">ANH</span>
            </div>
            
            <div className="text-[80px] leading-none font-black tracking-tighter font-mono bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent drop-shadow-2xl">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            
            <div className="text-xl font-bold text-cyan-400 mt-2">
              {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            
            <div className="mt-6 text-yellow-400 font-mono font-bold text-sm bg-yellow-400/10 px-4 py-2 rounded-xl border border-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
              ⏱️ {getShiftTimeRemaining()}
            </div>

            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="mt-6 text-gray-500 uppercase tracking-widest text-xs font-bold"
            >
              Move mouse or tap to unlock
            </motion.div>
          </div>

          {/* Ticker at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-red-950/40 border-t border-red-500/20 flex items-center z-20 overflow-hidden backdrop-blur-md">
            <div className="whitespace-nowrap animate-marquee flex gap-12 font-mono text-xs font-bold text-white/80">
              {tickerItems.map((item, i) => (
                <span key={i}>• {item}</span>
              ))}
              {/* Duplicate for seamless loop */}
              {tickerItems.map((item, i) => (
                <span key={`dup-${i}`}>• {item}</span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
