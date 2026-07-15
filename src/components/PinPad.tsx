import React, { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { playPopSound, playDeleteSound } from '@/lib/sounds';
import { motion, useAnimation } from 'framer-motion';

interface PinPadProps {
  onPinChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  maxLength?: number;
  error?: boolean;
}

export function PinPad({ onPinChange, onSubmit, maxLength = 4, error = false }: PinPadProps) {
  const [pin, setPin] = useState('');
  const controls = useAnimation();

  useEffect(() => {
    if (error) {
      controls.start({
        x: [-10, 10, -10, 10, -5, 5, 0],
        transition: { duration: 0.4 }
      });
      setPin(''); // Auto clear on error
      onPinChange('');
    }
  }, [error, controls, onPinChange]);

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
    <motion.div animate={controls} className="w-full max-w-xs mx-auto animate-in fade-in zoom-in-95 duration-300">
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

      <div className="grid grid-cols-3 gap-4 sm:gap-6 place-items-center">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handlePress(num.toString());
            }}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/10 dark:bg-[#0b1121]/50 backdrop-blur-md border border-white/20 dark:border-cyan-400/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] text-2xl font-black text-slate-800 dark:text-slate-100 hover:bg-white/20 dark:hover:bg-cyan-500/20 active:scale-90 transition-all flex items-center justify-center cursor-pointer select-none touch-manipulation"
          >
            {num}
          </button>
        ))}
        <div className="col-start-2 flex justify-center w-full">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handlePress('0');
            }}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/10 dark:bg-[#0b1121]/50 backdrop-blur-md border border-white/20 dark:border-cyan-400/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] text-2xl font-black text-slate-800 dark:text-slate-100 hover:bg-white/20 dark:hover:bg-cyan-500/20 active:scale-90 transition-all flex items-center justify-center cursor-pointer select-none touch-manipulation"
          >
            0
          </button>
        </div>
        <div className="col-start-3 flex justify-center w-full">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/5 dark:bg-red-500/10 backdrop-blur-md border border-white/10 dark:border-red-500/20 text-slate-600 dark:text-red-400 hover:bg-white/10 dark:hover:bg-red-500/30 active:scale-90 transition-all flex items-center justify-center cursor-pointer touch-manipulation"
          >
            <Delete className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
