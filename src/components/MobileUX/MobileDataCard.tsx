"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";

export interface MobileDataCardProps {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  status: "pending" | "approved" | "rejected" | "alert" | string;
  statusLabel?: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue?: string;
  secondaryLabel?: string;
  badge?: string;
  cashierName?: string;
  branchName?: string;
  details?: Array<{ label: string; value: string | React.ReactNode }>;
  onApprove?: () => void;
  onReject?: () => void;
  onViewDetails?: () => void;
  lang?: "en" | "ar";
}

export function MobileDataCard({
  title,
  subtitle,
  date,
  status,
  statusLabel,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  badge,
  cashierName,
  branchName,
  details = [],
  onApprove,
  onReject,
  onViewDetails,
  lang = "en",
}: MobileDataCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isAr = lang === "ar";

  const getStatusBadge = () => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> {statusLabel || (isAr ? "مكتمل" : "Approved")}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> {statusLabel || (isAr ? "مرفوض" : "Rejected")}
          </span>
        );
      case "alert":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> {statusLabel || (isAr ? "تنبيه" : "Alert")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3" /> {statusLabel || (isAr ? "قيد الانتظار" : "Pending")}
          </span>
        );
    }
  };

  const handleToggle = () => {
    triggerHapticFeedback(8);
    setExpanded(!expanded);
  };

  return (
    <div
      className="w-full mb-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Card Header Top Line */}
      <div className="p-4 cursor-pointer" onClick={handleToggle}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
            {badge && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                {badge}
              </span>
            )}
            {branchName && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                • {branchName}
              </span>
            )}
          </div>
          {date && <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{date}</span>}
        </div>

        {/* Title & Cashier */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">{title}</h4>
            {cashierName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr ? "الكاشير:" : "Cashier:"} <span className="font-semibold text-slate-700 dark:text-slate-300">{cashierName}</span>
              </p>
            )}
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Primary & Secondary Values Highlight Box */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {primaryLabel}
            </span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {primaryValue}
            </span>
          </div>

          {secondaryValue && (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                {secondaryLabel}
              </span>
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                {secondaryValue}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Details Section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 space-y-3"
          >
            {details.length > 0 && (
              <div className="space-y-2 text-xs">
                {details.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/50 dark:border-slate-800/40 last:border-none">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{item.label}</span>
                    <span className="text-slate-900 dark:text-slate-200 font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Action Buttons */}
            {(onApprove || onReject || onViewDetails) && (
              <div className="flex items-center gap-2 pt-2">
                {onApprove && (
                  <button
                    onClick={() => {
                      triggerHapticFeedback([40, 60, 40]);
                      onApprove();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" /> {isAr ? "موافقة" : "Approve"}
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={() => {
                      triggerHapticFeedback(30);
                      onReject();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <XCircle className="w-4 h-4" /> {isAr ? "رفض" : "Reject"}
                  </button>
                )}
                {onViewDetails && (
                  <button
                    onClick={() => {
                      triggerHapticFeedback(12);
                      onViewDetails();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center transition-all active:scale-95"
                  >
                    {isAr ? "التفاصيل" : "Details"}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
