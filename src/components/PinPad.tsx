import React from 'react';
import { Delete } from 'lucide-react';
import { playPopSound, playDeleteSound } from '@/lib/sounds';

interface PinPadProps {
  onPinChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  maxLength?: number;
}

export function PinPad({ onPinChange, onSubmit, maxLength = 4 }: PinPadProps) {
  const [pin, setPin] = React.useState('');

  const handlePress = (num: string) => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    playPopSound(); // Play instant custom sound
    
    if (pin.length < maxLength) {
      const newPin = pin + num;
      setPin(newPin);
      onPinChange(newPin);
      if (newPin.length === maxLength) {
        onSubmit(newPin);
        setTimeout(() => setPin(''), 500); // clear after short delay
      }
    }
  };

  const handleDelete = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
    playDeleteSound();
    if (pin.length > 0) {
      const newPin = pin.slice(0, -1);
      setPin(newPin);
      onPinChange(newPin);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto animate-in fade-in zoom-in-95 duration-300">
      {/* Visual PIN Display */}
      <div className="flex justify-center gap-4 mb-8">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div 
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < pin.length 
                ? 'bg-red-600 dark:bg-red-500 scale-125 shadow-[0_0_15px_rgba(220,38,38,0.6)]' 
                : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handlePress(num.toString());
            }}
            className="h-16 sm:h-20 w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-2xl font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 active:bg-slate-100 dark:active:bg-slate-600 transition-all flex items-center justify-center cursor-pointer relative overflow-hidden group select-none touch-manipulation"
          >
            <span className="relative z-10">{num}</span>
            <span className="absolute inset-0 bg-red-100 dark:bg-red-900/30 scale-0 group-active:scale-100 rounded-2xl transition-transform duration-300 origin-center opacity-0 group-active:opacity-100"></span>
          </button>
        ))}
        <div className="col-start-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handlePress('0');
            }}
            className="h-16 sm:h-20 w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-2xl font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 active:bg-slate-100 dark:active:bg-slate-600 transition-all flex items-center justify-center cursor-pointer relative overflow-hidden group select-none touch-manipulation"
          >
            <span className="relative z-10">0</span>
            <span className="absolute inset-0 bg-red-100 dark:bg-red-900/30 scale-0 group-active:scale-100 rounded-2xl transition-transform duration-300 origin-center opacity-0 group-active:opacity-100"></span>
          </button>
        </div>
        <div className="col-start-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="h-16 sm:h-20 w-full rounded-2xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer touch-manipulation"
          >
            <Delete className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
