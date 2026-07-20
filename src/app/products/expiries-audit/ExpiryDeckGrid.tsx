"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Clock, Package, ArchiveRestore, Trash2 } from 'lucide-react';
import { RubberStamp } from '@/components/SkeuomorphicUX/RubberStamp';
import { playStampSound } from '@/lib/audioCues';

interface ExpiryDeckGridProps {
  items: any[];
  searchQuery?: string;
  onAuditAction: (item: any, action: "destroy" | "return") => Promise<void>;
}

export function ExpiryDeckGrid({ items, searchQuery, onAuditAction }: ExpiryDeckGridProps) {
  // Group identical items by barcode (or itemName if no barcode)
  const stackedGroups = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      const key = item.barcode && item.barcode !== "N/A" ? item.barcode : item.itemName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Sort items within each group by expiry date (closest first)
    const sortedGroups = Object.values(groups).map(group => {
      group.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      return group;
    });
    // Sort groups globally so the one with the earliest expiry date is at the top of the feed
    sortedGroups.sort((groupA, groupB) => new Date(groupA[0].expiryDate).getTime() - new Date(groupB[0].expiryDate).getTime());
    return sortedGroups;
  }, [items]);

  return (
    <div className="relative w-full min-h-[500px] p-4">
      {/* Laser Scanner Effect */}
      <AnimatePresence>
        {searchQuery && searchQuery.length > 0 && (
          <motion.div 
            initial={{ top: 0, opacity: 0 }}
            animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
            className="absolute left-0 w-full h-1 bg-red-500 z-50 shadow-[0_0_20px_rgba(239,68,68,0.8)] pointer-events-none"
            style={{ boxShadow: "0 0 15px 2px rgba(239, 68, 68, 0.8), 0 0 5px 1px rgba(255, 255, 255, 0.5)" }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative">
        <AnimatePresence>
          {stackedGroups.map(group => (
            <DeckStack key={group[0].barcode || group[0].itemName} group={group} onAuditAction={onAuditAction} />
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-20 text-slate-400">
            <Package size={48} className="mb-4 opacity-20" />
            <p className="font-bold">No active expiries tracked.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeckStack({ group, onAuditAction }: { group: any[], onAuditAction: (item: any, action: "destroy" | "return") => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative w-full" style={{ height: expanded ? group.length * 280 : 280 }} onClick={() => setExpanded(!expanded)}>
      <AnimatePresence>
        {group.map((item, index) => {
          if (!expanded && index > 2) return null;
          return (
            <SwipeableExpiryCard 
              key={item.id} 
              item={item} 
              index={index} 
              totalInGroup={group.length}
              isExpanded={expanded}
              onAuditAction={onAuditAction} 
            />
          );
        })}
      </AnimatePresence>
      {!expanded && group.length > 1 && (
        <div className="absolute -bottom-3 right-4 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg z-40 border border-slate-700">
          +{group.length - 1} MORE
        </div>
      )}
    </div>
  );
}

function SwipeableExpiryCard({ item, index, totalInGroup, isExpanded, onAuditAction }: any) {
  const controls = useAnimation();
  const [stamp, setStamp] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [stampText, setStampText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const itemDate = new Date(item.expiryDate);
  itemDate.setHours(0,0,0,0);
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffTime = itemDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let statusColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
  let urgencyLevel = "safe";
  if (diffDays <= 0) {
    statusColor = "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]";
    urgencyLevel = "critical";
  } else if (diffDays <= 7) {
    statusColor = "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]";
    urgencyLevel = "soon";
  }

  
  const handleButtonClick = async (e: React.MouseEvent, action: "destroy" | "return") => {
    e.stopPropagation();
    if (isProcessing) return;
    setIsProcessing(true);
    
    if (action === "destroy") {
      setStamp("REJECTED");
      setStampText("PULLED");
      controls.start({ x: 500, opacity: 0, transition: { duration: 0.5, delay: 0.8 } });
      await new Promise(r => setTimeout(r, 800));
      await onAuditAction(item, "destroy");
    } else {
      setStamp("APPROVED");
      setStampText("RETURNED");
      controls.start({ x: -500, opacity: 0, transition: { duration: 0.5, delay: 0.8 } });
      await new Promise(r => setTimeout(r, 800));
      await onAuditAction(item, "return");
    }
  };

  const handleDragEnd = async (event: any, info: any) => {
    if (isProcessing) return;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    
    if (offset > 100 || velocity > 500) {
      setIsProcessing(true);
      setStamp("REJECTED");
      setStampText("PULLED");
      controls.start({ x: 500, opacity: 0, transition: { duration: 0.5, delay: 0.8 } });
      await new Promise(r => setTimeout(r, 800));
      await onAuditAction(item, "destroy");
    } else if (offset < -100 || velocity < -500) {
      setIsProcessing(true);
      setStamp("APPROVED");
      setStampText("RETURNED");
      controls.start({ x: -500, opacity: 0, transition: { duration: 0.5, delay: 0.8 } });
      await new Promise(r => setTimeout(r, 800));
      await onAuditAction(item, "return");
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
    }
  };

  const stackOffset = isExpanded ? index * 280 : index * 8;
  const zIndex = 30 - index;
  const scale = isExpanded ? 1 : 1 - (index * 0.05);
  const opacity = isExpanded ? 1 : 1 - (index * 0.2);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ scale: 0.8, opacity: 0, y: 50 }}
      whileInView={{ scale, opacity, y: stackOffset }}
      exit={{ scale: 0.5, opacity: 0 }}
      style={{ zIndex }}
      className={`absolute top-0 left-0 w-full h-[260px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-grab active:cursor-grabbing ${urgencyLevel === 'critical' ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}`}
    >
      <RubberStamp stampType={stamp} stampText={stampText} className="w-full h-full absolute inset-0">
        <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2 w-full overflow-hidden">
              <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-slate-100 line-clamp-2 pr-2">{item.itemName}</h3>
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-500 whitespace-nowrap">
                {item.quantity} UNITS
              </div>
            </div>
            <p className="text-xs font-mono text-slate-400 mb-4 tracking-wider">{item.barcode}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Expiry Date</p>
                <p className={`font-black ${diffDays <= 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{item.expiryDate}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Store / Branch</p>
                <p className="font-bold text-xs text-slate-700 dark:text-slate-300 leading-tight">{item.storeId || "Unknown"}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 px-1">
              <span className="text-[10px] font-bold text-slate-400">Shelf Life Progress</span>
              <span className={`text-[10px] font-black ${diffDays <= 0 ? 'text-red-500' : 'text-slate-500'}`}>
                {diffDays <= 0 ? 'EXPIRED' : `${diffDays} Days`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(5, Math.min(100, (diffDays / 30) * 100))}%` }}
                className={`h-full rounded-full ${statusColor}`}
              />
            </div>
            
            <div className="flex justify-between mt-3 gap-2">
              <button 
                onClick={(e) => handleButtonClick(e, "return")}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-1.5 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
              >
                <ArchiveRestore size={14} /> Return
              </button>
              <button 
                onClick={(e) => handleButtonClick(e, "destroy")}
                disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 py-1.5 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
              >
                Pull <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </RubberStamp>
    </motion.div>
  );
}
