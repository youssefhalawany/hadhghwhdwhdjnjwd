/**
 * Circle K Web Audio API Operational Notification Sound Generator
 * Generates 0ms distinct operational audio chimes without external mp3 downloads!
 */

class AudioChimeEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * 🚨 1. Cash Register "Cha-Ching!" Sound for Voids
   */
  playVoidCashRegisterSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: High Bell Ring (2093 Hz - C7)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2093, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Tone 2: Metallic Coin Register Click (2637 Hz - E7)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(2637, now + 0.08);
      gain2.gain.setValueAtTime(0.35, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.6);

      // Tone 3: Resonating Cash Bell Ring (3135 Hz - G7)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(3135, now + 0.16);
      gain3.gain.setValueAtTime(0.4, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.8);
    } catch (e) {
      console.error("Failed to play void sound", e);
    }
  }

  /**
   * 📊 2. Upbeat Ascending Chord Chime for Shift Audit Submissions
   */
  playShiftAuditSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.09;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) {
      console.error("Failed to play shift audit sound", e);
    }
  }

  /**
   * 💵 3. Double Coin Drop Sound for Payments & Credits
   */
  playPaymentSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Drop 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1567.98, now); // G6
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Drop 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2093.00, now + 0.12); // C7
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.error("Failed to play payment sound", e);
    }
  }

  /**
   * ⚠️ 4. Urgent Warning Double Pulse for Expiries & Stock Alerts
   */
  playWarningSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Pulse 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Pulse 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(880, now + 0.2); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.error("Failed to play warning sound", e);
    }
  }

  private pingInterval: any = null;

  /**
   * 🔔 5. Urgent Device Ping / High Priority Remote Broadcast Sound
   */
  playPingSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // High-clarity triple sonar chime (E6 -> G#6 -> B6) with high attention resonance
      const freqs = [1318.51, 1661.22, 1975.53];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.08;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.45, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch (e) {
      console.error("Failed to play ping sound", e);
    }
  }

  /**
   * 🔁 Continuous looping chime that rings every intervalMs until stopPingLoop() is called on user confirmation
   */
  startPingLoop(intervalMs = 2000) {
    this.stopPingLoop();
    this.playPingSound();
    this.pingInterval = setInterval(() => {
      this.playPingSound();
    }, intervalMs);
  }

  stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  playByType(type?: string) {
    switch (type) {
      case "ping":
      case "alert":
        this.playPingSound();
        break;
      case "void":
        this.playVoidCashRegisterSound();
        break;
      case "shift":
        this.playShiftAuditSound();
        break;
      case "payment":
      case "credit":
      case "deposit":
        this.playPaymentSound();
        break;
      case "expiry":
      case "out_of_stock":
      case "warning":
        this.playWarningSound();
        break;
      default:
        this.playShiftAuditSound();
    }
  }
}

export const audioChimes = new AudioChimeEngine();
