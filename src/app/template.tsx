"use client";

import { motion } from "framer-motion";

export default function CashierTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.98 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20, 
        mass: 0.5 
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
