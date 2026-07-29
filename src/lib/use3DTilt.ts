"use client";

import { useState, useEffect } from "react";

export interface TiltState {
  tiltX: number; // degrees rotateX
  tiltY: number; // degrees rotateY
  glareX: number; // percentage 0-100
  glareY: number; // percentage 0-100
  isSupported: boolean;
}

export function use3DTilt(maxTilt: number = 15): TiltState {
  const [tilt, setTilt] = useState<TiltState>({
    tiltX: 0,
    tiltY: 0,
    glareX: 50,
    glareY: 50,
    isSupported: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;

      // beta: front-to-back tilt in degrees [-180, 180]
      // gamma: left-to-right tilt in degrees [-90, 90]
      const beta = Math.min(Math.max(e.beta, -45), 45); // Clamp -45 to 45
      const gamma = Math.min(Math.max(e.gamma, -45), 45);

      const tiltX = (beta / 45) * -maxTilt; // Rotate X axis based on front/back tilt
      const tiltY = (gamma / 45) * maxTilt;  // Rotate Y axis based on side tilt

      const glareX = 50 + (gamma / 45) * 50;
      const glareY = 50 + (beta / 45) * 50;

      setTilt({
        tiltX,
        tiltY,
        glareX,
        glareY,
        isSupported: true,
      });
    };

    if ("DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      if ("DeviceOrientationEvent" in window) {
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
    };
  }, [maxTilt]);

  return tilt;
}
