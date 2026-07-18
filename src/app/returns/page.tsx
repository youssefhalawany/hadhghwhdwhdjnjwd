"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Truck, Search, Filter, Plus, ArrowUpRight, ArrowDownRight, Package, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function ReturnsPage() {
  const { language: lang } = useLanguage();
  const isRTL = lang === "ar";
  
  const [searchTerm, setSearchTerm] = useState("");

  const MOCK_RETURNS = [
    { id: "RET-2039", supplier: "Coca-Cola Co.", items: 24, total: 450.50, status: "Pending", date: "2026-07-18" },
    { id: "RET-2038", supplier: "PepsiCo", items: 12, total: 210.00, status: "Completed", date: "2026-07-17" },
    { id: "RET-2037", supplier: "Frito-Lay", items: 48, total: 890.75, status: "Completed", date: "2026-07-15" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Truck size={24} />
            </div>
            {lang === "en" ? "Supplier Returns" : "مرتجعات الموردين"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "en" 
              ? "Manage and track product returns to suppliers." 
              : "إدارة وتتبع مرتجعات المنتجات للموردين."}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold transition-colors shadow-[0_0_15px_rgba(34,211,238,0.3)]">
          <Plus size={18} />
          {lang === "en" ? "New Return" : "مرتجع جديد"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#151E32] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ArrowUpRight size={48} />
          </div>
          <p className="text-sm text-muted-foreground font-semibold mb-1">
            {lang === "en" ? "Total Returns Value" : "إجمالي قيمة المرتجعات"}
          </p>
          <h3 className="text-3xl font-bold text-foreground">£1,551.25</h3>
          <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <ArrowUpRight size={14} /> +12.5% {lang === "en" ? "from last month" : "عن الشهر الماضي"}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#151E32] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Package size={48} />
          </div>
          <p className="text-sm text-muted-foreground font-semibold mb-1">
            {lang === "en" ? "Items Returned" : "العناصر المرتجعة"}
          </p>
          <h3 className="text-3xl font-bold text-foreground">84</h3>
          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
            <ArrowDownRight size={14} /> -5.2% {lang === "en" ? "from last month" : "عن الشهر الماضي"}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#151E32] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Truck size={48} />
          </div>
          <p className="text-sm text-muted-foreground font-semibold mb-1">
            {lang === "en" ? "Pending Pickups" : "في انتظار الاستلام"}
          </p>
          <h3 className="text-3xl font-bold text-foreground">1</h3>
          <p className="text-xs text-cyan-400 mt-2">
            {lang === "en" ? "Requires action" : "يتطلب إجراء"}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[#151E32] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-[#1C2841]/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder={lang === "en" ? "Search returns..." : "البحث في المرتجعات..."}
              className="w-full bg-[#0B1121] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-cyan-500 text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0B1121] border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 transition-colors">
            <Filter size={16} />
            {lang === "en" ? "Filters" : "تصفية"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1C2841] text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Return ID" : "رقم المرتجع"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Supplier" : "المورد"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Items" : "العناصر"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Date" : "التاريخ"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Total Value" : "القيمة الإجمالية"}</th>
                <th className="px-6 py-4 font-semibold">{lang === "en" ? "Status" : "الحالة"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {MOCK_RETURNS.map((ret, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={ret.id} 
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-foreground">{ret.id}</td>
                  <td className="px-6 py-4 text-muted-foreground">{ret.supplier}</td>
                  <td className="px-6 py-4 text-muted-foreground">{ret.items} items</td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-2">
                    <Calendar size={14} className="opacity-50" />
                    {ret.date}
                  </td>
                  <td className="px-6 py-4 font-semibold text-foreground">£{ret.total.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      ret.status === "Pending" 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}>
                      {ret.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
