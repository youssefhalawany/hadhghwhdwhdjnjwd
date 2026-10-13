"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Building2,
  Search,
  RefreshCw,
  Wallet,
  FileText,
  Truck,
  AlertCircle,
  CreditCard,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  Zap,
  Package,
  Receipt,
  BadgeCheck,
  Phone,
  UserCheck,
  Landmark,
  TrendingUp,
  PieChart,
  ShieldCheck,
  Eye,
  Copy,
  PlusCircle,
  ArrowUpRight,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { toast } from "sonner";
import {
  CompanyProfile,
  CompanyEvent,
  CompaniesLedgerSummary,
  loadCompaniesFromLocalCache,
  syncCompaniesProfiles,
} from "@/lib/companiesLedgerService";
import { exportToExcel } from "@/lib/excel-generator";
import QRCode from "react-qr-code";

export default function CompaniesProfilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("company") || "";

  const { language } = useLanguage();
  const isAr = language === "ar";

  // Data states
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [summary, setSummary] = useState<CompaniesLedgerSummary | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStep, setSyncStep] = useState<string>("");

  // Master-Detail selection & search
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [listFilter, setListFilter] = useState<"all" | "debt" | "cleared" | "returns">("all");
  const [detailTab, setDetailTab] = useState<"all" | "payments" | "credits" | "returns" | "expiries">("all");
  const [detailQuery, setDetailQuery] = useState<string>("");

  // Printable modal & detail modal & lightbox
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const [selectedEventForPreview, setSelectedEventForPreview] = useState<CompanyEvent | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // 1. Initial Load: Instant local cache load
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const cached = await loadCompaniesFromLocalCache();
        if (cached && cached.profiles && cached.profiles.length > 0) {
          if (!isMounted) return;
          setProfiles(cached.profiles);
          setSummary(cached.summary);
          setLastSyncedAt(cached.cachedAt);
          setIsFromCache(true);
          setLoading(false);
          // Auto select first company if none selected on desktop
          if (!selectedCompanyId && cached.profiles.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
            setSelectedCompanyId(cached.profiles[0].id);
          }
          return;
        }

        // Initial sync if no cache
        await handleSync(false);
      } catch (err) {
        console.error("Initial load error:", err);
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync with URL query parameter
  useEffect(() => {
    const paramCompany = searchParams.get("company");
    if (paramCompany && paramCompany !== selectedCompanyId) {
      setSelectedCompanyId(paramCompany);
    }
  }, [searchParams]);

  // Sync handler
  const handleSync = async (notify = true) => {
    setSyncing(true);
    setSyncStep(isAr ? "جاري تدقيق وقراءة السجلات..." : "Refreshing ledgers...");
    try {
      const result = await syncCompaniesProfiles((step) => {
        setSyncStep(step);
      });
      setProfiles(result.profiles);
      setSummary(result.summary);
      setLastSyncedAt(result.summary.lastSyncedAt);
      setIsFromCache(false);
      if (!selectedCompanyId && result.profiles.length > 0) {
        setSelectedCompanyId(result.profiles[0].id);
      }
      if (notify) {
        toast.success(
          isAr
            ? `تم تحديث وحفظ بيانات ${result.profiles.length} شركة محلياً بنجاح`
            : `Successfully synced & cached ${result.profiles.length} companies`
        );
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error(isAr ? "فشل تحديث البيانات، يرجى المحاولة لاحقاً" : "Failed to sync data");
    } finally {
      setSyncing(false);
      setLoading(false);
      setSyncStep("");
    }
  };

  // Active selected company
  const activeCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return profiles.find((p) => p.id === selectedCompanyId) || null;
  }, [profiles, selectedCompanyId]);

  // Filtered companies list for the left panel
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      if (q) {
        const inName = p.name.toLowerCase().includes(q);
        const inAlias = p.aliases.some((a) => a.toLowerCase().includes(q));
        const inEvents = p.events.some(
          (e) =>
            (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(q)) ||
            (e.poNumber && e.poNumber.toLowerCase().includes(q)) ||
            (e.returnNumber && e.returnNumber.toLowerCase().includes(q))
        );
        if (!inName && !inAlias && !inEvents) return false;
      }
      if (listFilter === "debt" && p.remainingCredit <= 0) return false;
      if (listFilter === "cleared" && (p.remainingCredit > 0 || p.totalInvoiced === 0)) return false;
      if (listFilter === "returns" && p.totalReturnsCount === 0) return false;
      return true;
    });
  }, [profiles, searchQuery, listFilter]);

  // Active company's filtered events
  const filteredEvents = useMemo(() => {
    if (!activeCompany) return [];
    const q = detailQuery.trim().toLowerCase();
    return activeCompany.events.filter((e) => {
      if (detailTab === "payments" && e.type !== "payment") return false;
      if (detailTab === "credits" && e.type !== "credit") return false;
      if (detailTab === "returns" && e.type !== "return") return false;
      if (detailTab === "expiries" && e.type !== "expiry") return false;

      if (q) {
        const inTitle = (e.title || "").toLowerCase().includes(q) || (e.titleAr || "").toLowerCase().includes(q);
        const inInv = (e.invoiceNumber || "").toLowerCase().includes(q);
        const inPo = (e.poNumber || "").toLowerCase().includes(q);
        const inRet = (e.returnNumber || "").toLowerCase().includes(q);
        const inItem = (e.itemName || "").toLowerCase().includes(q);
        const inNotes = (e.notes || "").toLowerCase().includes(q);
        if (!inTitle && !inInv && !inPo && !inRet && !inItem && !inNotes) return false;
      }
      return true;
    });
  }, [activeCompany, detailTab, detailQuery]);

  // Currency formatter
  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);

  // Clean Avatar initials
  const getInitials = (name: string) => {
    if (!name) return "CO";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Excel Export
  const handleExportExcel = async () => {
    if (!activeCompany) return;
    try {
      const rows = activeCompany.events.map((e) => ({
        date: e.date,
        type: e.type.toUpperCase(),
        title: e.titleAr || e.title,
        amount: e.amount,
        invoiceNumber: e.invoiceNumber || "-",
        poNumber: e.poNumber || "-",
        returnNumber: e.returnNumber || "-",
        method: e.method || "-",
        item: e.itemName || "-",
        qty: e.quantity || "-",
        notes: e.notes || "-",
      }));

      await exportToExcel({
        title: `كشف حساب شركة: ${activeCompany.name}`,
        subtitle: `سجل التعاملات المعتمد والمدفوعات والآجل والمرتجعات والتوالف`,
        sheetName: "Statement",
        creator: "Circle K Finance Engine",
        columns: [
          { header: "التاريخ (Date)", key: "date", width: 14 },
          { header: "النوع (Type)", key: "type", width: 12 },
          { header: "البيان (Description)", key: "title", width: 28 },
          { header: "المبلغ (Amount)", key: "amount", width: 16, isCurrency: true },
          { header: "رقم الفاتورة (Invoice #)", key: "invoiceNumber", width: 18 },
          { header: "رقم الـ PO", key: "poNumber", width: 16 },
          { header: "رقم المرتجع (RTV)", key: "returnNumber", width: 16 },
          { header: "طريقة السداد", key: "method", width: 14 },
          { header: "الصنف", key: "item", width: 22 },
          { header: "الكمية", key: "qty", width: 10 },
          { header: "ملاحظات", key: "notes", width: 26 },
        ],
        data: rows,
      });
      toast.success(isAr ? "تم تصدير ملف الإكسل بنجاح" : "Excel exported successfully");
    } catch (e) {
      console.error(e);
      toast.error(isAr ? "فشل تصدير الإكسل" : "Failed to export");
    }
  };

  return (
    <div
      className="min-h-screen text-slate-100 bg-[#090D16] selection:bg-cyan-500/30 selection:text-cyan-200"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* 1. TOP MINIMALIST HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B101D]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Brand & Section Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-wide">
                  {isAr ? "سجل وملفات الشركات" : "Companies Profiles & Ledger"}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.04] text-slate-400 border border-white/5">
                  {profiles.length} {isAr ? "شركة" : "companies"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {isAr
                  ? "السجل المالي الشامل: مدفوعات نقدية وبنكية، فواتير آجل، مرتجعات، وتوالف صلاحيات"
                  : "Unified ledger of all vendor transactions, disbursements, and statements"}
              </p>
            </div>
          </div>

          {/* Cache Status & Actions */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                isFromCache
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
              }`}
              title={lastSyncedAt ? `Synced: ${new Date(lastSyncedAt).toLocaleTimeString()}` : ""}
            >
              <Zap className="w-3 h-3" />
              <span>{isAr ? "محفوظ محلياً (0 قراءات)" : "Offline Cached"}</span>
            </div>

            <button
              onClick={() => handleSync(true)}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-xs font-bold border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-cyan-400" : ""}`} />
              <span className="hidden sm:inline">{syncing ? (isAr ? "جاري التحديث..." : "Syncing...") : isAr ? "تحديث" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {syncing && syncStep && (
          <div className="max-w-[1600px] mx-auto mt-2 pt-2 border-t border-white/5 flex items-center gap-2 text-xs text-cyan-400 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>{syncStep}</span>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE (SPLIT VIEW) */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center animate-spin">
              <Building2 className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-xs font-bold text-slate-400">
              {isAr ? "جاري تحميل سجل الشركات محلياً..." : "Loading company profiles..."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ================= LEFT PANEL: DIRECTORY LIST ================= */}
            <div
              className={`lg:col-span-4 xl:col-span-4 space-y-3 ${
                activeCompany && "hidden lg:block"
              }`}
            >
              {/* Search & Filter in list */}
              <div className="p-3.5 rounded-2xl bg-[#0E1424] border border-white/[0.06] shadow-xl space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? "ابحث بالشركة، الفاتورة، أو PO..." : "Search company, invoice, PO..."}
                    className="w-full pl-9 pr-8 rtl:pl-8 rtl:pr-9 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-2.5 p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  {[
                    { id: "all", label: isAr ? "الكل" : "All" },
                    { id: "debt", label: isAr ? "عليه ذمم" : "With Debt" },
                    { id: "cleared", label: isAr ? "خالص" : "Cleared" },
                    { id: "returns", label: isAr ? "مرتجعات" : "Returns" },
                  ].map((f) => {
                    const isActive = listFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          triggerHapticFeedback(10);
                          setListFilter(f.id as any);
                        }}
                        className={`px-3 py-1 rounded-lg font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                          isActive
                            ? "bg-white text-slate-950 font-black shadow-sm"
                            : "bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                  <span className="text-[10px] text-slate-500 ml-auto rtl:ml-0 rtl:mr-auto font-mono">
                    {filteredProfiles.length}
                  </span>
                </div>
              </div>

              {/* Company List Scroll Area */}
              <div className="space-y-1.5 max-h-[calc(100vh-210px)] overflow-y-auto pr-1 rtl:pr-0 rtl:pl-1 no-scrollbar">
                {filteredProfiles.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#0E1424] border border-white/[0.06] text-slate-400">
                    <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">
                      {isAr ? "لم يتم العثور على شركات مطابقة" : "No companies found"}
                    </p>
                  </div>
                ) : (
                  filteredProfiles.map((company) => {
                    const isSelected = activeCompany?.id === company.id;
                    const hasDebt = company.remainingCredit > 0;
                    return (
                      <div
                        key={company.id}
                        onClick={() => {
                          triggerHapticFeedback(10);
                          setSelectedCompanyId(company.id);
                          router.replace(`/financials/companies-profiles?company=${company.id}`);
                          setDetailTab("all");
                        }}
                        className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-[#141E34] border-cyan-400/50 shadow-lg shadow-cyan-500/10 text-white"
                            : "bg-[#0E1424]/90 hover:bg-[#121A2E] border-white/[0.05] hover:border-white/10 text-slate-300"
                        }`}
                      >
                        {/* Company Monogram & Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                              isSelected
                                ? "bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30"
                                : "bg-white/[0.05] text-slate-300 border border-white/5"
                            }`}
                          >
                            {getInitials(company.name)}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <h3 className="text-xs font-bold text-white truncate">{company.name}</h3>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span>
                                {company.activityCount} {isAr ? "حركة" : "tx"}
                              </span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {company.lastActivityDate || "-"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Status / Balance Badge */}
                        <div className="text-right rtl:text-left shrink-0">
                          {hasDebt ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/25">
                              {fmt(company.remainingCredit)} <span className="text-[9px]">ج.م</span>
                            </span>
                          ) : company.totalInvoiced > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                              {isAr ? "خالص" : "Cleared"}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/[0.04] text-slate-400">
                              {isAr ? "نقدي" : "Cash"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ================= RIGHT PANEL: DETAILED DOSSIER ================= */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-4">
              {activeCompany ? (
                <div className="space-y-4">
                  {/* Top Mobile Back Button (on small screens only) */}
                  <div className="lg:hidden">
                    <button
                      onClick={() => {
                        triggerHapticFeedback(10);
                        setSelectedCompanyId("");
                        router.replace(`/financials/companies-profiles`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] text-slate-300 text-xs font-bold border border-white/10"
                    >
                      {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                      <span>{isAr ? "العودة للشركات" : "Back to Directory"}</span>
                    </button>
                  </div>

                  {/* Company Hero Dossier Card */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-[#0E1424] border border-white/[0.07] shadow-2xl relative overflow-hidden space-y-5">
                    {/* Header: Title + Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-base font-black shadow-lg shadow-cyan-500/20 shrink-0">
                          {getInitials(activeCompany.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-white">{activeCompany.name}</h2>
                            <BadgeCheck className="w-4 h-4 text-cyan-400" />
                          </div>
                          {activeCompany.aliases.length > 1 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              <span className="text-slate-500 font-bold">{isAr ? "معرفات مسجلة: " : "Aliases: "}</span>
                              {activeCompany.aliases.slice(0, 4).join(" • ")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportExcel}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isAr ? "Excel" : "Excel"}</span>
                        </button>

                        <button
                          onClick={() => setShowStatementModal(true)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isAr ? "كشف حساب معتمد A4" : "Print Statement"}</span>
                        </button>
                      </div>
                    </div>

                    {/* 3 High-Impact Financial Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Total Paid */}
                      <div className="p-3.5 rounded-2xl bg-[#090E1A] border border-white/5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold mb-1">
                          <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isAr ? "إجمالي المسدد" : "Total Paid"}</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-emerald-400">
                          {fmt(activeCompany.totalPaid)} <span className="text-xs text-slate-500 font-normal">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {activeCompany.paymentCount} {isAr ? "سند سداد" : "vouchers"}
                        </div>
                      </div>

                      {/* Total Invoiced Credits */}
                      <div className="p-3.5 rounded-2xl bg-[#090E1A] border border-white/5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold mb-1">
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isAr ? "إجمالي الآجل والتوريدات" : "Total Invoiced"}</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-amber-400">
                          {fmt(activeCompany.totalInvoiced)} <span className="text-xs text-slate-500 font-normal">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {activeCompany.creditCount} {isAr ? "فاتورة آجل" : "invoices"}
                        </div>
                      </div>

                      {/* Remaining Outstanding Balance */}
                      <div className="p-3.5 rounded-2xl bg-[#090E1A] border border-white/5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold mb-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>{isAr ? "الرصيد المتبقي المستحق" : "Balance Due"}</span>
                        </div>
                        <div
                          className={`text-lg sm:text-xl font-black ${
                            activeCompany.remainingCredit > 0 ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {fmt(activeCompany.remainingCredit)} <span className="text-xs text-slate-500 font-normal">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {activeCompany.remainingCredit > 0
                            ? isAr
                              ? "مطلوب سداده للمورد"
                              : "Payable"
                            : isAr
                            ? "الذمة مسددة بالكامل"
                            : "Fully Settled"}
                        </div>
                      </div>
                    </div>

                    {/* 1. Quick Financial Actions (1-Click Settle & New PO/Credit) */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/5">
                      {activeCompany.remainingCredit > 0 ? (
                        <Link
                          href={`/financials/inputs/payments?companyName=${encodeURIComponent(activeCompany.name)}&amount=${activeCompany.remainingCredit}`}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-black text-xs shadow-lg shadow-rose-500/20 transition-all cursor-pointer group"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
                          <span>{isAr ? "سداد الرصيد المستحق (1-Click Settle)" : "Settle Balance (1-Click)"}</span>
                          <span className="px-2 py-0.5 rounded-md bg-black/30 font-mono text-[11px] text-white">
                            {fmt(activeCompany.remainingCredit)} ج.م
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                      ) : (
                        <Link
                          href={`/financials/inputs/payments?companyName=${encodeURIComponent(activeCompany.name)}`}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{isAr ? "تسجيل سند سداد جديد" : "Log New Payment"}</span>
                        </Link>
                      )}

                      <Link
                        href={`/financials/inputs/credits?companyName=${encodeURIComponent(activeCompany.name)}`}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/10 hover:border-white/20 font-bold text-xs transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isAr ? "تسجيل فاتورة آجل جديدة (New PO)" : "New Credit Invoice / PO"}</span>
                      </Link>
                    </div>

                    {/* Secondary pills for returns and expiries if present */}
                    {(activeCompany.totalReturnsValue > 0 || activeCompany.totalExpiriesValue > 0) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-xs text-slate-400">
                        {activeCompany.totalReturnsValue > 0 && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[11px] font-bold">
                            <Truck className="w-3.5 h-3.5" />
                            <span>
                              {isAr ? "إجمالي المرتجعات:" : "Returns:"} {fmt(activeCompany.totalReturnsValue)} ج.م (
                              {activeCompany.totalReturnsCount} قطعة)
                            </span>
                          </span>
                        )}

                        {activeCompany.totalExpiriesValue > 0 && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-bold">
                            <Package className="w-3.5 h-3.5" />
                            <span>
                              {isAr ? "توالف الصلاحيات:" : "Expiries:"} {fmt(activeCompany.totalExpiriesValue)} ج.م (
                              {activeCompany.totalExpiriesCount} صنف)
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Verified Contacts & Delivery Reps & Banking Dossier */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card A: Verified Contacts & Delivery Reps */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-white/[0.06] shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-black text-white">
                          <UserCheck className="w-4 h-4 text-cyan-400" />
                          <span>{isAr ? "المندوبون وسائقو الاستلام المعتمدون" : "Verified Contacts & Delivery Reps"}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
                          {activeCompany.contacts.length} {isAr ? "جهة اتصال" : "contacts"}
                        </span>
                      </div>

                      {activeCompany.contacts.length === 0 ? (
                        <div className="py-6 text-center text-slate-500 text-xs">
                          <UserCheck className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
                          <p className="font-medium">
                            {isAr
                              ? "يتم استخراج أرقام المندوبين والسائقين تلقائياً عند تسجيل السندات والمرتجعات"
                              : "Contacts are auto-aggregated from payment & return receipts"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
                          {activeCompany.contacts.map((c, idx) => (
                            <div
                              key={`${c.name}_${idx}`}
                              className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white truncate">{c.name}</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold whitespace-nowrap">
                                    {c.role}
                                  </span>
                                </div>
                                {c.nationalId && (
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {isAr ? "الرقم القومي: " : "National ID: "}
                                    <span className="text-slate-300 font-bold">{c.nationalId}</span>
                                  </p>
                                )}
                                {c.lastSeenDate && (
                                  <p className="text-[9px] text-slate-500">
                                    {isAr ? "آخر تعامل: " : "Last seen: "}
                                    {c.lastSeenDate}
                                  </p>
                                )}
                              </div>

                              {c.phone ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 font-mono font-bold text-[11px] transition-colors"
                                    title={isAr ? "اتصال فوري" : "Call"}
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{c.phone}</span>
                                  </a>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(c.phone || "");
                                      triggerHapticFeedback(10);
                                      toast.success(isAr ? "تم نسخ رقم الهاتف" : "Phone copied");
                                    }}
                                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                    title={isAr ? "نسخ الرقم" : "Copy"}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 italic">{isAr ? "بدون هاتف" : "No phone"}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card B: Official Banking Dossier */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-white/[0.06] shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-black text-white">
                          <Landmark className="w-4 h-4 text-emerald-400" />
                          <span>{isAr ? "الحساب البنكي والتحويلات الرقمية" : "Official Banking & Wire Transfer Dossier"}</span>
                        </div>
                        {activeCompany.bankingInfo?.lastTransferReceiptUrl && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{isAr ? "إيصال مرفق" : "Receipt On File"}</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04]">
                            <span className="text-[10px] text-slate-500 block mb-0.5">{isAr ? "اسم البنك" : "Bank Name"}</span>
                            <span className="font-bold text-white truncate block">
                              {activeCompany.bankingInfo?.bankName || (isAr ? "غير محدد" : "Not specified")}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04]">
                            <span className="text-[10px] text-slate-500 block mb-0.5">{isAr ? "اسم المستفيد" : "Beneficiary"}</span>
                            <span className="font-bold text-white truncate block">
                              {activeCompany.bankingInfo?.beneficiaryName || activeCompany.name}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">{isAr ? "رقم الحساب / الآيبان" : "Account Number / IBAN"}</span>
                            <span className="font-mono font-bold text-emerald-400 text-[11px] block">
                              {activeCompany.bankingInfo?.accountNumber || (isAr ? "لم يُسجل بالتحويلات السابقة" : "Not logged")}
                            </span>
                          </div>
                          {activeCompany.bankingInfo?.accountNumber && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(activeCompany.bankingInfo?.accountNumber || "");
                                triggerHapticFeedback(10);
                                toast.success(isAr ? "تم نسخ رقم الحساب" : "Account copied");
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title={isAr ? "نسخ" : "Copy"}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 block">{isAr ? "إجمالي التحويلات البنكية المنفذة" : "Total Wire Transferred"}</span>
                            <span className="font-black text-white text-sm">
                              {fmt(activeCompany.bankingInfo?.totalTransferred || 0)} <span className="text-[10px] text-slate-500">ج.م</span>
                            </span>
                          </div>

                          {activeCompany.bankingInfo?.lastTransferReceiptUrl && (
                            <button
                              onClick={() =>
                                setPreviewImage({
                                  url: activeCompany.bankingInfo!.lastTransferReceiptUrl!,
                                  title: isAr ? `إشعار التحويل البنكي - ${activeCompany.name}` : `Bank Transfer Slip - ${activeCompany.name}`,
                                })
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isAr ? "معاينة إيصال التحويل" : "View Transfer Slip"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Vendor Spending & Payment Analytics */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Monthly Spending Trend Chart */}
                    <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-white/[0.06] shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-black text-white">
                          <TrendingUp className="w-4 h-4 text-cyan-400" />
                          <span>{isAr ? "حركة المشتريات والسداد الشهرية (آخر الفترات)" : "Monthly Purchases vs. Disbursements Trend"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                          <span className="flex items-center gap-1 text-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            {isAr ? "التوريدات" : "Invoiced"}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            {isAr ? "المسدد" : "Paid"}
                          </span>
                        </div>
                      </div>

                      {activeCompany.monthlySpend.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          <p>{isAr ? "لا توجد بيانات شهرية كافية للرسم البياني" : "Not enough monthly records for trend chart"}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {(() => {
                            const points = activeCompany.monthlySpend.slice(-6); // last 6 active months
                            const maxVal = Math.max(1, ...points.map((p) => Math.max(p.invoiced, p.paid)));
                            return (
                              <div className="space-y-2.5">
                                {points.map((pt) => {
                                  const invPct = Math.round((pt.invoiced / maxVal) * 100);
                                  const paidPct = Math.round((pt.paid / maxVal) * 100);
                                  return (
                                    <div key={pt.month} className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="font-bold text-slate-300">{pt.monthLabel}</span>
                                        <span className="text-slate-400 text-[10px]">
                                          {isAr ? "توريد: " : "Inv: "}
                                          <span className="text-amber-400 font-bold">{fmt(pt.invoiced)}</span>
                                          {" • "}
                                          {isAr ? "سداد: " : "Paid: "}
                                          <span className="text-emerald-400 font-bold">{fmt(pt.paid)}</span>
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        {/* Invoiced Bar */}
                                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex" title={`${isAr ? "توريدات: " : "Invoiced: "} ${fmt(pt.invoiced)} EGP`}>
                                          <div
                                            style={{ width: `${Math.max(pt.invoiced > 0 ? 2 : 0, invPct)}%` }}
                                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                                          />
                                        </div>
                                        {/* Paid Bar */}
                                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex" title={`${isAr ? "مسدد: " : "Paid: "} ${fmt(pt.paid)} EGP`}>
                                          <div
                                            style={{ width: `${Math.max(pt.paid > 0 ? 2 : 0, paidPct)}%` }}
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Payment Methods Breakdown */}
                    <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-white/[0.06] shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-black text-white">
                          <PieChart className="w-4 h-4 text-purple-400" />
                          <span>{isAr ? "توزيع طرق السداد (نقدي vs بنكي)" : "Payment Methods & Channel Split"}</span>
                        </div>
                      </div>

                      {(() => {
                        const total = activeCompany.totalPaid || 1;
                        const cashPct = Math.round((activeCompany.paymentMethods.cash / total) * 100);
                        const bankPct = Math.round((activeCompany.paymentMethods.bankTransfer / total) * 100);
                        const chqPct = Math.round((activeCompany.paymentMethods.cheque / total) * 100);
                        const digitalPct = bankPct + chqPct;

                        return (
                          <div className="space-y-4 pt-1 text-xs">
                            {/* Progress Split Bar */}
                            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex gap-0.5">
                              <div style={{ width: `${cashPct}%` }} className="bg-emerald-500 transition-all" title={`Cash: ${cashPct}%`} />
                              <div style={{ width: `${bankPct}%` }} className="bg-cyan-500 transition-all" title={`Bank: ${bankPct}%`} />
                              <div style={{ width: `${chqPct}%` }} className="bg-purple-500 transition-all" title={`Cheque: ${chqPct}%`} />
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                              <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                  <span className="font-bold text-white">{isAr ? "نقداً من الخزينة" : "Cash (Safe)"}</span>
                                </div>
                                <div className="text-right rtl:text-left font-mono">
                                  <span className="font-bold text-emerald-400">{fmt(activeCompany.paymentMethods.cash)} ج.م</span>
                                  <span className="text-[10px] text-slate-500 ml-1.5 rtl:ml-0 rtl:mr-1.5">({cashPct}%)</span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                  <span className="font-bold text-white">{isAr ? "تحويل بنكي إلكتروني" : "Bank Transfer"}</span>
                                </div>
                                <div className="text-right rtl:text-left font-mono">
                                  <span className="font-bold text-cyan-400">{fmt(activeCompany.paymentMethods.bankTransfer)} ج.م</span>
                                  <span className="text-[10px] text-slate-500 ml-1.5 rtl:ml-0 rtl:mr-1.5">({bankPct}%)</span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-[#090E1A] border border-white/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                  <span className="font-bold text-white">{isAr ? "شيكات بنكية" : "Cheques"}</span>
                                </div>
                                <div className="text-right rtl:text-left font-mono">
                                  <span className="font-bold text-purple-400">{fmt(activeCompany.paymentMethods.cheque)} ج.م</span>
                                  <span className="text-[10px] text-slate-500 ml-1.5 rtl:ml-0 rtl:mr-1.5">({chqPct}%)</span>
                                </div>
                              </div>
                            </div>

                            {/* Digital vs Cash summary tag */}
                            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">{isAr ? "نسبة الدفع الإلكتروني/البنكي:" : "Digital Disbursement:"}</span>
                              <span className="font-black text-cyan-300 font-mono">{digitalPct}%</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Filter Tabs & Search Inside Company */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#0E1424] border border-white/[0.06]">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {[
                        { id: "all", label: isAr ? "السجل الشامل" : "All", count: activeCompany.activityCount },
                        { id: "payments", label: isAr ? "المدفوعات" : "Payments", count: activeCompany.paymentCount },
                        { id: "credits", label: isAr ? "الآجل" : "Credits", count: activeCompany.creditCount },
                        { id: "returns", label: isAr ? "المرتجعات" : "Returns", count: activeCompany.returnCount },
                        { id: "expiries", label: isAr ? "التوالف" : "Expiries", count: activeCompany.expiryCount },
                      ].map((t) => {
                        const isActive = detailTab === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              triggerHapticFeedback(10);
                              setDetailTab(t.id as any);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                              isActive
                                ? "bg-white text-slate-950 font-black shadow-sm"
                                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                            }`}
                          >
                            <span>{t.label}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                                isActive ? "bg-slate-950/15 text-slate-950" : "bg-white/5 text-slate-400"
                              }`}
                            >
                              {t.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Filter query */}
                    <div className="relative w-full sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={detailQuery}
                        onChange={(e) => setDetailQuery(e.target.value)}
                        placeholder={isAr ? "بحث بالرقم أو الصنف..." : "Search ref or item..."}
                        className="w-full pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* Clean Financial Ledger Table */}
                  <div className="rounded-2xl bg-[#0E1424] border border-white/[0.06] overflow-hidden shadow-xl">
                    {filteredEvents.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-bold">{isAr ? "لا توجد سجلات مطابقة" : "No matching records"}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                          <thead className="bg-[#090E1A] text-slate-400 border-b border-white/5 font-bold text-[11px]">
                            <tr>
                              <th className="p-3 w-28">{isAr ? "التاريخ" : "Date"}</th>
                              <th className="p-3 w-28">{isAr ? "النوع" : "Type"}</th>
                              <th className="p-3">{isAr ? "البيان / المرجع" : "Details & Reference"}</th>
                              <th className="p-3 w-24">{isAr ? "طريقة السداد" : "Method"}</th>
                              <th className="p-3 w-32 text-left rtl:text-left ltr:text-right">{isAr ? "القيمة" : "Amount"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {filteredEvents.map((ev) => {
                              const isPayment = ev.type === "payment" || ev.type === "credit_payment";
                              const isCredit = ev.type === "credit";
                              const isReturn = ev.type === "return";
                              const isExpiry = ev.type === "expiry";

                              return (
                                <tr
                                  key={ev.id}
                                  onClick={() => setSelectedEventForPreview(ev)}
                                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                >
                                  {/* Date */}
                                  <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                    {ev.date}
                                  </td>

                                  {/* Type pill */}
                                  <td className="p-3 whitespace-nowrap">
                                    {isPayment && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {isAr ? "سداد" : "Payment"}
                                      </span>
                                    )}
                                    {isCredit && (
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                          ev.status === "paid"
                                            ? "bg-slate-800 text-slate-400 border-slate-700"
                                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        }`}
                                      >
                                        {ev.status === "paid"
                                          ? isAr
                                            ? "آجل (مسدد)"
                                            : "Credit (Paid)"
                                          : isAr
                                          ? "فاتورة آجل"
                                          : "Credit Invoice"}
                                      </span>
                                    )}
                                    {isReturn && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        {isAr ? "مرتجع RTV" : "Return"}
                                      </span>
                                    )}
                                    {isExpiry && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        {isAr ? "توالف" : "Expiry"}
                                      </span>
                                    )}
                                  </td>

                                  {/* Details */}
                                  <td className="p-3">
                                    <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                                      {ev.titleAr || ev.title}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                      {ev.invoiceNumber && (
                                        <span className="font-mono text-cyan-300">#{ev.invoiceNumber}</span>
                                      )}
                                      {ev.poNumber && (
                                        <span className="font-mono text-amber-300">PO: #{ev.poNumber}</span>
                                      )}
                                      {ev.returnNumber && (
                                        <span className="font-mono text-rose-300">RTV: #{ev.returnNumber}</span>
                                      )}
                                      {ev.itemName && <span className="text-slate-300">{ev.itemName}</span>}
                                      {ev.quantity ? (
                                        <span className="text-slate-500 font-mono">({ev.quantity} ق)</span>
                                      ) : null}
                                    </div>
                                    {ev.notes && <p className="text-[10px] text-slate-500 italic mt-0.5">{ev.notes}</p>}
                                  </td>

                                  {/* Method */}
                                  <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                                    {ev.method || "-"}
                                  </td>

                                  {/* Amount */}
                                  <td className="p-3 font-mono font-black text-left rtl:text-left ltr:text-right whitespace-nowrap">
                                    <span
                                      className={
                                        isPayment
                                          ? "text-emerald-400"
                                          : isCredit
                                          ? "text-amber-400"
                                          : isReturn
                                          ? "text-cyan-400"
                                          : "text-purple-400"
                                      }
                                    >
                                      {fmt(ev.amount)} <span className="text-[10px] text-slate-500 font-normal">ج.م</span>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty state when no company selected */
                <div className="p-16 text-center rounded-3xl bg-[#0E1424] border border-white/[0.06] text-slate-400 space-y-3">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-white">
                    {isAr ? "اختر شركة من القائمة لعرض كشف الحساب" : "Select a company from the list"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {isAr
                      ? "يمكنك البحث بالاسم أو رقم الفاتورة أو PO لعرض كافة المدفوعات والآجل والمرتجعات"
                      : "Search by company name, invoice # or PO to view full ledger and statement"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3. TRANSACTION DETAILS MODAL */}
      {selectedEventForPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1424] border border-white/10 rounded-2xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">{selectedEventForPreview.titleAr || selectedEventForPreview.title}</h3>
              <button
                onClick={() => setSelectedEventForPreview(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{isAr ? "التاريخ:" : "Date:"}</span>
                <span className="font-mono font-bold text-white">{selectedEventForPreview.date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{isAr ? "القيمة:" : "Amount:"}</span>
                <span className="font-mono font-black text-cyan-400">{fmt(selectedEventForPreview.amount)} ج.م</span>
              </div>
              {selectedEventForPreview.invoiceNumber && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">{isAr ? "رقم الفاتورة:" : "Invoice #:"}</span>
                  <span className="font-mono font-bold text-white">{selectedEventForPreview.invoiceNumber}</span>
                </div>
              )}
              {selectedEventForPreview.poNumber && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">{isAr ? "رقم أمر الشراء (PO):" : "PO #:"}</span>
                  <span className="font-mono font-bold text-white">{selectedEventForPreview.poNumber}</span>
                </div>
              )}
              {selectedEventForPreview.returnNumber && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">{isAr ? "رقم المرتجع (RTV):" : "RTV #:"}</span>
                  <span className="font-mono font-bold text-white">{selectedEventForPreview.returnNumber}</span>
                </div>
              )}
              {selectedEventForPreview.itemName && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">{isAr ? "الصنف والكمية:" : "Item & Qty:"}</span>
                  <span className="font-bold text-white">
                    {selectedEventForPreview.itemName} ({selectedEventForPreview.quantity || 1} قطعة)
                  </span>
                </div>
              )}
              {selectedEventForPreview.notes && (
                <div className="py-1">
                  <span className="text-slate-400 block mb-1">{isAr ? "ملاحظات:" : "Notes:"}</span>
                  <p className="p-2.5 rounded-lg bg-black/30 text-slate-300 font-mono text-[11px]">
                    {selectedEventForPreview.notes}
                  </p>
                </div>
              )}
              {selectedEventForPreview.receiptUrl && (
                <div className="pt-2">
                  <a
                    href={selectedEventForPreview.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold hover:bg-cyan-500/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isAr ? "عرض أصل الفاتورة / الإيصال" : "Open Receipt File"}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. PRINTABLE OFFICIAL STATEMENT MODAL (A4) */}
      {showStatementModal && activeCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-10 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black text-slate-900">
                  {isAr ? "كشف حساب مورد رسمي معتمد" : "Audited Vendor Statement"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? "طباعة فورية A4" : "Print A4"}</span>
                </button>
                <button
                  onClick={() => setShowStatementModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* A4 Document Content */}
            <div className="space-y-6 text-slate-900" dir={isAr ? "rtl" : "ltr"}>
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-rose-600 tracking-wider">CIRCLE K</h1>
                  <p className="text-xs font-bold text-slate-600">FRANCHISE OPERATING SYSTEM • EGYPT</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">سجل تجاري: 219405 • بطاقة ضريبية: 618-932-147</p>
                </div>
                <div className="text-right rtl:text-left space-y-0.5">
                  <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-black uppercase">
                    {isAr ? "كشف حساب مورد معتمد" : "STATEMENT OF ACCOUNT"}
                  </div>
                  <p className="text-xs text-slate-600 font-mono">
                    {isAr ? "تاريخ الإصدار:" : "Date:"} {new Date().toLocaleDateString(isAr ? "ar-EG" : "en-GB")}
                  </p>
                </div>
              </div>

              {/* Vendor Info Box */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">{isAr ? "اسم الشركة / المورد:" : "Vendor:"}</span>
                  <div className="text-base font-black text-slate-900">{activeCompany.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {activeCompany.aliases.length > 1 ? `المعرفات: ${activeCompany.aliases.slice(0, 3).join(", ")}` : "مورد معتمد"}
                  </div>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500">{isAr ? "الرصيد المتبقي المستحق:" : "Net Balance Due:"}</span>
                  <div className={`text-xl font-black ${activeCompany.remainingCredit > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {fmt(activeCompany.remainingCredit)} EGP
                  </div>
                  <div className="text-xs text-slate-600">
                    {activeCompany.remainingCredit > 0 ? (isAr ? "مستحق السداد" : "Payable") : isAr ? "خالص ومسدد" : "Cleared"}
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <div className="text-slate-500 text-[10px] font-bold">{isAr ? "إجمالي المسدد" : "Total Paid"}</div>
                  <div className="font-black text-slate-900 mt-1">{fmt(activeCompany.totalPaid)} ج.م</div>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <div className="text-slate-500 text-[10px] font-bold">{isAr ? "فواتير الآجل" : "Credit Invoices"}</div>
                  <div className="font-black text-slate-900 mt-1">{fmt(activeCompany.totalInvoiced)} ج.م</div>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <div className="text-slate-500 text-[10px] font-bold">{isAr ? "المرتجعات RTV" : "Returns (RTV)"}</div>
                  <div className="font-black text-slate-900 mt-1">{fmt(activeCompany.totalReturnsValue)} ج.م</div>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                  <div className="text-slate-500 text-[10px] font-bold">{isAr ? "التوالف" : "Expiries"}</div>
                  <div className="font-black text-slate-900 mt-1">{fmt(activeCompany.totalExpiriesValue)} ج.م</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-700 mb-2">
                  {isAr ? "تفاصيل السندات والعمليات المسجلة:" : "Transactions Ledger:"}
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                      <tr>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5">النوع</th>
                        <th className="p-2.5">البيان / المرجع</th>
                        <th className="p-2.5">طريقة الدفع</th>
                        <th className="p-2.5">القيمة (ج.م)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCompany.events.slice(0, 50).map((ev, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-[11px]">{ev.date}</td>
                          <td className="p-2 font-bold">{ev.titleAr || ev.title}</td>
                          <td className="p-2 text-[11px]">
                            {ev.invoiceNumber ? `فاتورة: #${ev.invoiceNumber} ` : ""}
                            {ev.poNumber ? `PO: #${ev.poNumber} ` : ""}
                            {ev.returnNumber ? `RTV: #${ev.returnNumber} ` : ""}
                            {ev.itemName ? `${ev.itemName} ` : ""}
                          </td>
                          <td className="p-2 text-[11px]">{ev.method || "-"}</td>
                          <td className="p-2 font-black font-mono">{fmt(ev.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & QR */}
              <div className="pt-6 border-t-2 border-slate-200 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1 border rounded bg-white">
                    <QRCode value={`CIRCLE_K_STMT_${activeCompany.id}_${activeCompany.remainingCredit}`} size={56} />
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-700">مستند إلكتروني رسمي معتمد</p>
                    <p>صدر عن الإدارة المالية - سيركل كيه</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 text-center text-xs">
                  <div className="space-y-6">
                    <p className="font-bold text-slate-700">توقيع الإدارة المالية</p>
                    <div className="border-b border-slate-400 w-32 mx-auto" />
                  </div>
                  <div className="space-y-6">
                    <p className="font-bold text-slate-700">ختم واعتماد الشركة</p>
                    <div className="border-b border-slate-400 w-32 mx-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. IMAGE RECEIPT LIGHTBOX MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-[#0E1424] border border-white/10 rounded-2xl max-w-2xl w-full p-4 text-white space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xs font-black text-white">{previewImage.title}</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-center max-h-[75vh] overflow-hidden rounded-xl bg-black/50 p-2">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="flex justify-end pt-1">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-slate-200 border border-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isAr ? "فتح بالحجم الكامل" : "Open Original"}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
