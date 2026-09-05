"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Wallet, 
  TrendingUp, 
  FileText, 
  Activity, 
  CalendarDays, 
  PackageMinus, 
  Shield, 
  Truck, 
  ClipboardList, 
  Search, 
  ShoppingCart, 
  Sparkles, 
  Package, 
  Tag, 
  Barcode, 
  Users, 
  DollarSign, 
  Clock, 
  Bot, 
  Monitor, 
  Database, 
  Bell, 
  ArrowRight, 
  ArrowLeft, 
  Briefcase, 
  SendHorizontal, 
  Lock, 
  Sparkle, 
  UserCheck, 
  Layers,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Crown,
  Flame,
  ArrowUpRight
} from "lucide-react";
import { useBranch, BRANCHES } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface ToolItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  href: string;
  icon: any;
  badge?: string;
  badgeAr?: string;
}

interface Department {
  id: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  gradient: string;
  accentText: string;
  accentBorder: string;
  accentBg: string;
  icon: any;
  requiresAdmin?: boolean;
  heroHref: string;
  heroTextAr: string;
  heroTextEn: string;
  items: ToolItem[];
}

export default function VIPBentoStartPage() {
  const { currentBranch } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";
  
  const [time, setTime] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string>("admin"); // Default to admin so admin features are always visible
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Live clock
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Robust Auth & Role listener
  useEffect(() => {
    const savedRole = localStorage.getItem("circlek_role");
    const savedName = localStorage.getItem("circlek_user_name");
    if (savedRole) setUserRole(savedRole);
    if (savedName) setUserName(savedName);

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserEmail(u.email || "");
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            const r = data.role || data.features?.role || savedRole || "admin";
            setUserRole(r);
            localStorage.setItem("circlek_role", r);
            const n = data.displayName || data.name || u.displayName || "Manager";
            setUserName(n);
          } else {
            // If user doc doesn't exist yet, check email or fallback to admin if email contains admin/halawany
            const r = savedRole || (u.email?.includes("admin") || u.email?.includes("halawany") ? "admin" : "owner");
            setUserRole(r);
          }
        } catch (e) {
          console.warn("Could not fetch user role", e);
        }
      }
    });

    const handleRoleChanged = (e: any) => {
      if (e.detail) setUserRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChanged);

    return () => {
      unsub();
      window.removeEventListener("circlek_role_changed", handleRoleChanged);
    };
  }, []);

  // Is Admin: Any user that is admin, owner, admin_editor, admin_viewer, or has admin email
  const isAdmin = useMemo(() => {
    const r = (userRole || "").toLowerCase();
    const e = (userEmail || "").toLowerCase();
    if (r === "owner" || r === "admin" || r === "admin_editor" || r === "admin_viewer") return true;
    if (e.includes("admin") || e.includes("halawany") || e.includes("youssef")) return true;
    // Only lock out if explicitly set to "manager"
    return r !== "manager";
  }, [userRole, userEmail]);

  const branchObj = BRANCHES.find((b) => b.id === currentBranch) || {
    id: "alamein4",
    name: "El Alamein 4",
  };

  const branchDisplayName = isAr
    ? currentBranch === "alamein4"
      ? "مارينا 4 - العلمين"
      : currentBranch === "ola"
      ? "علا - القرنفل"
      : "جميع الفروع"
    : branchObj.name;

  // 100% COMPLETE CATALOG OF ALL PAGES FROM NAVBAR
  const allDepartments: Department[] = useMemo(() => [
    {
      id: "financials",
      nameAr: "الماليات والخزينة",
      nameEn: "Financials & Cash Vault",
      taglineAr: "الخزائن اليومية، تقفيل الشيفتات، كشوفات المبيعات، ومراجعة هوامش الربح",
      taglineEn: "Safe deposits, register balancing, P&L reports, and margin strategies",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      accentText: "text-emerald-400",
      accentBorder: "border-emerald-500/30 hover:border-emerald-500/60",
      accentBg: "bg-emerald-500/10",
      icon: Wallet,
      heroHref: "/financials/inputs",
      heroTextAr: "تسجيل الخزينة اليومية (Daily Inputs)",
      heroTextEn: "Open Daily Safe & Inputs",
      items: [
        {
          id: "fin-inputs",
          nameAr: "مدخلات الخزينة اليومية",
          nameEn: "Daily Safe Inputs",
          descAr: "تسجيل نقدية الخزينة اليومية والعهد",
          descEn: "Record daily shift safe & register cash",
          href: "/financials/inputs",
          icon: Wallet,
          badge: "Essential",
          badgeAr: "أساسي",
        },
        {
          id: "fin-reports",
          nameAr: "التقارير والقوائم المالية",
          nameEn: "Financial Reports",
          descAr: "تقارير الأرباح والمصروفات والبنود",
          descEn: "P&L statements and store analytics",
          href: "/financial-reports",
          icon: FileText,
        },
        {
          id: "fin-detailed",
          nameAr: "تفاصيل المبيعات اليومية",
          nameEn: "Detailed Sales",
          descAr: "تحليل حركة المبيعات وتدفق الإيرادات",
          descEn: "Audit individual daily sales transactions",
          href: "/financials/detailed-sales",
          icon: Activity,
        },
        {
          id: "fin-month",
          nameAr: "ملخص الشهر",
          nameEn: "Month Summary",
          descAr: "الملخص الشهري العام لأداء الفرع",
          descEn: "Monthly performance overview & totals",
          href: "/financial-reports/month-summary",
          icon: CalendarDays,
        },
        {
          id: "fin-oos",
          nameAr: "سجل النواقص (Out of Stock)",
          nameEn: "Out of Stock Log",
          descAr: "سجل الأصناف المنتهية والناقصة",
          descEn: "Depleted inventory tracking & alerts",
          href: "/financials/out-of-stock",
          icon: PackageMinus,
        },
        {
          id: "fin-voids",
          nameAr: "الفواتير الملغاة والفويد",
          nameEn: "Voids & Cancelled",
          descAr: "مراجعة العمليات المرتجعة والملغاة",
          descEn: "Audit voided tickets & cancel reasons",
          href: "/voids/manager",
          icon: Shield,
        },
        {
          id: "fin-shift",
          nameAr: "تدقيق واعتماد الشيفتات",
          nameEn: "Shift Audit",
          descAr: "مراجعة واعتماد إغلاقات الورديات",
          descEn: "Review & approve cashier shift audits",
          href: "/shift-reports/manager",
          icon: Shield,
        },
        {
          id: "fin-margin",
          nameAr: "استراتيجية هوامش الربح",
          nameEn: "Margin Strategy",
          descAr: "حساب وتحليل هوامش الربح للأصناف",
          descEn: "Product profit margin calculator",
          href: "/dashboard/margin-calculator",
          icon: TrendingUp,
        },
      ],
    },
    {
      id: "operations",
      nameAr: "التشغيل وإدارة الفرع",
      nameEn: "Store Operations",
      taglineAr: "قوائم الفحص والتشيك لست، سجلات النظافة، المستندات الرسمية، والعروض",
      taglineEn: "Daily operational checklists, hygiene logs, official receipts, and promotions",
      gradient: "from-amber-500 via-orange-500 to-yellow-500",
      accentText: "text-amber-400",
      accentBorder: "border-amber-500/30 hover:border-amber-500/60",
      accentBg: "bg-amber-500/10",
      icon: Briefcase,
      heroHref: "/checklists/manager",
      heroTextAr: "قوائم الفحص والتشيك لست (Checklists)",
      heroTextEn: "Open Store Checklists",
      items: [
        {
          id: "ops-docs",
          nameAr: "المستندات والإيصالات الرسمية",
          nameEn: "Official Documents",
          descAr: "إيصالات المصروفات والوثائق المعتمدة",
          descEn: "Official vouchers, slips & certificates",
          href: "/manager/documents",
          icon: FileText,
        },
        {
          id: "ops-checklists",
          nameAr: "قوائم الفحص والتشيك لست",
          nameEn: "Store Checklists",
          descAr: "متابعة معايير التشغيل اليومية بالفرع",
          descEn: "Daily store checklist & quality audits",
          href: "/checklists/manager",
          icon: ClipboardList,
          badge: "Daily",
          badgeAr: "يومي",
        },
        {
          id: "ops-cleaning",
          nameAr: "سجلات وجداول النظافة",
          nameEn: "Cleaning Logs",
          descAr: "متابعة جدول تعقيم ونظافة المرافق",
          descEn: "Facility hygiene & cleaning schedule",
          href: "/admin/cleaning",
          icon: Sparkles,
        },
        {
          id: "ops-lost",
          nameAr: "سجل المفقودات والأمانات",
          nameEn: "Lost & Found",
          descAr: "توثيق مفقودات العملاء واستلامها",
          descEn: "Customer lost items & delivery log",
          href: "/admin/lost-and-found",
          icon: Package,
        },
        {
          id: "ops-offers",
          nameAr: "إدارة العروض الترويجية",
          nameEn: "Manage Offers",
          descAr: "تفعيل ومتابعة عروض الفرع والخصومات",
          descEn: "Promotional campaigns & discounts",
          href: "/admin/offers",
          icon: Tag,
        },
        {
          id: "ops-food",
          nameAr: "أكواد الفود (Food Codes)",
          nameEn: "Food Prep Codes",
          descAr: "أكواد تحضير واستلام الأغذية والمشروبات",
          descEn: "Kitchen food preparation bar codes",
          href: "/admin/food-codes",
          icon: Barcode,
        },
      ],
    },
    {
      id: "products",
      nameAr: "المنتجات والمخزون",
      nameEn: "Products & Stock",
      taglineAr: "فحص الصلاحيات، الجرد الأعمى، طلبات الموردين وبحث الباركود",
      taglineEn: "Expiries audit, blind inventory stocktake, supplier orders, and barcode lookup",
      gradient: "from-purple-500 via-indigo-500 to-blue-500",
      accentText: "text-purple-400",
      accentBorder: "border-purple-500/30 hover:border-purple-500/60",
      accentBg: "bg-purple-500/10",
      icon: Package,
      heroHref: "/products/expiries-audit",
      heroTextAr: "مراجعة الصلاحيات (Expiries Audit)",
      heroTextEn: "Audit Expiries",
      items: [
        {
          id: "prod-expiries",
          nameAr: "فحص الصلاحيات (Expiries)",
          nameEn: "Expiries Audit",
          descAr: "جدول المنتجات المنتهية وقريبة الانتهاء",
          descEn: "Audit near-expiry and expired goods",
          href: "/products/expiries-audit",
          icon: ClipboardList,
          badge: "Priority",
          badgeAr: "أولوية",
        },
        {
          id: "prod-lookup",
          nameAr: "البحث عن صنف بالباركود",
          nameEn: "Product Lookup",
          descAr: "كشف الأسعار والتفاصيل بالباركود",
          descEn: "Search product prices & barcode data",
          href: "/admin/product-lookup",
          icon: Search,
        },
        {
          id: "prod-blind",
          nameAr: "الجرد الأعمى للمخزون",
          nameEn: "Blind Inventory Audit",
          descAr: "جرد الأصناف الفعلي ومطابقة الفروقات",
          descEn: "Store stock counts & discrepancy check",
          href: "/inventory-audit/manager",
          icon: Shield,
        },
        {
          id: "prod-orders",
          nameAr: "طلب بضاعة من المورد",
          nameEn: "Supplier Orders",
          descAr: "إنشاء ومتابعة طلبيات الموردين",
          descEn: "Create & track vendor stock orders",
          href: "/products/supplier-orders",
          icon: ShoppingCart,
        },
        {
          id: "prod-returns",
          nameAr: "مرتجعات الموردين",
          nameEn: "Supplier Returns",
          descAr: "تسجيل المرتجعات واسترداد الأرصدة",
          descEn: "Log returned inventory to suppliers",
          href: "/dashboard/supplier-returns",
          icon: Truck,
        },
      ],
    },
    {
      id: "hr",
      nameAr: "الموارد البشرية وفريق العمل",
      nameEn: "Human Resources (HR)",
      taglineAr: "قاعدة بيانات الموظفين، طباعة العقود وإخلاء الطرف، مسير المرتبات، والجدول الذكي",
      taglineEn: "Staff directory, employment contracts, clearance release forms, payroll, and schedules",
      gradient: "from-sky-500 via-blue-500 to-indigo-500",
      accentText: "text-sky-400",
      accentBorder: "border-sky-500/30 hover:border-sky-500/60",
      accentBg: "bg-sky-500/10",
      icon: Users,
      requiresAdmin: true,
      heroHref: "/hr/employees",
      heroTextAr: "سجل الموظفين والعقود (Employee Directory)",
      heroTextEn: "Open Staff Directory",
      items: [
        {
          id: "hr-employees",
          nameAr: "سجل الموظفين والعقود",
          nameEn: "Employee Directory & Contracts",
          descAr: "ملفات العاملين، طباعة العقود، ونماذج إخلاء الطرف",
          descEn: "Staff roster, print contracts & clearances",
          href: "/hr/employees",
          icon: Users,
          badge: "Admin",
          badgeAr: "إدارة",
        },
        {
          id: "hr-cashiers",
          nameAr: "حسابات وبن كود الكاشير",
          nameEn: "Cashier Accounts & PINs",
          descAr: "إدارة حسابات مستخدمي نقاط البيع ورمز الدخول",
          descEn: "Manage cashier terminal logins & PINs",
          href: "/settings/cashiers",
          icon: UserCheck,
        },
        {
          id: "hr-payroll",
          nameAr: "مسير المرتبات والمستحقات",
          nameEn: "Payroll System",
          descAr: "احتساب الرواتب الشهرية والبدلات",
          descEn: "Monthly salaries & wages processing",
          href: "/admin/payroll",
          icon: DollarSign,
        },
        {
          id: "hr-adjustments",
          nameAr: "السلف والخصومات والبدلات",
          nameEn: "Adjustments & Loans",
          descAr: "توثيق السلفيات والجزاءات والمكافآت",
          descEn: "Employee advances, deductions & bonuses",
          href: "/admin/adjustments",
          icon: FileText,
        },
        {
          id: "hr-schedule",
          nameAr: "الجدول الذكي وتوزيع الورديات",
          nameEn: "Smart Scheduler",
          descAr: "توزيع شيفتات العمل الأسبوعية للموظفين",
          descEn: "Weekly staff shifts & roster planner",
          href: "/admin/schedule",
          icon: CalendarDays,
        },
      ],
    },
    {
      id: "admin",
      nameAr: "الإدارة والتحكم بالنظام",
      nameEn: "Administration & System",
      taglineAr: "إدارة المستخدمين، الأجهزة المتصلة، إرسال المستندات، استيراد البيانات وسجلات الأمان",
      taglineEn: "User access, connected devices, document dispatch, security logs, and data imports",
      gradient: "from-rose-500 via-red-500 to-amber-500",
      accentText: "text-rose-400",
      accentBorder: "border-rose-500/30 hover:border-rose-500/60",
      accentBg: "bg-rose-500/10",
      icon: Shield,
      requiresAdmin: true,
      heroHref: "/admin/users",
      heroTextAr: "إدارة المستخدمين والصلاحيات (User Access)",
      heroTextEn: "Manage User Access",
      items: [
        {
          id: "adm-dispatch",
          nameAr: "إرسال مستند رسمي للمدير",
          nameEn: "Dispatch Document to Manager",
          descAr: "إرسال أوراق وتنبيهات مباشرة لمدير الفرع",
          descEn: "Send official notices to store managers",
          href: "/admin/send-document",
          icon: SendHorizontal,
        },
        {
          id: "adm-users",
          nameAr: "إدارة المستخدمين والصلاحيات",
          nameEn: "User Permissions",
          descAr: "تحديد أدوار الموظفين وصلاحيات الوصول",
          descEn: "Manage user roles and security tiers",
          href: "/admin/users",
          icon: Shield,
          badge: "Full Access",
          badgeAr: "صلاحية عليا",
        },
        {
          id: "adm-predict",
          nameAr: "التنبؤ الذكي بالمخزون (AI)",
          nameEn: "Inventory Predict (AI)",
          descAr: "تحليلات الذكاء الاصطناعي لتوقع الاحتياجات",
          descEn: "AI predictive inventory analytics",
          href: "/admin/inventory-predict",
          icon: Database,
        },
        {
          id: "adm-notifs",
          nameAr: "إرسال إشعارات فورية",
          nameEn: "Send Broadcast Alerts",
          descAr: "إرسال إشعارات عامة لكافة الأجهزة والفرع",
          descEn: "Broadcast push alerts across terminals",
          href: "/settings/notifications",
          icon: Bell,
        },
        {
          id: "adm-audit",
          nameAr: "سجل الأمان والعمليات",
          nameEn: "Security Audit Log",
          descAr: "مراقبة كافة تحركات وسجلات الدخول الحساسة",
          descEn: "Audit trail for all sensitive operations",
          href: "/settings/audit-log",
          icon: Shield,
        },
        {
          id: "adm-devices",
          nameAr: "الأجهزة والجلسات المتصلة",
          nameEn: "Connected Terminals",
          descAr: "مراقبة شاشات الكاشير والأجهزة المفتوحة",
          descEn: "Live cashier sessions & active devices",
          href: "/admin/devices",
          icon: Monitor,
        },
        {
          id: "adm-import",
          nameAr: "استيراد البيانات (CSV Import)",
          nameEn: "Import CSV Data",
          descAr: "استيراد كشوفات المخزون والمنتجات مجمعة",
          descEn: "Batch import inventory & price sheets",
          href: "/admin/import-csv",
          icon: Database,
        },
      ],
    },
  ], []);

  // Filter departments: If user is admin/owner, ALWAYS show all 5! If strictly manager, hide HR & Admin.
  const visibleDepartments = useMemo(() => {
    return allDepartments.filter((dept) => {
      if (dept.requiresAdmin && !isAdmin) {
        return false;
      }
      return true;
    });
  }, [allDepartments, isAdmin]);

  // Search filtering
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return visibleDepartments;
    const q = searchQuery.toLowerCase().trim();

    return visibleDepartments.map((dept) => {
      const matchesDept = 
        dept.nameAr.toLowerCase().includes(q) ||
        dept.nameEn.toLowerCase().includes(q) ||
        dept.taglineAr.toLowerCase().includes(q) ||
        dept.taglineEn.toLowerCase().includes(q);

      const matchingItems = dept.items.filter(
        (item) =>
          item.nameAr.toLowerCase().includes(q) ||
          item.nameEn.toLowerCase().includes(q) ||
          item.descAr.toLowerCase().includes(q) ||
          item.descEn.toLowerCase().includes(q)
      );

      if (matchesDept) return dept;
      if (matchingItems.length > 0) {
        return {
          ...dept,
          items: matchingItems,
        };
      }
      return null;
    }).filter(Boolean) as Department[];
  }, [visibleDepartments, searchQuery]);

  const totalToolsCount = useMemo(() => {
    return visibleDepartments.reduce((acc, d) => acc + d.items.length, 0);
  }, [visibleDepartments]);

  return (
    <div 
      className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-10 bg-[#070709] text-white selection:bg-rose-500 selection:text-white relative overflow-hidden"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* VIP Keynote Glow Effects (Deep Obsidian & Neon Gradient Orbs) */}
      <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-gradient-to-br from-rose-600/15 via-red-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-purple-600/15 via-indigo-600/10 to-transparent rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-600/15 via-teal-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8 sm:space-y-10">
        
        {/* TOP VIP HERO BANNER */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[32px] p-6 sm:p-8 bg-[#111115]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative overflow-hidden"
        >
          {/* Subtle top edge specular highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Branding & Role Badge */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-red-500 via-rose-600 to-amber-500 p-0.5 shadow-xl shadow-red-500/20 flex-shrink-0">
                <div className="w-full h-full rounded-[22px] bg-[#0c0c0e] flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    K
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center flex-wrap gap-2.5 mb-1.5">
                  <span className="text-[11px] font-black tracking-[0.2em] uppercase text-rose-400">
                    Circle K Portal
                  </span>

                  {/* Branch Pill */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {branchDisplayName}
                  </span>

                  {/* High-Visibility Admin Badge */}
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/10">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      {isAr ? "صلاحيات المالك والإدارة (Admin / Owner)" : "Admin & Owner Access"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Lock className="w-3 h-3 text-amber-400" />
                      {isAr ? "مدير فرع (Store Manager)" : "Store Manager Mode"}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                  {isAr ? "مركز قيادة وتشغيل الفروع" : "Executive Operations Hub"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                  {isAr 
                    ? `مرحباً بك ${userName ? `، ${userName}` : ""} — كافة العمليات والتقارير والتحكم في مكان واحد (${totalToolsCount} صفحة وأداة)`
                    : `Welcome ${userName ? `, ${userName}` : ""} — All modules, controls, and reports unified (${totalToolsCount} tools available)`}
                </p>
              </div>
            </div>

            {/* Right: Live time, AI Copilot & Language */}
            <div className="flex items-center flex-wrap gap-3">
              {time && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#18181f] border border-white/10 text-xs font-bold shadow-inner">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">
                    {time.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="w-px h-3 bg-white/15 mx-0.5" />
                  <Clock className="w-4 h-4 text-rose-500" />
                  <span className="font-mono font-black text-white">
                    {time.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {/* Ibrahim AI Copilot */}
              <Link
                href="/ai-assistant"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600/30 via-violet-600/25 to-indigo-600/30 border border-purple-500/40 text-purple-200 font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-purple-900/20 group"
              >
                <Bot className="w-4 h-4 text-purple-400 group-hover:rotate-12 transition-transform" />
                <span>{isAr ? "مساعد إبراهيم AI" : "Ibrahim AI"}</span>
              </Link>

              {/* Language Switch */}
              <button
                onClick={() => setLanguage(isAr ? "en" : "ar")}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#18181f] hover:bg-[#20202a] border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <span className="font-mono font-black">{isAr ? "EN" : "عربي"}</span>
              </button>
            </div>
          </div>

          {/* Quick search input */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isAr ? "right-4" : "left-4"}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr 
                    ? "ابحث بالاسم عن أي صفحة، تقرير، تشيك لست، صلاحيات، أو عهدة..." 
                    : "Type to quickly find any page, report, checklist, staff file, or tool..."
                }
                className={`w-full py-3 rounded-2xl bg-[#0c0c0e] border border-white/10 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-slate-500 outline-none text-white transition-all ${
                  isAr ? "pr-11 pl-4" : "pl-11 pr-4"
                }`}
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-3 rounded-2xl bg-[#18181f] text-xs font-bold text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
              >
                {isAr ? "مسح" : "Clear"}
              </button>
            )}
          </div>
        </motion.div>

        {/* VIP BENTO SECTIONS (EACH DEPARTMENT IS A HERO BENTO BOX) */}
        <div className="space-y-8 sm:space-y-10">
          <AnimatePresence>
            {filteredDepartments.map((dept, deptIndex) => {
              const DeptIcon = dept.icon;

              return (
                <motion.section 
                  key={dept.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: deptIndex * 0.06 }}
                  className="rounded-[32px] p-6 sm:p-8 bg-[#111115]/90 border border-white/10 shadow-2xl relative overflow-hidden group/section"
                >
                  {/* Subtle top edge highlight */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                  {/* Corner ambient glow matching department accent */}
                  <div className={`absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br ${dept.gradient} opacity-10 rounded-full blur-3xl pointer-events-none group-hover/section:opacity-20 transition-opacity duration-500`} />

                  {/* Department Banner & Main Action */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dept.gradient} p-0.5 shadow-lg flex-shrink-0`}>
                        <div className="w-full h-full rounded-[14px] bg-[#0c0c0e] flex items-center justify-center">
                          <DeptIcon className={`w-7 h-7 ${dept.accentText}`} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            {isAr ? dept.nameAr : dept.nameEn}
                          </h2>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${dept.accentBorder} ${dept.accentBg} ${dept.accentText}`}>
                            {dept.items.length} {isAr ? "صفحات" : "Pages"}
                          </span>
                          {dept.requiresAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Crown className="w-3 h-3 text-amber-400" />
                              {isAr ? "إدارة فقط" : "Admin Only"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                          {isAr ? dept.taglineAr : dept.taglineEn}
                        </p>
                      </div>
                    </div>

                    {/* Primary Department Shortcut Button */}
                    <Link
                      href={dept.heroHref}
                      prefetch={true}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r ${dept.gradient} text-white font-black text-xs sm:text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all group/btn flex-shrink-0`}
                    >
                      <span>{isAr ? dept.heroTextAr : dept.heroTextEn}</span>
                      {isAr ? (
                        <ArrowLeft className="w-4 h-4 group-hover/btn:-translate-x-1 transition-transform" />
                      ) : (
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      )}
                    </Link>
                  </div>

                  {/* Grid of All Department Pages (Tactile App Tiles) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    {dept.items.map((item) => {
                      const ItemIcon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          prefetch={true}
                          className="group/tile relative p-4 rounded-2xl bg-[#16161c] hover:bg-[#1a1a24] border border-white/5 hover:border-white/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] flex flex-col justify-between overflow-hidden shadow-md cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-[#0e0e12] border border-white/10 flex items-center justify-center text-slate-300 group-hover/tile:text-white group-hover/tile:scale-110 transition-all">
                                <ItemIcon className="w-5 h-5" />
                              </div>

                              {item.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                                  {isAr ? item.badgeAr || item.badge : item.badge}
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-white group-hover/tile:text-rose-400 transition-colors line-clamp-1 mb-1">
                              {isAr ? item.nameAr : item.nameEn}
                            </h3>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-medium">
                              {isAr ? item.descAr : item.descEn}
                            </p>
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover/tile:text-white transition-colors">
                            <span>{isAr ? "دخول الصفحة" : "Launch"}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover/tile:opacity-100 group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5 transition-transform" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>

        {/* BOTTOM QUICK FOOTER */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-300">{isAr ? "النظام متصل ومتزامن لحظياً" : "Live Cloud Sync Active"}</span>
            </span>
            <span>•</span>
            <span>Circle K Franchise Operations Portal</span>
          </div>

          <div className="flex items-center gap-4 font-semibold">
            <Link href="/cashier" prefetch={true} className="hover:text-white transition-colors">
              {isAr ? "بوابة الكاشير" : "Cashier Portal"}
            </Link>
            <span>•</span>
            <Link href="/manager/documents" prefetch={true} className="hover:text-white transition-colors">
              {isAr ? "المستندات" : "Documents"}
            </Link>
            <span>•</span>
            <Link href="/ai-assistant" prefetch={true} className="hover:text-purple-400 transition-colors flex items-center gap-1">
              <Bot className="w-3 h-3 text-purple-400" />
              {isAr ? "إبراهيم AI" : "Ibrahim AI"}
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
