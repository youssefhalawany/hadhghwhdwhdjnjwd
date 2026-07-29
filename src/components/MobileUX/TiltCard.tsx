"use client";

import React from "react";
import { use3DTilt } from "@/lib/use3DTilt";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  enableGlare?: boolean;
}

export function TiltCard({
  children,
  className = "",
  maxTilt = 12,
  enableGlare = true,
}: TiltCardProps) {
  const { tiltX, tiltY, glareX, glareY, isSupported } = use3DTilt(maxTilt);

  const style: React.CSSProperties = isSupported
    ? {
        transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`,
        transition: "transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
        willChange: "transform",
      }
    : {};

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {children}

      {/* Moving Glass Glare Overlay */}
      {enableGlare && isSupported && (
        <div
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`,
          }}
        />
      )}
    </div>
  );
}
