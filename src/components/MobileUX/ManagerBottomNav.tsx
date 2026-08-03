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
  ChevronUp,
  AlertTriangle,
  Users,
  Store,
  Banknote,
  Vault,
  ClipboardCheck,
  Boxes,
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

// Obsidian Design Tokens
const O = {
  bg: '#09090B',
  surface: '#18181B',
  elevated: '#27272A',
  border: 'rgba(255,255,255,0.06)',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textDim: '#52525B',
  rose: '#E11D48',
  orange: '#F97316',
  success: '#22C55E',
  amber: '#F59E0B',
};

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

  // Update active tab based on current pathname & prefetch common routes
  useEffect(() => {
    if (pathname.includes("/financials/inputs")) setActiveTab("overview");
    else if (pathname.includes("/shift-reports/manager") || pathname.includes("/voids/manager")) setActiveTab("approvals");
    else if (pathname.includes("/financial-reports")) setActiveTab("financials");
    else if (pathname.includes("/ai-assistant")) setActiveTab("ai");

    const routesToPrefetch = [
      "/financials/inputs",
      "/financials/inputs/sales",
      "/financials/inputs/payments",
      "/financials/inputs/credits",
      "/financials/inputs/deposits",
      "/shift-reports/manager",
      "/voids/manager",
      "/financial-reports/vendor-statements",
      "/ai-assistant"
    ];
    routesToPrefetch.forEach(r => {
      try { router.prefetch(r); } catch(e) {}
    });
  }, [pathname, router]);

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
      accent: O.rose,
      path: "/ai-assistant",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "official-documents",
      category: "operations",
      titleEn: "Official Documents",
      titleAr: "المستندات والإيصالات الرسمية",
      subtitleEn: "View payslips & admin receipts",
      subtitleAr: "سجل المفردات والإيصالات الرسمية",
      icon: FileCheck2,
      accent: O.success,
      path: "/manager/documents",
      rolesAllowed: ["admin", "manager", "cashier"],
    },
    {
      id: "admin-send-doc",
      category: "admin",
      titleEn: "Send Document (Admin)",
      titleAr: "إرسال مستند رسمي للمدير",
      subtitleEn: "Dispatch payslips & receipts",
      subtitleAr: "إرسال الإيصالات والمرتبات للمدير",
      icon: FileText,
      accent: '#06B6D4',
      path: "/admin/send-document",
      rolesAllowed: ["admin"],
    },
    {
      id: "financial-inputs",
      category: "financials",
      titleEn: "Financial Inputs",
      titleAr: "مدخلات النظام المالي",
      subtitleEn: "Inputs overview & live feed",
      subtitleAr: "لوحة تحكم المدخلات المالية",
      icon: LayoutDashboard,
      accent: '#38BDF8',
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
      accent: '#818CF8',
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
      accent: O.success,
      path: "/financials/detailed-sales",
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
      accent: '#2DD4BF',
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
      accent: '#A78BFA',
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
      accent: '#06B6D4',
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
      accent: O.amber,
      path: "/financials/out-of-stock",
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
      accent: '#FB7185',
      path: "/voids/manager",
      rolesAllowed: ["admin", "manager"],
      priority: true,
    },
    {
      id: "shift-audit",
      category: "financials",
      titleEn: "Shift Audit",
      titleAr: "مراجعة الورديات",
      subtitleEn: "Reconcile cash & safe drops",
      subtitleAr: "تدقيق السلف واغلاق الخزينة",
      icon: FileCheck2,
      accent: '#06B6D4',
      path: "/shift-reports/manager",
      rolesAllowed: ["admin", "manager"],
      priority: true,
    },
    {
      id: "margin-strategy",
      category: "financials",
      titleEn: "Margin Strategy",
      titleAr: "استراتيجية الهامش",
      subtitleEn: "Profit margin analytics",
      subtitleAr: "تحليلات هامش الربح والأسعار",
      icon: Percent,
      accent: '#60A5FA',
      path: "/dashboard/margin-calculator",
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
      accent: '#FB7185',
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
      accent: O.orange,
      path: "/products/expiries-audit",
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
      accent: '#8B5CF6',
      path: "/admin/product-lookup",
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
      accent: O.amber,
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
      accent: '#34D399',
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
      accent: '#60A5FA',
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
      accent: '#38BDF8',
      path: "/admin/cleaning",
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
      accent: '#A78BFA',
      path: "/admin/lost-and-found",
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
      accent: '#FB7185',
      path: "/admin/offers",
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
      accent: O.amber,
      path: "/admin/food-codes",
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
      accent: '#2DD4BF',
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
      accent: '#818CF8',
      path: "/settings/cashiers",
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
      accent: '#34D399',
      path: "/admin/payroll",
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
      accent: O.amber,
      path: "/admin/adjustments",
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
      accent: '#60A5FA',
      path: "/admin/schedule",
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
      accent: O.rose,
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
      accent: '#A78BFA',
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
      accent: O.amber,
      path: "/settings/notifications",
      rolesAllowed: ["admin"],
    },
  ];

  // Dynamically filter actions by current user's role, selected category tab, and search query
  const normRole = (userRole || "manager").toLowerCase();

  const filteredActions = QUICK_ACTIONS.filter((action) => {
    // 1. Role Security Check
    if (action.rolesAllowed && action.rolesAllowed.length > 0) {
      const isAllowed =
        normRole.includes("admin") ||
        normRole.includes("editor") ||
        normRole.includes("super") ||
        normRole.includes("owner") ||
        normRole.includes("manager") ||
        action.rolesAllowed.some((r) => normRole.includes(r.toLowerCase()) || r.toLowerCase().includes(normRole));
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

  // Fallback: If search is empty, guarantee pages are displayed
  const displayActions =
    filteredActions.length === 0 && !searchQuery.trim()
      ? QUICK_ACTIONS.filter((a) => selectedCategory === "all" || a.category === selectedCategory)
      : filteredActions;

  // Group actions by category for list view
  const groupedActions = React.useMemo(() => {
    const groups: Record<string, typeof displayActions> = {};
    displayActions.forEach(action => {
      if (!groups[action.category]) groups[action.category] = [];
      groups[action.category].push(action);
    });
    return groups;
  }, [displayActions]);

  const categoryLabel = (catId: string) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat ? (isAr ? cat.labelAr : cat.labelEn) : catId;
  };

  // Bottom Nav Tab Items
  const tabs = [
    { id: "overview", labelEn: "Home", labelAr: "الرئيسية", icon: LayoutDashboard, path: "/financials/inputs" },
    { id: "approvals", labelEn: "Approvals", labelAr: "الاعتمادات", icon: Zap, path: "/shift-reports/manager" },
    { id: "financials", labelEn: "Reports", labelAr: "التقارير", icon: TrendingUp, path: "/financial-reports" },
    { id: "ai", labelEn: "AI", labelAr: "المساعد", icon: Bot, path: "/ai-assistant" },
  ];

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <AnimatePresence>
        {(fabOpen || statusSheetOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setFabOpen(false); setStatusSheetOpen(false); }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          />
        )}
      </AnimatePresence>

      {/* 2. Store Status Quick Sheet */}
      <AnimatePresence>
        {statusSheetOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-[90px] left-4 right-4 z-50 md:hidden"
            style={{
              background: O.surface,
              border: `1px solid ${O.border}`,
              borderRadius: 24,
              padding: 20,
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            }}
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Drag Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: O.elevated, margin: '0 auto 16px' }} onClick={toggleStatusSheet} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: O.textPrimary, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <Store size={16} color={O.rose} />
                  {currentBranch === "all" ? (isAr ? "جميع الفروع" : "All Branches") : currentBranch === "ola" ? "Ola El Koronfol" : "El Alamein 4"}
                </h3>
                <p style={{ fontSize: 11, color: O.textSecondary, margin: '4px 0 0' }}>
                  {isAr ? "ملخص النشاط والتنبيهات المباشرة" : "Real-time store metrics & floor alerts"}
                </p>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20,
                fontSize: 11, fontWeight: 800,
                background: O.bg, border: `1px solid ${O.border}`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isOnline ? O.success : O.amber,
                  boxShadow: isOnline ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
                }} />
                <span style={{ color: isOnline ? O.success : O.amber }}>
                  {isOnline ? (isAr ? "متصل" : "Online") : (isAr ? "غير متصل" : "Offline")}
                </span>
              </div>
            </div>

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 14, borderRadius: 16, background: O.bg, border: `1px solid ${O.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: O.textDim, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12} color={O.success} /> {isAr ? "مبيعات اليوم" : "Today Sales"}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: O.textPrimary, marginTop: 6, display: 'block' }}>Live Sync</span>
              </div>
              <div style={{ padding: 14, borderRadius: 16, background: O.bg, border: `1px solid ${O.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: O.textDim, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} color={O.rose} /> {isAr ? "الورديات المعلقة" : "Pending Shifts"}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: O.rose, marginTop: 6, display: 'block' }}>{pendingShiftsCount} {isAr ? "وردية" : "Shifts"}</span>
              </div>
            </div>

            {/* Floor Alert */}
            <div style={{
              padding: 14, borderRadius: 16,
              background: 'rgba(249,115,22,0.06)',
              border: '1px solid rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AlertTriangle size={18} color={O.orange} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: O.orange, margin: 0 }}>
                  {isAr ? "التنبيهات الميدانية" : "Floor Alerts"}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(249,115,22,0.7)', margin: '2px 0 0' }}>
                  {totalPending > 0
                    ? isAr ? `يوجد ${totalPending} إجراءات تنتظر اعتماد المدير` : `You have ${totalPending} items pending manager sign-off`
                    : isAr ? "جميع البيانات متزنة ولا يوجد تنبيهات" : "All shifts balanced & clear"}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Center FAB Quick Action Drawer */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-[90px] left-4 right-4 z-50 md:hidden"
            style={{
              background: O.surface,
              border: `1px solid ${O.border}`,
              borderRadius: 24,
              padding: 20,
              boxShadow: '0 -20px 80px rgba(0,0,0,0.8)',
              maxHeight: '72vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Drag Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: O.elevated, margin: '0 auto 14px', flexShrink: 0 }} onClick={toggleFab} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${O.border}`, flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: O.textPrimary, display: 'flex', alignItems: 'center', gap: 8, margin: 0, letterSpacing: '-0.01em' }}>
                  <Zap size={16} color={O.rose} fill={O.rose} />
                  {isAr ? "مركز القيادة" : "Command Hub"}
                  <span style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(225,29,72,0.1)', color: '#FB7185',
                    border: '1px solid rgba(225,29,72,0.15)',
                    textTransform: 'uppercase', fontWeight: 900,
                  }}>
                    {normRole}
                  </span>
                </h3>
                <p style={{ fontSize: 11, color: O.textSecondary, margin: '4px 0 0' }}>
                  {isAr ? "جميع الأدوات والصفحات المتاحة" : "All authorized portal tools & pages"}
                </p>
              </div>
              <button
                onClick={toggleFab}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: O.elevated, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: O.textSecondary,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: 14, flexShrink: 0 }}>
              <Search size={15} color={O.textDim} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={isAr ? "ابحث في أدوات النظام..." : "Search portal tools..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px 11px 40px',
                  borderRadius: 14, fontSize: 12, fontWeight: 700,
                  background: O.bg, border: `1px solid ${O.border}`,
                  color: O.textPrimary, outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: O.textDim,
                    fontSize: 11, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 6, flexShrink: 0, scrollbarWidth: 'none' }}>
              {CATEGORIES.filter((cat) => !cat.adminOnly || normRole.includes("admin") || normRole.includes("editor")).map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      triggerHapticFeedback(8);
                      setSelectedCategory(cat.id);
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 10,
                      fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: isActive ? `linear-gradient(135deg, ${O.rose}, ${O.orange})` : O.bg,
                      color: isActive ? '#fff' : O.textSecondary,
                      border: isActive ? 'none' : `1px solid ${O.border}`,
                      boxShadow: isActive ? '0 4px 12px rgba(225,29,72,0.25)' : 'none',
                    }}
                  >
                    <Icon size={12} />
                    <span>{isAr ? cat.labelAr : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions List */}
            <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'none' }}>
              {displayActions.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: O.textDim, fontSize: 12, borderRadius: 16, background: O.bg, border: `1px solid ${O.border}` }}>
                  No matching tools found for &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : selectedCategory === "all" && !searchQuery.trim() ? (
                // Grouped list view
                Object.entries(groupedActions).map(([catId, actions]) => (
                  <div key={catId} style={{ marginBottom: 16 }}>
                    <h4 style={{
                      fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                      color: O.textDim, letterSpacing: '0.08em',
                      margin: '0 0 8px 4px',
                    }}>
                      {categoryLabel(catId)}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {actions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            onClick={() => handleNavClick(action.id, action.path)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 14px', borderRadius: 14, width: '100%',
                              background: O.bg, border: `1px solid ${O.border}`,
                              cursor: 'pointer', transition: 'all 0.15s',
                              textAlign: isAr ? 'right' : 'left',
                              borderLeft: (action as any).priority && !isAr ? `3px solid ${O.orange}` : undefined,
                              borderRight: (action as any).priority && isAr ? `3px solid ${O.orange}` : undefined,
                            }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `${action.accent}12`,
                              border: `1px solid ${action.accent}20`,
                            }}>
                              <Icon size={18} color={action.accent} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{
                                fontSize: 13, fontWeight: 800, color: O.textPrimary,
                                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                letterSpacing: '-0.01em',
                              }}>
                                {isAr ? action.titleAr : action.titleEn}
                              </h4>
                              <p style={{ fontSize: 10, color: O.textDim, margin: '2px 0 0', fontWeight: 600 }}>
                                {isAr ? action.subtitleAr : action.subtitleEn}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                // Filtered grid view
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingBottom: 8 }}>
                  {displayActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleNavClick(action.id, action.path)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: 14, borderRadius: 14, width: '100%',
                          background: O.bg, border: `1px solid ${O.border}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                          textAlign: isAr ? 'right' : 'left',
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${action.accent}12`,
                          border: `1px solid ${action.accent}20`,
                        }}>
                          <Icon size={16} color={action.accent} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{
                            fontSize: 12, fontWeight: 800, color: O.textPrimary,
                            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {isAr ? action.titleAr : action.titleEn}
                          </h4>
                          <p style={{ fontSize: 9, color: O.textDim, margin: '2px 0 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

      {/* 4. Floating Island Bottom Navigation Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden print:hidden"
        style={{ paddingTop: 16, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div style={{
          position: 'relative',
          margin: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 8px',
          borderRadius: 22,
          background: `${O.surface}F5`,
          border: `1px solid ${O.border}`,
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        }}>

          {/* Live Pulse Handle */}
          {!fabOpen && (
            <button
              onClick={toggleStatusSheet}
              style={{
                position: 'absolute',
                top: -22,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '5px 16px',
                borderRadius: 20,
                background: O.bg,
                border: `1px solid ${O.border}`,
                fontSize: 10, fontWeight: 900, color: O.textSecondary,
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', zIndex: 40,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              <ChevronUp size={13} color={O.textSecondary} style={{ transition: 'transform 0.3s', transform: statusSheetOpen ? 'rotate(180deg)' : 'none' }} />
              <span>{isAr ? "حالة المتجر" : "Live Pulse"}</span>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isOnline ? O.success : O.amber,
                boxShadow: isOnline ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
              }} />
            </button>
          )}

          {/* Left Tabs */}
          {tabs.slice(0, 2).map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleNavClick(tab.id, tab.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', flex: 1, padding: '4px 0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? O.textPrimary : O.textDim,
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} color={isActive ? O.textPrimary : O.textDim} />
                <span style={{ fontSize: 10, fontWeight: 800, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isAr ? tab.labelAr : tab.labelEn}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="obsidianNavDot"
                    style={{
                      width: 5, height: 5, borderRadius: '50%', marginTop: 3,
                      background: `linear-gradient(135deg, ${O.rose}, ${O.orange})`,
                      boxShadow: `0 0 10px rgba(225,29,72,0.6)`,
                    }}
                  />
                )}
                {/* Pending badge for Approvals */}
                {tab.id === "approvals" && totalPending > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 6,
                    padding: '1px 5px', borderRadius: 8,
                    fontSize: 9, fontWeight: 900,
                    background: O.rose, color: '#fff',
                    boxShadow: `0 2px 8px rgba(225,29,72,0.5)`,
                    border: `1.5px solid ${O.surface}`,
                  }}>
                    {totalPending}
                  </span>
                )}
              </button>
            );
          })}

          {/* Center FAB */}
          <div style={{ position: 'relative', top: -18, display: 'flex', justifyContent: 'center', flex: 1 }}>
            <motion.button
              onClick={toggleFab}
              whileTap={{ scale: 0.9 }}
              animate={{
                rotate: fabOpen ? 45 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{
                width: 52, height: 52, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: fabOpen ? '#EF4444' : `linear-gradient(135deg, ${O.rose}, ${O.orange})`,
                border: '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', outline: 'none',
                boxShadow: fabOpen
                  ? '0 0 20px rgba(239,68,68,0.4)'
                  : `0 0 25px rgba(225,29,72,0.4), 0 8px 20px rgba(0,0,0,0.4)`,
              }}
            >
              <Plus size={24} strokeWidth={2.5} color="#fff" />
            </motion.button>
          </div>

          {/* Right Tabs */}
          {tabs.slice(2).map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleNavClick(tab.id, tab.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', flex: 1, padding: '4px 0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? O.textPrimary : O.textDim,
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} color={isActive ? O.textPrimary : O.textDim} />
                <span style={{ fontSize: 10, fontWeight: 800, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isAr ? tab.labelAr : tab.labelEn}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="obsidianNavDot"
                    style={{
                      width: 5, height: 5, borderRadius: '50%', marginTop: 3,
                      background: `linear-gradient(135deg, ${O.rose}, ${O.orange})`,
                      boxShadow: `0 0 10px rgba(225,29,72,0.6)`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
