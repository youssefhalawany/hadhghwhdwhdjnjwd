"use client";

import { motion } from "framer-motion";

interface ActivityRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  icon?: React.ReactNode;
}

export function ActivityRing({ 
  progress, 
  size = 64, 
  strokeWidth = 6, 
  color = "#22d3ee", 
  bgColor = "rgba(34, 211, 238, 0.15)",
  icon
}: ActivityRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.max(0, Math.min(1, progress)) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Ring */}
      <svg width={size} height={size} className="absolute transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      {/* Inner Icon / Content */}
      <div className="absolute flex flex-col items-center justify-center text-white">
        {icon}
      </div>
    </div>
  );
}
