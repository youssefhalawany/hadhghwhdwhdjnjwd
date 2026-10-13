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
  AlertTriangle,
  CreditCard,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  ChevronDown,
  Layers,
  TrendingDown,
  Tag,
  Hash,
  Database,
  ShieldCheck,
  Percent,
  Receipt,
  FileSpreadsheet,
  Zap,
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
  clearCompaniesLocalCache,
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

  // Selection & UI states
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "debt" | "paid" | "returns" | "expiries">("all");
  const [sortBy, setSortBy] = useState<"volume" | "debt" | "paid" | "activity" | "name">("volume");
  
  // Detail view internal filter
  const [activeTab, setActiveTab] = useState<"all" | "payments" | "credits" | "settlements" | "returns" | "expiries" | "statement">("all");
  const [detailSearch, setDetailSearch] = useState<string>("");
  const [detailDateFilter, setDetailDateFilter] = useState<string>("all");

  // Statement print modal
  const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
  const printableStatementRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load: Load instantly from local cache (<10ms, 0 Firestore reads)
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
          return;
        }

        // If no local cache exists, perform initial sync
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

  // Sync selected company with URL query param
  useEffect(() => {
    const paramCompany = searchParams.get("company");
    if (paramCompany && paramCompany !== selectedCompanyId) {
      setSelectedCompanyId(paramCompany);
    }
  }, [searchParams]);

  // Handler: Manual or automatic Firestore sync
  const handleSync = async (notify = true) => {
    setSyncing(true);
    setSyncStep(isAr ? "جاري الاتصال بقواعد البيانات المالية..." : "Connecting to financial records...");
    try {
      const result = await syncCompaniesProfiles((step) => {
        setSyncStep(step);
      });
      setProfiles(result.profiles);
      setSummary(result.summary);
      setLastSyncedAt(result.summary.lastSyncedAt);
      setIsFromCache(false);
      if (notify) {
        toast.success(
          isAr
            ? `⚡ تم تحديث السجل وحفظه محلياً (${result.profiles.length} شركة)`
            : `⚡ Ledger updated and cached locally (${result.profiles.length} companies)`
        );
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(
        isAr
          ? "فشل تحديث البيانات، يرجى التحقق من الاتصال بالإنترنت"
          : "Failed to sync data, please check your connection"
      );
    } finally {
      setSyncing(false);
      setLoading(false);
      setSyncStep("");
    }
  };

  // Find currently selected company
  const activeCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return profiles.find((p) => p.id === selectedCompanyId) || null;
  }, [profiles, selectedCompanyId]);

  // Filtered & sorted company directory
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles
      .filter((p) => {
        // Search query matching
        if (q) {
          const matchName = p.name.toLowerCase().includes(q);
          const matchAlias = p.aliases.some((a) => a.toLowerCase().includes(q));
          const matchEvents = p.events.some(
            (e) =>
              (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(q)) ||
              (e.poNumber && e.poNumber.toLowerCase().includes(q)) ||
              (e.returnNumber && e.returnNumber.toLowerCase().includes(q)) ||
              (e.itemName && e.itemName.toLowerCase().includes(q)) ||
              (e.barcode && e.barcode.toLowerCase().includes(q))
          );
          if (!matchName && !matchAlias && !matchEvents) return false;
        }

        // Filter chips
        if (filterType === "debt" && p.remainingCredit <= 0) return false;
        if (filterType === "paid" && (p.remainingCredit > 0 || p.totalInvoiced === 0)) return false;
        if (filterType === "returns" && p.totalReturnsCount === 0) return false;
        if (filterType === "expiries" && p.totalExpiriesCount === 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "volume") {
          const volA = a.totalPaid + a.totalInvoiced + a.totalReturnsValue + a.totalExpiriesValue;
          const volB = b.totalPaid + b.totalInvoiced + b.totalReturnsValue + b.totalExpiriesValue;
          return volB - volA;
        }
        if (sortBy === "debt") return b.remainingCredit - a.remainingCredit;
        if (sortBy === "paid") return b.totalPaid - a.totalPaid;
        if (sortBy === "activity") return b.activityCount - a.activityCount;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [profiles, searchQuery, filterType, sortBy]);

  // Selected company's filtered events
  const filteredEvents = useMemo(() => {
    if (!activeCompany) return [];
    const q = detailSearch.trim().toLowerCase();

    return activeCompany.events.filter((e) => {
      // Tab filter
      if (activeTab === "payments" && e.type !== "payment") return false;
      if (activeTab === "credits" && e.type !== "credit") return false;
      if (activeTab === "settlements" && e.type !== "credit_payment") return false;
      if (activeTab === "returns" && e.type !== "return") return false;
      if (activeTab === "expiries" && e.type !== "expiry") return false;

      // Date range filter
      if (detailDateFilter !== "all" && e.date) {
        const today = new Date().toISOString().substring(0, 10);
        const thisMonth = today.substring(0, 7);
        if (detailDateFilter === "thisMonth" && !e.date.startsWith(thisMonth)) return false;
        if (detailDateFilter === "last30Days") {
          const diffDays = (new Date(today).getTime() - new Date(e.date).getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30 || diffDays < 0) return false;
        }
      }

      // Detail search
      if (q) {
        const inTitle = (e.title || "").toLowerCase().includes(q) || (e.titleAr || "").toLowerCase().includes(q);
        const inInv = (e.invoiceNumber || "").toLowerCase().includes(q);
        const inPo = (e.poNumber || "").toLowerCase().includes(q);
        const inRet = (e.returnNumber || "").toLowerCase().includes(q);
        const inItem = (e.itemName || "").toLowerCase().includes(q);
        const inNotes = (e.notes || "").toLowerCase().includes(q);
        const inBarcode = (e.barcode || "").toLowerCase().includes(q);
        if (!inTitle && !inInv && !inPo && !inRet && !inItem && !inNotes && !inBarcode) return false;
      }

      return true;
    });
  }, [activeCompany, activeTab, detailSearch, detailDateFilter]);

  // Handler: Select company
  const handleSelectCompany = (companyId: string) => {
    triggerHapticFeedback(10);
    setSelectedCompanyId(companyId);
    router.replace(`/financials/companies-profiles?company=${companyId}`);
    setActiveTab("all");
    setDetailSearch("");
  };

  // Handler: Deselect / Back to list
  const handleBackToList = () => {
    triggerHapticFeedback(10);
    setSelectedCompanyId("");
    router.replace(`/financials/companies-profiles`);
  };

  // Format money
  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);

  // Generate unique gradient initials for avatar
  const getAvatarGradient = (name: string) => {
    const colors = [
      "from-rose-500 to-orange-500",
      "from-cyan-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-amber-500 to-yellow-600",
      "from-fuchsia-500 to-pink-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  const getInitials = (name: string) => {
    if (!name) return "CO";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Export current company's ledger to Excel
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
        subtitle: `سجل التعاملات والمدفوعات والآجل والمرتجعات والتوالف`,
        sheetName: "Company Ledger",
        creator: "Circle K Finance Engine",
        columns: [
          { header: "التاريخ (Date)", key: "date", width: 15 },
          { header: "النوع (Type)", key: "type", width: 14 },
          { header: "البيان (Description)", key: "title", width: 28 },
          { header: "المبلغ (Amount)", key: "amount", width: 16, isCurrency: true },
          { header: "رقم الفاتورة (Invoice #)", key: "invoiceNumber", width: 18 },
          { header: "رقم الـ PO", key: "poNumber", width: 16 },
          { header: "رقم المرتجع (RTV)", key: "returnNumber", width: 16 },
          { header: "طريقة السداد (Method)", key: "method", width: 16 },
          { header: "الصنف (Item)", key: "item", width: 25 },
          { header: "الكمية (Qty)", key: "qty", width: 12 },
          { header: "ملاحظات (Notes)", key: "notes", width: 30 },
        ],
        data: rows,
      });
      toast.success(isAr ? "تم تصدير ملف الإكسل بنجاح" : "Excel exported successfully");
    } catch (e) {
      console.error("Export error:", e);
      toast.error(isAr ? "فشل تصدير ملف الإكسل" : "Failed to export Excel");
    }
  };

  // Print official Vendor Statement (كشف حساب معتمد)
  const handlePrintStatement = () => {
    setShowStatementModal(true);
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div
      className="min-h-screen pb-24 text-slate-100"
      dir={isAr ? "rtl" : "ltr"}
      style={{
        background: "radial-gradient(circle at 50% 0%, rgba(30, 41, 59, 0.4) 0%, rgba(11, 17, 33, 1) 100%)",
      }}
    >
      {/* Top Breadcrumb & Actions Bar */}
      <div className="sticky top-0 z-40 backdrop-blur-2xl bg-[#0B1121]/80 border-b border-white/[0.06] px-4 sm:px-8 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Breadcrumb / Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.25)] border border-cyan-400/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/financials/inputs"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {isAr ? "الماليات" : "Finance"}
                </Link>
                <span className="text-slate-600">/</span>
                <h1 className="text-sm sm:text-base font-black tracking-wide text-white">
                  {isAr ? "ملفات وسجل الشركات والموردين" : "Companies Profiles & Ledger"}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAr
                  ? "السجل المالي الشامل: مدفوعات، آجل، مرتجعات، وتوالف الصلاحيات"
                  : "All historical payments, credits, RTV returns & expiries"}
              </p>
            </div>
          </div>

          {/* Offline Cache Indicator & Refresh */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isFromCache
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
              }`}
              title={
                lastSyncedAt
                  ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : "Offline storage active"
              }
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isFromCache
                  ? isAr
                    ? "⚡ محفوظ محلياً (0 قراءات)"
                    : "⚡ Local Cache (0 Reads)"
                  : isAr
                  ? "🌐 متصل ومحدث"
                  : "🌐 Live Synced"}
              </span>
            </div>

            <button
              onClick={() => handleSync(true)}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-bold border border-white/10 hover:border-cyan-500/40 transition-all duration-200 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-cyan-400" : ""}`} />
              <span>{syncing ? (isAr ? "جاري التحديث..." : "Syncing...") : isAr ? "تحديث السجل" : "Sync Now"}</span>
            </button>
          </div>
        </div>

        {/* Sync Progress Banner if in progress */}
        {syncing && syncStep && (
          <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-white/5 flex items-center gap-2 text-xs text-cyan-300 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>{syncStep}</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Loading State Skeleton */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center animate-pulse">
                <Building2 className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-bold text-slate-300">
              {isAr ? "جاري فك تشفير السجل المالي المحلي للشركات..." : "Loading company profiles ledger..."}
            </p>
          </div>
        )}

        {!loading && (
          <>
            {/* Global Financial KPI Cards */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isAr ? "عدد الشركات" : "Companies"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white">{summary.totalCompanies}</div>
                  <div className="text-[10px] text-blue-400/80 mt-1 font-bold">{isAr ? "سجل شامل معتمد" : "Active & Historic"}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? "إجمالي المسدد" : "Total Paid"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">
                    {fmt(summary.totalPaidAllTime)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[10px] text-emerald-500/80 mt-1 font-bold">{isAr ? "نقدي وتحويلات وشيكات" : "Disbursed"}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAr ? "فواتير الآجل" : "Invoiced Credits"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400">
                    {fmt(summary.totalInvoicedAllTime)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[10px] text-amber-500/80 mt-1 font-bold">{isAr ? "إجمالي التوريدات" : "Purchased On Credit"}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isAr ? "الذمم المستحقة" : "Outstanding Debt"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-400">
                    {fmt(summary.totalOutstandingCredits)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[10px] text-rose-500/80 mt-1 font-bold">{isAr ? "متبقي لم يُسدد" : "Unsettled Credits"}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? "المرتجعات RTV" : "Returns Settled"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-cyan-400">
                    {fmt(summary.totalReturnsValue)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[10px] text-cyan-400/80 mt-1 font-bold">{isAr ? "بضائع مرتجعة" : "Claimed to Vendors"}</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] shadow-xl backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isAr ? "توالف الصلاحيات" : "Expiries Logged"}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-purple-400">
                    {fmt(summary.totalExpiriesValue)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[10px] text-purple-400/80 mt-1 font-bold">{isAr ? "إجمالي قيمة التوالف" : "Vendor Near-Expiries"}</div>
                </div>
              </div>
            )}

            {/* If a company is selected, show detail view. Otherwise show directory view */}
            {activeCompany ? (
              /* ================== DETAILED COMPANY PROFILE VIEW ================== */
              <div className="space-y-6">
                {/* Back button & Company Header */}
                <div className="p-6 rounded-3xl bg-gradient-to-b from-[#131B32] to-[#0E1528] border border-white/[0.08] shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <button
                      onClick={handleBackToList}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-bold border border-white/10 transition-all cursor-pointer"
                    >
                      {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                      <span>{isAr ? "العودة لقائمة الشركات" : "Back to Directory"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>{isAr ? "تصدير كشف حساب Excel" : "Export Excel Ledger"}</span>
                      </button>

                      <button
                        onClick={handlePrintStatement}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isAr ? "طباعة كشف حساب معتمد (A4)" : "Print Statement (A4)"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {/* Large Avatar */}
                    <div
                      className={`w-20 h-20 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                        activeCompany.name
                      )} flex items-center justify-center text-white text-2xl font-black shadow-xl border-2 border-white/20 shrink-0`}
                    >
                      {getInitials(activeCompany.name)}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                          {activeCompany.name}
                        </h2>

                        {activeCompany.remainingCredit > 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{isAr ? `مستحق في الذمة: ${fmt(activeCompany.remainingCredit)} ج.م` : `Due Balance: EGP ${fmt(activeCompany.remainingCredit)}`}</span>
                          </span>
                        ) : activeCompany.totalInvoiced > 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isAr ? "الذمة مسددة بالكامل" : "All Credits Cleared"}</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {isAr ? "تعاملات نقدية فورية" : "Cash / Direct Only"}
                          </span>
                        )}
                      </div>

                      {/* Known aliases */}
                      {activeCompany.aliases.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 pt-1">
                          <span className="text-[11px] font-bold text-slate-500">{isAr ? "أسماء أخرى مسجلة للفواتير:" : "Recorded Aliases:"}</span>
                          {activeCompany.aliases.map((a, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/5 text-[10px] font-mono">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2">
                        <span>
                          {isAr ? "إجمالي الحركات:" : "Total Records:"} <strong className="text-white">{activeCompany.activityCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {isAr ? "أول تعامل:" : "First Activity:"} <strong className="text-white">{activeCompany.firstActivityDate || "-"}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {isAr ? "آخر تعامل:" : "Last Activity:"} <strong className="text-white">{activeCompany.lastActivityDate || "-"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Company specific metrics bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/[0.06]">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="text-[11px] text-slate-400 font-bold mb-0.5">{isAr ? "إجمالي المدفوعات" : "Total Paid"}</div>
                      <div className="text-base sm:text-lg font-black text-emerald-400">
                        {fmt(activeCompany.totalPaid)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeCompany.paymentCount} {isAr ? "سندات سداد" : "vouchers"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="text-[11px] text-slate-400 font-bold mb-0.5">{isAr ? "فواتير الآجل" : "Credit Invoices"}</div>
                      <div className="text-base sm:text-lg font-black text-amber-400">
                        {fmt(activeCompany.totalInvoiced)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeCompany.creditCount} {isAr ? "فواتير آجل" : "invoices"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="text-[11px] text-slate-400 font-bold mb-0.5">{isAr ? "الرصيد المتبقي" : "Remaining Due"}</div>
                      <div className={`text-base sm:text-lg font-black ${activeCompany.remainingCredit > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {fmt(activeCompany.remainingCredit)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeCompany.remainingCredit > 0 ? (isAr ? "مطلوب سداده" : "Payable") : isAr ? "لا توجد ذمم" : "Fully Settled"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="text-[11px] text-slate-400 font-bold mb-0.5">{isAr ? "إجمالي المرتجعات" : "Returns (RTV)"}</div>
                      <div className="text-base sm:text-lg font-black text-cyan-400">
                        {fmt(activeCompany.totalReturnsValue)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeCompany.totalReturnsCount} {isAr ? "قطعة مرتجعة" : "items returned"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                      <div className="text-[11px] text-slate-400 font-bold mb-0.5">{isAr ? "توالف الصلاحيات" : "Expiries Cost"}</div>
                      <div className="text-base sm:text-lg font-black text-purple-400">
                        {fmt(activeCompany.totalExpiriesValue)} <span className="text-[10px] text-slate-400">ج.م</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {activeCompany.totalExpiriesCount} {isAr ? "صنف منتهي" : "items"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs & Search inside Company */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#121A2F]/90 border border-white/[0.07] backdrop-blur-xl">
                  {/* Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {[
                      { id: "all", label: isAr ? "السجل الشامل" : "All Activity", count: activeCompany.activityCount, icon: Layers },
                      { id: "payments", label: isAr ? "المدفوعات" : "Payments", count: activeCompany.paymentCount, icon: Wallet },
                      { id: "credits", label: isAr ? "الفواتير الآجل" : "Credits", count: activeCompany.creditCount, icon: CreditCard },
                      { id: "settlements", label: isAr ? "سدادات الآجل" : "Settlements", count: activeCompany.events.filter((e) => e.type === "credit_payment").length, icon: CheckCircle2 },
                      { id: "returns", label: isAr ? "المرتجعات" : "Returns (RTV)", count: activeCompany.returnCount, icon: Truck },
                      { id: "expiries", label: isAr ? "توالف الصلاحيات" : "Expiries", count: activeCompany.expiryCount, icon: AlertTriangle },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            triggerHapticFeedback(10);
                            setActiveTab(tab.id as any);
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            isActive
                              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20"
                              : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                              isActive ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search inside company */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                      <input
                        type="text"
                        value={detailSearch}
                        onChange={(e) => setDetailSearch(e.target.value)}
                        placeholder={isAr ? "بحث برقم الفاتورة أو الصنف..." : "Search invoice, PO, item..."}
                        className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <select
                      value={detailDateFilter}
                      onChange={(e) => setDetailDateFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="all">{isAr ? "كل التواريخ" : "All Time"}</option>
                      <option value="thisMonth">{isAr ? "الشهر الحالي" : "This Month"}</option>
                      <option value="last30Days">{isAr ? "آخر 30 يوم" : "Last 30 Days"}</option>
                    </select>
                  </div>
                </div>

                {/* Timeline / Ledger Records */}
                <div className="space-y-3">
                  {filteredEvents.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-[#121A2F]/50 border border-white/5 text-slate-400">
                      <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-bold">{isAr ? "لا توجد سجلات مطابقة للفلتر المحدد" : "No records match current filter"}</p>
                    </div>
                  ) : (
                    filteredEvents.map((event) => {
                      // Determine event styling
                      let badgeBg = "bg-slate-700/50 text-slate-300 border-slate-600/30";
                      let iconColor = "text-slate-400";
                      let IconComponent = FileText;

                      if (event.type === "payment") {
                        badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        iconColor = "text-emerald-400";
                        IconComponent = Wallet;
                      } else if (event.type === "credit") {
                        badgeBg = event.status === "paid" ? "bg-slate-700/50 text-slate-400 border-slate-600/30" : "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        iconColor = "text-amber-400";
                        IconComponent = CreditCard;
                      } else if (event.type === "credit_payment") {
                        badgeBg = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
                        iconColor = "text-cyan-400";
                        IconComponent = CheckCircle2;
                      } else if (event.type === "return") {
                        badgeBg = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                        iconColor = "text-rose-400";
                        IconComponent = Truck;
                      } else if (event.type === "expiry") {
                        badgeBg = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        iconColor = "text-purple-400";
                        IconComponent = AlertTriangle;
                      }

                      return (
                        <div
                          key={event.id}
                          className="p-4 rounded-2xl bg-[#121A2F]/80 hover:bg-[#15203A] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-xl ${badgeBg} border flex items-center justify-center shrink-0 mt-0.5`}>
                              <IconComponent className={`w-5 h-5 ${iconColor}`} />
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-extrabold text-white">{isAr ? event.titleAr : event.title}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase ${badgeBg}`}>
                                  {event.type.replace("_", " ")}
                                </span>
                                {event.method && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/[0.04] text-slate-300 border border-white/5">
                                    {event.method}
                                  </span>
                                )}
                              </div>

                              {/* Details / References */}
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center gap-1 text-slate-300 font-mono">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                  {event.date}
                                </span>

                                {event.invoiceNumber && (
                                  <span className="flex items-center gap-1 font-mono text-cyan-300">
                                    <span>فاتورة / Inv:</span>
                                    <strong className="text-white">#{event.invoiceNumber}</strong>
                                  </span>
                                )}

                                {event.poNumber && (
                                  <span className="flex items-center gap-1 font-mono text-amber-300">
                                    <span>PO:</span>
                                    <strong className="text-white">#{event.poNumber}</strong>
                                  </span>
                                )}

                                {event.returnNumber && (
                                  <span className="flex items-center gap-1 font-mono text-rose-300">
                                    <span>RTV:</span>
                                    <strong className="text-white">#{event.returnNumber}</strong>
                                  </span>
                                )}

                                {event.itemName && (
                                  <span className="text-slate-300 font-bold">
                                    {event.itemName} {event.quantity ? `(${event.quantity} قطعة)` : ""}
                                  </span>
                                )}

                                {event.barcode && (
                                  <span className="font-mono text-[10px] text-slate-500 bg-black/30 px-1.5 py-0.5 rounded">
                                    {event.barcode}
                                  </span>
                                )}
                              </div>

                              {event.notes && (
                                <p className="text-[11px] text-slate-400 italic pt-0.5">{event.notes}</p>
                              )}
                            </div>
                          </div>

                          {/* Right Amount & Receipt Links */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0 shrink-0">
                            <div className="text-right">
                              <span
                                className={`text-base sm:text-lg font-black ${
                                  event.type === "payment" || event.type === "credit_payment"
                                    ? "text-emerald-400"
                                    : event.type === "return"
                                    ? "text-cyan-400"
                                    : event.type === "expiry"
                                    ? "text-purple-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {fmt(event.amount)} <span className="text-xs font-normal text-slate-400">ج.م</span>
                              </span>
                              {event.grossAmount && event.grossAmount !== event.amount && (
                                <div className="text-[10px] text-slate-500">
                                  {isAr ? "الإجمالي قبل الخصم: " : "Gross: "} {fmt(event.grossAmount)} ج.م
                                </div>
                              )}
                            </div>

                            {/* Attachments if available */}
                            {(event.receiptUrl || event.bankTransferReceiptUrl) && (
                              <div className="flex items-center gap-2 mt-1">
                                {event.receiptUrl && (
                                  <a
                                    href={event.receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>{isAr ? "مرفق الفاتورة" : "Receipt"}</span>
                                  </a>
                                )}
                                {event.bankTransferReceiptUrl && (
                                  <a
                                    href={event.bankTransferReceiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>{isAr ? "إشعار التحويل" : "Transfer Proof"}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* ================== COMPANY DIRECTORY & SEARCH VIEW ================== */
              <div className="space-y-6">
                {/* Search Bar & Filter Controls */}
                <div className="p-4 sm:p-6 rounded-3xl bg-[#121A2F]/90 border border-white/[0.08] shadow-2xl backdrop-blur-xl space-y-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                      <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-4 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          isAr
                            ? "ابحث باسم أي شركة، كود مورد، رقم فاتورة، PO، أو صنف تم التعامل به..."
                            : "Search any company name, alias, invoice #, PO #, return # or product..."
                        }
                        className="w-full pl-12 pr-10 rtl:pl-10 rtl:pr-12 py-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                      <span className="text-xs text-slate-400 font-bold whitespace-nowrap">{isAr ? "ترتيب حسب:" : "Sort by:"}</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="flex-1 md:flex-none px-3.5 py-3 rounded-2xl bg-slate-900/90 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer font-bold"
                      >
                        <option value="volume">{isAr ? "إجمالي حجم التعاملات" : "Highest Volume"}</option>
                        <option value="debt">{isAr ? "أعلى مديونية / ذمة مستحقة" : "Highest Debt"}</option>
                        <option value="paid">{isAr ? "أعلى مبالغ مسددة" : "Highest Paid"}</option>
                        <option value="activity">{isAr ? "الأكثر نشاطاً وعدداً" : "Most Activity Count"}</option>
                        <option value="name">{isAr ? "الاسم أبجدياً" : "Name A-Z"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                    {[
                      { id: "all", label: isAr ? "كل الشركات" : "All Companies" },
                      { id: "debt", label: isAr ? "⚠️ عليها ذمم مستحقة" : "⚠️ Outstanding Debt" },
                      { id: "paid", label: isAr ? "✅ مسددة بالكامل" : "✅ Fully Paid" },
                      { id: "returns", label: isAr ? "🔄 بها مرتجعات" : "🔄 Has Returns" },
                      { id: "expiries", label: isAr ? "⚠️ بها توالف صلاحيات" : "⚠️ Has Expiries" },
                    ].map((pill) => {
                      const isActive = filterType === pill.id;
                      return (
                        <button
                          key={pill.id}
                          onClick={() => {
                            triggerHapticFeedback(10);
                            setFilterType(pill.id as any);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            isActive
                              ? "bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25 scale-[1.02]"
                              : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-white/5"
                          }`}
                        >
                          {pill.label}
                        </button>
                      );
                    })}

                    <span className="text-[11px] text-slate-500 font-mono ml-auto rtl:ml-0 rtl:mr-auto">
                      {isAr
                        ? `عرض ${filteredProfiles.length} من أصل ${profiles.length} شركة`
                        : `Showing ${filteredProfiles.length} of ${profiles.length} companies`}
                    </span>
                  </div>
                </div>

                {/* Companies Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProfiles.length === 0 ? (
                    <div className="col-span-full p-16 text-center rounded-3xl bg-[#121A2F]/50 border border-white/5">
                      <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-base font-bold text-white mb-1">
                        {isAr ? "لم يتم العثور على شركات مطابقة" : "No companies found"}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isAr
                          ? "جرب البحث باسم آخر أو إزالة الفلاتر المحددة"
                          : "Try searching with a different name or clearing filters"}
                      </p>
                    </div>
                  ) : (
                    filteredProfiles.map((company) => {
                      const hasDebt = company.remainingCredit > 0;
                      return (
                        <div
                          key={company.id}
                          onClick={() => handleSelectCompany(company.id)}
                          className="p-5 rounded-3xl bg-gradient-to-b from-[#131B32] to-[#0E1528] hover:from-[#172240] hover:to-[#111A33] border border-white/[0.07] hover:border-cyan-500/40 transition-all duration-300 shadow-xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] group cursor-pointer relative overflow-hidden flex flex-col justify-between"
                        >
                          <div className="space-y-4">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                                    company.name
                                  )} flex items-center justify-center text-white text-base font-black shadow-md border border-white/20 shrink-0 group-hover:scale-105 transition-transform`}
                                >
                                  {getInitials(company.name)}
                                </div>
                                <div>
                                  <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                                    {company.name}
                                  </h3>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {company.activityCount} {isAr ? "حركة مسجلة" : "total transactions"}
                                  </div>
                                </div>
                              </div>

                              {/* Status Badge */}
                              {hasDebt ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                                  {isAr ? `ذمة: ${fmt(company.remainingCredit)}` : `Debt: ${fmt(company.remainingCredit)}`}
                                </span>
                              ) : company.totalInvoiced > 0 ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                  {isAr ? "مسدد بالكامل" : "Cleared"}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                  {isAr ? "نقدي" : "Cash Only"}
                                </span>
                              )}
                            </div>

                            {/* Mini KPIs */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                                <div className="text-[10px] text-slate-400 font-bold">{isAr ? "إجمالي المسدد" : "Total Paid"}</div>
                                <div className="text-sm font-black text-emerald-400 mt-0.5">
                                  {fmt(company.totalPaid)} <span className="text-[9px] text-slate-500">ج.م</span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                                <div className="text-[10px] text-slate-400 font-bold">{isAr ? "إجمالي الآجل" : "Invoiced Credits"}</div>
                                <div className="text-sm font-black text-amber-400 mt-0.5">
                                  {fmt(company.totalInvoiced)} <span className="text-[9px] text-slate-500">ج.م</span>
                                </div>
                              </div>
                            </div>

                            {/* Returns and Expiries pills if present */}
                            {(company.totalReturnsCount > 0 || company.totalExpiriesCount > 0) && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {company.totalReturnsCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    <span>{company.totalReturnsCount} {isAr ? "مرتجع" : "returns"}</span>
                                  </span>
                                )}
                                {company.totalExpiriesCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{company.totalExpiriesCount} {isAr ? "توالف" : "expiries"}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Footer action */}
                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <span>{isAr ? "فتح كشف الحساب والملف الكامل" : "View Full Profile & Ledger"}</span>
                            {isAr ? (
                              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            ) : (
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ================== PRINTABLE OFFICIAL VENDOR STATEMENT MODAL ================== */}
      {showStatementModal && activeCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-10 shadow-2xl relative my-8">
            {/* Modal Controls */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-black text-slate-900">
                  {isAr ? "كشف حساب مورد رسمي معتمد" : "Official Audited Vendor Statement"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? "طباعة فورية (Print A4)" : "Print A4"}</span>
                </button>
                <button
                  onClick={() => setShowStatementModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Content */}
            <div ref={printableStatementRef} className="space-y-6 text-slate-900" dir={isAr ? "rtl" : "ltr"}>
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-rose-600 tracking-wider">CIRCLE K</h1>
                  <p className="text-xs font-bold text-slate-600">FRANCHISE OPERATING SYSTEM • EGYPT</p>
                  <p className="text-[11px] text-slate-500 mt-1">سجل تجاري: 219405 • بطاقة ضريبية: 618-932-147</p>
                </div>
                <div className="text-right rtl:text-left space-y-1">
                  <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-black uppercase">
                    {isAr ? "كشف حساب مورد رسمي" : "VENDOR STATEMENT OF ACCOUNT"}
                  </div>
                  <p className="text-xs text-slate-600 font-mono">
                    {isAr ? "تاريخ الإصدار:" : "Date:"} {new Date().toLocaleDateString(isAr ? "ar-EG" : "en-GB")}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">Ref: STMT-{activeCompany.id.toUpperCase()}-{Date.now().toString().slice(-6)}</p>
                </div>
              </div>

              {/* Company Info Box */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">{isAr ? "اسم الشركة / المورد:" : "Vendor / Company:"}</span>
                  <div className="text-base font-black text-slate-900">{activeCompany.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {activeCompany.aliases.length > 1 ? `المعرفات: ${activeCompany.aliases.slice(0, 3).join(", ")}` : "مورد مسجل معتمد"}
                  </div>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500">{isAr ? "الرصيد المتبقي المستحق:" : "Net Balance Due:"}</span>
                  <div className={`text-xl font-black ${activeCompany.remainingCredit > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {fmt(activeCompany.remainingCredit)} EGP
                  </div>
                  <div className="text-xs text-slate-600">
                    {activeCompany.remainingCredit > 0 ? (isAr ? "مستحق السداد للمورد" : "Payable to Vendor") : isAr ? "خالص ومسدد بالكامل" : "Fully Cleared"}
                  </div>
                </div>
              </div>

              {/* Financial Summary 4-Grid */}
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
                  <div className="text-slate-500 text-[10px] font-bold">{isAr ? "توالف الصلاحيات" : "Expiries"}</div>
                  <div className="font-black text-slate-900 mt-1">{fmt(activeCompany.totalExpiriesValue)} ج.م</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-700 mb-2">
                  {isAr ? "تفاصيل العمليات والسندات المسجلة:" : "Itemized Transaction Ledger:"}
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
                      {activeCompany.events.slice(0, 40).map((ev, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-[11px]">{ev.date}</td>
                          <td className="p-2.5 font-bold">{ev.titleAr || ev.title}</td>
                          <td className="p-2.5 text-[11px]">
                            {ev.invoiceNumber ? `فاتورة: #${ev.invoiceNumber} ` : ""}
                            {ev.poNumber ? `PO: #${ev.poNumber} ` : ""}
                            {ev.returnNumber ? `RTV: #${ev.returnNumber} ` : ""}
                            {ev.itemName ? `${ev.itemName} ` : ""}
                          </td>
                          <td className="p-2.5 text-[11px]">{ev.method || "-"}</td>
                          <td className="p-2.5 font-black font-mono">{fmt(ev.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & QR Code Verification */}
              <div className="pt-6 border-t-2 border-slate-200 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1 border rounded bg-white">
                    <QRCode value={`CIRCLE_K_VENDOR_STMT_${activeCompany.id}_${activeCompany.remainingCredit}`} size={56} />
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-700">مستند إلكتروني رسمي معتمد</p>
                    <p>صدر عن الإدارة المالية - سيركل كيه</p>
                    <p className="font-mono">Security Hash: {activeCompany.id}</p>
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
    </div>
  );
}
