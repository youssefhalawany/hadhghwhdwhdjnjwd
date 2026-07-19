"use client";

import React, { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { playAnalogRollSound } from "@/lib/audioCues";

export function AnalogOdometer({ value, prefix = "", suffix = "", className = "" }: { value: number, prefix?: string, suffix?: string, className?: string }) {
  const [hasMounted, setHasMounted] = useState(false);
  const springValue = useSpring(value, { stiffness: 45, damping: 15, mass: 1 });
  const displayValue = useTransform(springValue, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    
    // Play the analog rolling sound when the target value changes
    playAnalogRollSound();
    
    springValue.set(value);
  }, [value, hasMounted, springValue]);

  if (!hasMounted) {
    return <span className={className}>{prefix}{value.toLocaleString()}{suffix}</span>;
  }

  return (
    <motion.span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}<motion.span>{displayValue}</motion.span>{suffix}
    </motion.span>
  );
}
