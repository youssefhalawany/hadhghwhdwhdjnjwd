"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  Plus,
  TrendingUp,
  Bot,
  X,
  Wallet,
  Clock,
  FileCheck2,
  PackageX,
  CreditCard,
  Search,
  Camera,
  Mic,
  ChevronUp,
  AlertTriangle,
  Users,
  Store,
  Banknote,
  Vault,
  ClipboardCheck,
  Boxes,
  PieChart,
  RotateCcw,
  FileText,
  Layers,
  ShieldCheck,
  HelpCircle,
  Truck,
  Calendar,
  UserCheck,
  Coins,
  Bell,
  Lock,
  Tag,
  Utensils,
  DollarSign,
  Percent,
  Sparkles
} from "lucide-react";
import { triggerHapticFeedback } from "@/lib/pwaBadges";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { playPopSound } from "@/lib/sounds";

interface ManagerBottomNavProps {
  pendingShiftsCount?: number;
  pendingVoidsCount?: number;
  pendingExpiriesCount?: number;
}

export function ManagerBottomNav({
  pendingShiftsCount = 0,
  pendingVoidsCount = 0,
  pendingExpiriesCount = 0,
}: ManagerBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useLanguage();
  const { currentBranch } = useBranch();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState("overview");
  const [fabOpen, setFabOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Drawer Search & Category Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [userRole, setUserRole] = useState("manager");

  const totalPending = pendingShiftsCount + pendingVoidsCount + pendingExpiriesCount;

  // Fetch current logged user role for strict security scoping
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("circlek_role") || "manager";
      setUserRole(role);
    }
  }, []);

  // Track online/offline network state for PWA IndexedDB status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update active tab based on current pathname
  useEffect(() => {
    if (pathname.includes("/financials/inputs")) setActiveTab("overview");
    else if (pathname.includes("/shift-reports/manager") || pathname.includes("/voids/manager")) setActiveTab("approvals");
    else if (pathname.includes("/financial-reports")) setActiveTab("financials");
    else if (pathname.includes("/ai-assistant")) setActiveTab("ai");
  }, [pathname]);

  const handleNavClick = (tabId: string, path: string) => {
    triggerHapticFeedback(12);
    playPopSound();
    setActiveTab(tabId);
    setFabOpen(false);
    setStatusSheetOpen(false);
    router.push(path);
  };

  const toggleFab = () => {
    triggerHapticFeedback(fabOpen ? 15 : [20, 30, 20]);
    playPopSound();
    setFabOpen(!fabOpen);
    if (statusSheetOpen) setStatusSheetOpen(false);
  };

  const toggleStatusSheet = () => {
    triggerHapticFeedback(10);
    playPopSound();
    setStatusSheetOpen(!statusSheetOpen);
    if (fabOpen) setFabOpen(false);
  };

  // Categories definition
  const CATEGORIES = [
    { id: "all", labelEn: "All", labelAr: "الكل", icon: Layers },
    { id: "financials", labelEn: "Financials", labelAr: "المالية", icon: Banknote },
    { id: "products", labelEn: "Products", labelAr: "المنتجات", icon: Boxes },
    { id: "operations", labelEn: "Operations", labelAr: "التشغيل", icon: ClipboardCheck },
    { id: "hr", labelEn: "HR & Staff", labelAr: "الموارد البشرية", icon: Users },
    { id: "admin", labelEn: "Admin", labelAr: "الإدارة", icon: ShieldCheck, adminOnly: true },
  ];

  // Complete List of All 28 Available System Tools & Pages (Role-Secured)
  const QUICK_ACTIONS = [
    // --- FINANCIALS ---
    {
      id: "ai-assistant",
      category: "financials",
      titleEn: "Ibrahim (AI)",
      titleAr: "المساعد المالي ابراهيم",
      subtitleEn: "Ask floor AI assistant",
      subtitleAr: "استفسارات المساعد الذكي",
      icon: Bot,
      color: "bg-[#22d3ee]/15 text-cyan-300 border-[#22d3ee]/30",
      path: "/ai-assistant",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "financial-inputs",
      category: "financials",
      titleEn: "Financial Inputs",
      titleAr: "مدخلات النظام المالي",
      subtitleEn: "Inputs overview & live feed",
      subtitleAr: "لوحة تحكم المدخلات المالية",
      icon: LayoutDashboard,
      color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      path: "/financials/inputs",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "financial-reports",
      category: "financials",
      titleEn: "Financial Reports",
      titleAr: "التقارير المالية والربحية",
      subtitleEn: "P&L & sales breakdowns",
      subtitleAr: "تقارير الأرباح والخسائر والتحليلات",
      icon: TrendingUp,
      color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
      path: "/financial-reports",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "sales",
      category: "financials",
      titleEn: "Detailed Sales",
      titleAr: "إدخال وتفاصيل المبيعات",
      subtitleEn: "Daily Cash & Visa sales",
      subtitleAr: "تسجيل مبيعات الكاش والفيزا",
      icon: Banknote,
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      path: "/financials/inputs/sales",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "payments",
      category: "financials",
      titleEn: "Payments Log",
      titleAr: "سجل المدفوعات",
      subtitleEn: "Log vendor payment",
      subtitleAr: "تسجيل مدفوعات الموردين",
      icon: Wallet,
      color: "bg-teal-500/15 text-teal-400 border-teal-500/30",
      path: "/financials/inputs/payments",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "credits",
      category: "financials",
      titleEn: "Credits Input",
      titleAr: "تسجيل الذمم والآجل",
      subtitleEn: "Record vendor credit notes",
      subtitleAr: "إدخال كشوفات الآجل والموردين",
      icon: CreditCard,
      color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      path: "/financials/inputs/credits",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "deposits",
      category: "financials",
      titleEn: "Deposits Log",
      titleAr: "إيداعات الخزينة والبنك",
      subtitleEn: "Safe & bank deposit vouchers",
      subtitleAr: "سجل التحويلات والإيداعات البنكية",
      icon: Vault,
      color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      path: "/financials/inputs/deposits",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "out-of-stock",
      category: "financials",
      titleEn: "Out of Stock",
      titleAr: "نواقص الرفوف والمخزن",
      subtitleEn: "Missing shelf items tracker",
      subtitleAr: "سجل متابعة الأصناف المفقودة",
      icon: AlertTriangle,
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      path: "/products/out-of-stock",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "voids",
      category: "financials",
      titleEn: "Voids & Returns",
      titleAr: "إلغاءات المبيعات",
      subtitleEn: "Approve POS item returns",
      subtitleAr: "اعتماد مرتجعات ورجوع الاصناف",
      icon: PackageX,
      color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      path: "/voids/manager",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "shift-audit",
      category: "financials",
      titleEn: "Shift Audit",
      titleAr: "مراجعة الورديات",
      subtitleEn: "Reconcile cash & safe drops",
      subtitleAr: "تدقيق السلف واغلاق الخزينة",
      icon: FileCheck2,
      color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      path: "/shift-reports/manager",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "margin-strategy",
      category: "financials",
      titleEn: "Margin Strategy",
      titleAr: "استراتيجية الهامش",
      subtitleEn: "Profit margin analytics",
      subtitleAr: "تحليلات هامش الربح والأسعار",
      icon: Percent,
      color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      path: "/margin-strategy",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "rtv",
      category: "financials",
      titleEn: "Returns (RTV)",
      titleAr: "إيصال مرتجع موردين",
      subtitleEn: "Generate RTV voucher",
      subtitleAr: "إنشاء إيصالات ارتجاع الموردين",
      icon: RotateCcw,
      color: "bg-rose-600/15 text-rose-300 border-rose-600/30",
      path: "/dashboard/supplier-returns",
      rolesAllowed: ["admin", "manager"],
    },

    // --- PRODUCTS & INVENTORY ---
    {
      id: "expiries",
      category: "products",
      titleEn: "Expiries Audit",
      titleAr: "سجل الصلاحيات",
      subtitleEn: "Log near-expiry shelf items",
      subtitleAr: "تسجيل المنتجات قريبة الانتهاء",
      icon: Clock,
      color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      path: "/expiries",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "lookup",
      category: "products",
      titleEn: "Product Lookup",
      titleAr: "البحث عن صنف",
      subtitleEn: "Rapid price & SKU check",
      subtitleAr: "استعلام الأسعار والباركود",
      icon: Search,
      color: "bg-violet-500/15 text-violet-400 border-violet-500/30",
      path: "/cashier/lookup",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "inventory-audit",
      category: "products",
      titleEn: "Blind Audit",
      titleAr: "جرد المخزون العمياء",
      subtitleEn: "Manager stock audit",
      subtitleAr: "جرد وجدول كميات المخزون",
      icon: Boxes,
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      path: "/inventory-audit/manager",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "supplier-orders",
      category: "products",
      titleEn: "Order with Supplier",
      titleAr: "طلب طلبية للمورد",
      subtitleEn: "Create supplier purchase orders",
      subtitleAr: "إرسال الطلبيات للموردين",
      icon: Truck,
      color: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
      path: "/products/supplier-orders",
      rolesAllowed: ["admin", "manager"],
    },

    // --- OPERATIONS ---
    {
      id: "checklists",
      category: "operations",
      titleEn: "Checklists",
      titleAr: "قوائم التفتيش والنظافة",
      subtitleEn: "Review store audit checklists",
      subtitleAr: "مراجعة قوائم التفتيش المكتملة",
      icon: ClipboardCheck,
      color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      path: "/checklists/manager",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "cleaning",
      category: "operations",
      titleEn: "Cleaning Logs",
      titleAr: "سجلات النظافة والتعقيم",
      subtitleEn: "Daily store sanitation log",
      subtitleAr: "متابعة النظافة والتعقيم",
      icon: FileText,
      color: "bg-sky-400/15 text-sky-300 border-sky-400/30",
      path: "/checklists/cleaning",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "lost-found",
      category: "operations",
      titleEn: "Lost & Found",
      titleAr: "المفقودات والمعثور عليها",
      subtitleEn: "Customer left items tracker",
      subtitleAr: "سجل الأغراض المفقودة للعملاء",
      icon: HelpCircle,
      color: "bg-purple-400/15 text-purple-300 border-purple-400/30",
      path: "/lost-found",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "offers",
      category: "operations",
      titleEn: "Manage Offers",
      titleAr: "إدارة العروض والخصومات",
      subtitleEn: "Active promotions & discounts",
      subtitleAr: "عروض المتجر والخصومات النشطة",
      icon: Tag,
      color: "bg-rose-400/15 text-rose-300 border-rose-400/30",
      path: "/offers",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "food-codes",
      category: "operations",
      titleEn: "Food Codes",
      titleAr: "أكواد الوجبات والمشروبات",
      subtitleEn: "Fresh food SKU codes",
      subtitleAr: "دليل أكواد المأكولات والمشروبات",
      icon: Utensils,
      color: "bg-amber-400/15 text-amber-300 border-amber-400/30",
      path: "/food-codes",
      rolesAllowed: ["admin", "manager", "cashier"],
    },

    // --- HR & STAFF ---
    {
      id: "employees",
      category: "hr",
      titleEn: "Employees",
      titleAr: "دليل الموظفين",
      subtitleEn: "Staff directory & files",
      subtitleAr: "بيانات الموظفين والملفات",
      icon: Users,
      color: "bg-teal-400/15 text-teal-300 border-teal-400/30",
      path: "/hr/employees",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "cashier-accounts",
      category: "hr",
      titleEn: "Cashier Accounts",
      titleAr: "حسابات الكاشيرية",
      subtitleEn: "POS credentials & PINs",
      subtitleAr: "إدارة كشوفات وحسابات الكاشير",
      icon: UserCheck,
      color: "bg-indigo-400/15 text-indigo-300 border-indigo-400/30",
      path: "/hr/cashiers",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "payroll",
      category: "hr",
      titleEn: "Payroll System",
      titleAr: "نظام الرواتب والأجور",
      subtitleEn: "Monthly salaries & bonuses",
      subtitleAr: "حساب المرتبات والحوافز",
      icon: Coins,
      color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      path: "/hr/payroll",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "loans",
      category: "hr",
      titleEn: "Adjustments & Loans",
      titleAr: "السلف والخصومات",
      subtitleEn: "Employee advance payments",
      subtitleAr: "سجل السلفيات وخصميات الموظفين",
      icon: DollarSign,
      color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      path: "/hr/loans",
      rolesAllowed: ["admin", "manager"],
    },
    {
      id: "scheduler",
      category: "hr",
      titleEn: "Smart Scheduler",
      titleAr: "جدول الورديات الذكي",
      subtitleEn: "Shift roster & timetables",
      subtitleAr: "جدولة ساعات العمل والورديات",
      icon: Calendar,
      color: "bg-blue-400/15 text-blue-300 border-blue-400/30",
      path: "/hr/scheduler",
      rolesAllowed: ["admin", "manager"],
    },

    // --- ADMIN (Admin Role Only) ---
    {
      id: "user-management",
      category: "admin",
      titleEn: "User Management",
      titleAr: "إدارة المستخدمين والصلاحيات",
      subtitleEn: "Roles & access control",
      subtitleAr: "إدارة الصلاحيات والمستخدمين",
      icon: Lock,
      color: "bg-red-500/15 text-red-400 border-red-500/30",
      path: "/admin/users",
      rolesAllowed: ["admin"],
    },
    {
      id: "inventory-predict",
      category: "admin",
      titleEn: "Inventory Predict",
      titleAr: "التنبؤ الذكي بالمخزون",
      subtitleEn: "AI demand forecasting",
      subtitleAr: "التنبؤ بطلب واستنزاف الاصناف",
      icon: Sparkles,
      color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      path: "/admin/inventory-predict",
      rolesAllowed: ["admin"],
    },
    {
      id: "send-notifications",
      category: "admin",
      titleEn: "Send Notifications",
      titleAr: "إرسال الإشعارات للجميع",
      subtitleEn: "Broadcast mobile push alerts",
      subtitleAr: "إرسال تنبيهات فورية للموظفين",
      icon: Bell,
      color: "bg-amber-400/15 text-amber-300 border-amber-400/30",
      path: "/admin/send-notifications",
      rolesAllowed: ["admin"],
    },
  ];

  // Dynamically filter actions by current user's role, selected category tab, and search query
  const normRole = (userRole || "manager").toLowerCase();

  const filteredActions = QUICK_ACTIONS.filter((action) => {
    // 1. Role Security Check (Case-insensitive with fallback)
    if (action.rolesAllowed && action.rolesAllowed.length > 0) {
      const allowedLower = action.rolesAllowed.map((r) => r.toLowerCase());
      const isAllowed =
        normRole === "admin" ||
        allowedLower.includes(normRole) ||
        (normRole === "manager" && (allowedLower.includes("manager") || allowedLower.includes("cashier")));

      if (!isAllowed) return false;
    }

    // 2. Category Tab Filter
    if (selectedCategory !== "all" && action.category !== selectedCategory) {
      return false;
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEn = action.titleEn.toLowerCase().includes(q) || action.subtitleEn.toLowerCase().includes(q);
      const matchAr = action.titleAr.toLowerCase().includes(q) || action.subtitleAr.toLowerCase().includes(q);
      if (!matchEn && !matchAr) return false;
    }
    return true;
  });

  return (
    <>
      {/* 1. Backdrop Overlay for FAB & Quick Sheet */}
      <AnimatePresence>
        {(fabOpen || statusSheetOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setFabOpen(false);
              setStatusSheetOpen(false);
            }}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md md:hidden"
          />
        )}
      </AnimatePresence>

      {/* 2. Store Status Quick Sheet (Swipe-Up Drawer) */}
      <AnimatePresence>
        {statusSheetOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 left-3 right-3 z-50 p-4 rounded-3xl bg-[#0B1121] border border-[rgba(34,211,238,0.25)] text-white shadow-2xl backdrop-blur-2xl md:hidden"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="w-12 h-1 bg-[#1E293B] rounded-full mx-auto mb-3 cursor-pointer" onClick={toggleStatusSheet} />
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-100">
                  <Store className="w-4 h-4 text-cyan-400" />
                  {currentBranch === "all" ? (isAr ? "جميع الفروع" : "All Branches") : currentBranch === "ola" ? "Ola El Koronfol" : "El Alamein 4"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? "ملخص النشاط والتنبيهات المباشرة" : "Real-time store metrics & floor alerts"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0F172A] border border-[rgba(34,211,238,0.2)]">
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-emerald-400">{isAr ? "متصل" : "Online"}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-400">{isAr ? "محلي offline" : "Offline"}</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-3 rounded-2xl bg-[#0F172A] border border-[rgba(34,211,238,0.15)]">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> {isAr ? "مبيعات اليوم" : "Today Sales"}
                </span>
                <span className="text-base font-extrabold text-white mt-1 block">Live Sync</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#0F172A] border border-[rgba(34,211,238,0.15)]">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3 text-cyan-400" /> {isAr ? "الورديات المعلقة" : "Pending Shifts"}
                </span>
                <span className="text-base font-extrabold text-cyan-400 mt-1 block">{pendingShiftsCount} {isAr ? "وردية" : "Shifts"}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-amber-400">{isAr ? "التنبيهات الميدانية" : "Floor Alerts"}</p>
                <p className="text-amber-200/80">
                  {totalPending > 0
                    ? isAr
                      ? `يوجد ${totalPending} إجراءات تنتظر اعتماد المدير`
                      : `You have ${totalPending} items pending manager sign-off`
                    : isAr
                    ? "جميع البيانات متزنة ولا يوجد تنبيهات"
                    : "All shifts balanced & clear"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Center FAB Quick Action Drawer (Role Secured & Categorized Hub) */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-24 left-3 right-3 z-50 p-4 rounded-3xl bg-[#0B1121] border border-[rgba(34,211,238,0.3)] text-white shadow-[0_15px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl md:hidden max-h-[80vh] flex flex-col"
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Top Swipe Indicator Pill */}
            <div className="w-12 h-1 bg-[#1E293B] rounded-full mx-auto mb-3 cursor-pointer shrink-0" onClick={toggleFab} />

            {/* Header & Close Button */}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#1E293B] shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                  {isAr ? "مركز أفعال النظام الميدانية" : "Portal Command Hub"}
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase font-black">
                    {normRole}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isAr ? "جميع الأدوات والصفحات المتاحة لحسابك" : "All authorized portal tools & pages"}
                </p>
              </div>
              <button
                onClick={toggleFab}
                className="p-1.5 rounded-full bg-[#1E293B] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={isAr ? "ابحث في جميع أدوات وصفحات النظام..." : "Search 28+ portal tools & pages..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#0F172A] border border-[rgba(34,211,238,0.2)] text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400 font-bold"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 hide-scrollbar shrink-0">
              {CATEGORIES.filter(cat => !cat.adminOnly || normRole === "admin").map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      triggerHapticFeedback(8);
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 ${
                      isActive
                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                        : "bg-[#0F172A] text-slate-400 hover:text-slate-200 border border-[#1E293B]"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{isAr ? cat.labelAr : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions Grid (Scrollable) */}
            <div className="overflow-y-auto pr-1 flex-1 space-y-3 custom-scrollbar">
              {filteredActions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-[#0F172A] border border-[#1E293B]">
                  No matching tools found for "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 pb-2">
                  {filteredActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleNavClick(action.id, action.path)}
                        className="p-3 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] border border-[rgba(34,211,238,0.15)] flex items-start gap-2.5 text-left transition-all active:scale-95 group"
                      >
                        <div className={`p-2 rounded-xl border ${action.color} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-black text-slate-100 group-hover:text-cyan-400 truncate tracking-tight">
                            {isAr ? action.titleAr : action.titleEn}
                          </h4>
                          <p className="text-[9px] text-slate-400 truncate mt-0.5 font-medium">
                            {isAr ? action.subtitleAr : action.subtitleEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Manager Mobile Glassmorphic Bottom Navigation Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden pt-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="relative mx-3 flex items-center justify-between px-3 py-2.5 rounded-3xl bg-[#0B1121]/90 border border-[rgba(34,211,238,0.25)] shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-slate-400">
          
          {/* Top Swipe-Up Drawer Trigger Handle Pill (Cleanly floating above bottom bar with zero overlap) */}
          <button
            onClick={toggleStatusSheet}
            className="absolute -top-5.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#050B14] border border-[rgba(34,211,238,0.4)] text-[10px] font-black text-cyan-400 flex items-center gap-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.9)] z-40 cursor-pointer hover:border-cyan-300 transition-all active:scale-95 tracking-wide"
          >
            <ChevronUp className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-300 ${statusSheetOpen ? "rotate-180" : ""}`} />
            <span className="leading-none">{isAr ? "حالة الفرع المباشرة" : "Live Pulse"}</span>
            {isOnline ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Left Tab 1: Overview */}
          <button
            onClick={() => handleNavClick("overview", "/financials/inputs")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all outline-none cursor-pointer active:scale-95 ${
              activeTab === "overview" ? "text-cyan-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" strokeWidth={activeTab === "overview" ? 2.5 : 2} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1">{isAr ? "الرئيسية" : "Overview"}</span>
            {activeTab === "overview" && (
              <motion.div layoutId="managerNavIndicator" className="w-6 h-1 rounded-full mt-0.5 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}
          </button>

          {/* Left Tab 2: Approvals */}
          <button
            onClick={() => handleNavClick("approvals", "/shift-reports/manager")}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-all outline-none cursor-pointer active:scale-95 ${
              activeTab === "approvals" ? "text-cyan-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-5 h-5" strokeWidth={activeTab === "approvals" ? 2.5 : 2} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1">{isAr ? "الاعتمادات" : "Approvals"}</span>
            {activeTab === "approvals" && (
              <motion.div layoutId="managerNavIndicator" className="w-6 h-1 rounded-full mt-0.5 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}

            {/* Pulsing Badge */}
            {totalPending > 0 && (
              <span className="absolute top-0.5 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white shadow-lg shadow-rose-600/50 animate-pulse border border-rose-400">
                {totalPending}
              </span>
            )}
          </button>

          {/* Center Elevated Morphing Action Button (Cyan Glow) */}
          <div className="relative -top-4 flex justify-center flex-1">
            <motion.button
              onClick={toggleFab}
              whileTap={{ scale: 0.9 }}
              animate={{ rotate: fabOpen ? 45 : 0, backgroundColor: fabOpen ? "#ef4444" : "#22d3ee" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-13 h-13 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.6)] border-2 border-white/20 z-50 cursor-pointer outline-none"
              style={{ width: "52px", height: "52px" }}
            >
              <Plus className="w-6 h-6 stroke-[2.5] text-white" />
            </motion.button>
          </div>

          {/* Right Tab 3: Financials */}
          <button
            onClick={() => handleNavClick("financials", "/financial-reports")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all outline-none cursor-pointer active:scale-95 ${
              activeTab === "financials" ? "text-cyan-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-5 h-5" strokeWidth={activeTab === "financials" ? 2.5 : 2} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1">{isAr ? "التقارير" : "Financials"}</span>
            {activeTab === "financials" && (
              <motion.div layoutId="managerNavIndicator" className="w-6 h-1 rounded-full mt-0.5 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}
          </button>

          {/* Right Tab 4: AI Assistant */}
          <button
            onClick={() => handleNavClick("ai", "/ai-assistant")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all outline-none cursor-pointer active:scale-95 ${
              activeTab === "ai" ? "text-cyan-400 font-extrabold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="w-5 h-5" strokeWidth={activeTab === "ai" ? 2.5 : 2} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider mt-1">{isAr ? "المساعد" : "Ask AI"}</span>
            {activeTab === "ai" && (
              <motion.div layoutId="managerNavIndicator" className="w-6 h-1 rounded-full mt-0.5 bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
