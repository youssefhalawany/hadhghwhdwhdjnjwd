"use client";

// Simple AudioContext singleton to prevent creating too many contexts
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

// Subtle, muted "click" for switching tabs or pressing buttons
export const playClickSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
  
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

// Subtle swoosh for opening modals or expanding elements
export const playSwooshSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const bufferSize = ctx.sampleRate * 0.2; // 0.2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // White noise
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.1);
  filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noiseSource.start();
};

// "Apple Pay" style success chime
export const playSuccessChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const playNote = (freq: number, startTime: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // sine wave for a bright, bell-like tone
    osc.type = "sine";
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Smooth decay
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = ctx.currentTime;
  
  // Apple Pay-ish chime: Two quick ascending notes, e.g. E5 -> G#5
  playNote(659.25, now, 0.4);       // E5
  playNote(830.61, now + 0.15, 0.6); // G#5
};

// Thermal printer "printing" sound
export const playPrinterSound = () => {
  if (typeof window === "undefined") return;
  const audio = new Audio('/printer.wav');
  audio.volume = 0.6;
  audio.play().catch(e => console.error("Error playing printer sound:", e));
};

// 1. Analog Odometer Roll
export const playAnalogRollSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  // Rapid fluttering clicks
  for (let i = 0; i < 8; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(800 + Math.random() * 200, now + i * 0.04);
    gain.gain.setValueAtTime(0, now + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.05, now + i * 0.04 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + i * 0.04 + 0.03);
  }
  
  // Final ding
  const dingOsc = ctx.createOscillator();
  const dingGain = ctx.createGain();
  dingOsc.type = "sine";
  dingOsc.frequency.value = 1200;
  dingGain.gain.setValueAtTime(0, now + 0.35);
  dingGain.gain.linearRampToValueAtTime(0.3, now + 0.36);
  dingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  dingOsc.connect(dingGain);
  dingGain.connect(ctx.destination);
  dingOsc.start(now + 0.35);
  dingOsc.stop(now + 0.8);
};

// 2. Heavy Rubber Stamp
export const playStampSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.8, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.2);
};

// 3. Safe Drop / Drawer Close
export const playSafeDropSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = "square";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.3);
};

// 4. Document Shredder
export const playShredderSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const bufferSize = ctx.sampleRate * 1.5; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.linearRampToValueAtTime(1500, now + 0.75);
  filter.frequency.linearRampToValueAtTime(800, now + 1.5);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.15, now + 1.3);
  gain.gain.linearRampToValueAtTime(0, now + 1.5);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noiseSource.start(now);
};

// 5. Laser Scan Beep
export const playLaserScanSound = (success: boolean = true) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = success ? "sine" : "square";
  osc.frequency.setValueAtTime(success ? 1800 : 300, now);
  
  if (!success) {
    osc.frequency.setValueAtTime(250, now + 0.15);
  }
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  gain.gain.linearRampToValueAtTime(0, now + (success ? 0.1 : 0.3));
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + (success ? 0.1 : 0.3));
};

// 6. Marker Scratch
export const playMarkerScratchSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const bufferSize = ctx.sampleRate * 0.15; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2000;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noiseSource.start(now);
};

// 7. Lock Turn
export const playLockTurnSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = "square";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.1);
};

// 8. Coin Drop
export const playCoinDropSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc1.type = "sine";
  osc2.type = "triangle";
  
  osc1.frequency.setValueAtTime(3500, now);
  osc2.frequency.setValueAtTime(4500, now);
  
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.4);
  osc2.stop(now + 0.4);
};

// 9. Printer Swoosh (Zipping)
export const playPrintSwooshSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  
  for(let i=0; i<15; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.value = 1500;
    
    gain.gain.setValueAtTime(0, now + i * 0.02);
    gain.gain.linearRampToValueAtTime(0.05, now + i * 0.02 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.02);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now + i * 0.02);
    osc.stop(now + i * 0.02 + 0.02);
  }
};
