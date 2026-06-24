"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface PageWrapperProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = "", ...props }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-screen ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
