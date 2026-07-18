"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Activity, TrendingUp, TrendingDown, DollarSign, Percent, PieChart, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function MarginStrategyPage() {
  const { language: lang } = useLanguage();
  const isRTL = lang === "ar";

  const MARGIN_DATA = [
    { category: "Beverages", margin: 45.2, target: 40.0, trend: "up", revenue: "£12,450" },
    { category: "Snacks", margin: 38.5, target: 45.0, trend: "down", revenue: "£8,320" },
    { category: "Tobacco", margin: 12.4, target: 12.0, trend: "up", revenue: "£24,100" },
    { category: "Fresh Food", margin: 52.1, target: 50.0, trend: "up", revenue: "£4,500" },
    { category: "Services", margin: 85.0, target: 80.0, trend: "up", revenue: "£1,200" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Activity size={24} />
            </div>
            {lang === "en" ? "Margin Strategy" : "استراتيجية الهامش"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "en" 
              ? "Analyze profit margins and pricing strategies across categories." 
              : "تحليل هوامش الربح واستراتيجيات التسعير عبر الفئات."}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#1C2841] hover:bg-[#2A3B5C] border border-white/10 text-white rounded-xl font-semibold transition-colors">
          <PieChart size={18} />
          {lang === "en" ? "Generate Report" : "إنشاء تقرير"}
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 border border-emerald-500/20">
          <p className="text-sm text-emerald-400/80 font-semibold mb-1 flex items-center gap-2">
            <Percent size={16} />
            {lang === "en" ? "Avg. Gross Margin" : "متوسط الهامش الإجمالي"}
          </p>
          <h3 className="text-3xl font-bold text-emerald-400">32.4%</h3>
          <p className="text-xs text-emerald-400/60 mt-2">
            +1.2% {lang === "en" ? "vs last quarter" : "مقارنة بالربع الماضي"}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#151E32] border border-white/5">
          <p className="text-sm text-muted-foreground font-semibold mb-1 flex items-center gap-2">
            <DollarSign size={16} />
            {lang === "en" ? "Gross Profit" : "إجمالي الربح"}
          </p>
          <h3 className="text-3xl font-bold text-foreground">£16,384.20</h3>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp size={14} /> +4.5% {lang === "en" ? "vs last quarter" : "مقارنة بالربع الماضي"}
          </p>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-[#151E32] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#1C2841]/50">
          <h3 className="font-bold text-foreground">
            {lang === "en" ? "Category Performance" : "أداء الفئات"}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info size={14} />
            {lang === "en" ? "Target margins vary by category" : "هوامش الهدف تختلف حسب الفئة"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1C2841] text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Category" : "الفئة"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Revenue" : "الإيرادات"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Current Margin" : "الهامش الحالي"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Target Margin" : "الهامش المستهدف"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Status" : "الحالة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MARGIN_DATA.map((cat, idx) => {
                const diff = cat.margin - cat.target;
                const isUnderperforming = diff < 0;
                
                return (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={cat.category} 
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 font-semibold text-foreground">{cat.category}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cat.revenue}</td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {cat.margin.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{cat.target.toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                        isUnderperforming ? "text-red-400" : "text-emerald-400"
                      }`}>
                        {isUnderperforming ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                        {Math.abs(diff).toFixed(1)}%
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
