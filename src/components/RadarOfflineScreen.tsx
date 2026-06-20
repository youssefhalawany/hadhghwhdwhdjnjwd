import React from 'react';
import { WifiOff, Cloud, X } from 'lucide-react';

interface RadarProps {
  isReconnecting: boolean;
  onDismiss: () => void;
  reportCount: number;
}

export function RadarOfflineScreen({ isReconnecting, onDismiss, reportCount }: RadarProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500 overflow-hidden">
      
      {!isReconnecting && (
        <button 
          onClick={onDismiss}
          className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      )}

      {/* Reconnecting / Success animation */}
      {isReconnecting ? (
        <div className="text-center animate-in zoom-in-95 duration-500">
          <div className="relative h-32 w-32 mx-auto mb-8">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative h-full w-full bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.5)]">
              <Cloud className="h-16 w-16 text-white animate-bounce" />
            </div>
            
            {/* Blips flying into cloud */}
            {Array.from({ length: Math.min(reportCount, 5) }).map((_, i) => (
              <div 
                key={i}
                className="absolute h-4 w-4 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,1)]"
                style={{
                  top: '150px',
                  left: `${(i - 2) * 40 + 60}px`,
                  animation: `flyUp 1s ease-in-out forwards`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Syncing to Cloud...</h2>
          <p className="text-blue-200 font-medium">Your offline reports are taking flight!</p>
        </div>
      ) : (
        <div className="text-center relative">
          {/* Radar Animation */}
          <div className="relative h-64 w-64 mx-auto mb-10 rounded-full border-2 border-emerald-500/30 overflow-hidden bg-emerald-950/20 shadow-[0_0_100px_rgba(16,185,129,0.1)]">
            {/* Grid lines */}
            <div className="absolute inset-0 border border-emerald-500/20 rounded-full m-8"></div>
            <div className="absolute inset-0 border border-emerald-500/20 rounded-full m-16"></div>
            <div className="absolute inset-0 border border-emerald-500/20 rounded-full m-24"></div>
            
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-500/20"></div>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-emerald-500/20"></div>
            
            {/* Sweeper */}
            <div className="absolute top-1/2 left-1/2 w-32 h-32 origin-top-left border-l-2 border-t-2 border-emerald-400 bg-gradient-to-br from-emerald-500/40 to-transparent animate-[spin_4s_linear_infinite] rounded-tl-full z-10"></div>
            
            {/* Blips */}
            {Array.from({ length: Math.min(reportCount, 8) }).map((_, i) => {
              const angles = [45, 120, 200, 310, 80, 160, 250, 340];
              const dists = [40, 70, 50, 80, 60, 30, 90, 45];
              const angle = angles[i % angles.length] * (Math.PI / 180);
              const dist = dists[i % dists.length];
              const top = 128 + Math.sin(angle) * dist;
              const left = 128 + Math.cos(angle) * dist;
              
              return (
                <div 
                  key={i}
                  className="absolute h-3 w-3 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,1)] z-0"
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    animation: `pulse 2s infinite`,
                    animationDelay: `${i * 0.5}s`
                  }}
                />
              );
            })}
          </div>
          
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-full inline-flex items-center gap-3 shadow-lg backdrop-blur-md mb-6">
            <WifiOff className="h-5 w-5" />
            <span className="font-bold tracking-widest uppercase text-sm">Offline Radar Active</span>
          </div>
          
          <h3 className="text-xl font-bold text-slate-300 mt-2 max-w-sm mx-auto leading-relaxed">
            {reportCount} report{reportCount !== 1 ? 's' : ''} waiting to sync.
          </h3>
          <p className="text-slate-500 mt-2">
            Keep working. They will automatically fly to the cloud when internet returns.
          </p>

          <button 
            onClick={onDismiss}
            className="mt-8 text-emerald-400 font-bold border-b border-emerald-400/30 pb-1 hover:text-emerald-300 transition-colors"
          >
            Dismiss & Keep Working
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flyUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
      `}} />
    </div>
  );
}
