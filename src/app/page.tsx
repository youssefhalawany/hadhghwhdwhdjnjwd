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
  CheckCircle2, 
  Briefcase,
  SendHorizontal,
  Lock,
  Layers,
  Sparkle,
  X,
  UserCheck
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
  descAr: string;
  descEn: string;
  color: string; // emerald, amber, purple, sky, rose
  borderColor: string;
  badgeColor: string;
  accentBg: string;
  icon: any;
  requiresAdmin?: boolean;
  items: ToolItem[];
}

export default function StartPage() {
  const { currentBranch } = useBranch();
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";
  
  const [time, setTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [userRole, setUserRole] = useState<string>("manager");
  const [userName, setUserName] = useState<string>("");

  // Live time ticker
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync role & security
  useEffect(() => {
    const savedRole = localStorage.getItem("circlek_role");
    const savedName = localStorage.getItem("circlek_user_name");
    if (savedRole) setUserRole(savedRole);
    if (savedName) setUserName(savedName);

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data();
            const r = data.role || data.features?.role || "manager";
            setUserRole(r);
            localStorage.setItem("circlek_role", r);
            const n = data.displayName || data.name || u.displayName || "Manager";
            setUserName(n);
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

  const isAdminOrOwner = userRole === "owner" || userRole === "admin";

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

  // Comprehensive Catalog of all pages from navbar grouped cleanly by department
  const departments: Department[] = useMemo(() => [
    {
      id: "financials",
      nameAr: "الماليات والخزينة",
      nameEn: "Financials & Safe",
      descAr: "الخزائن اليومية، تقفيل الشيفتات، كشوفات المبيعات، ومراجعة هوامش الربح",
      descEn: "Daily safe deposits, shift registers, sales statements, and margin optimization",
      color: "emerald",
      borderColor: "border-emerald-500/25 dark:border-emerald-500/20 hover:border-emerald-500/50",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      accentBg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      icon: Wallet,
      items: [
        {
          id: "fin-inputs",
          nameAr: "مدخلات الخزينة اليومية",
          nameEn: "Daily Safe Inputs",
          descAr: "تسجيل عهد ونقدية الخزينة اليومية",
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
          descEn: "P&L statements and financial reports",
          href: "/financial-reports",
          icon: FileText,
        },
        {
          id: "fin-detailed",
          nameAr: "تفاصيل المبيعات اليومية",
          nameEn: "Detailed Sales",
          descAr: "تحليل حركة المبيعات وتدفق الإيرادات",
          descEn: "In-depth sales transactions audit",
          href: "/financials/detailed-sales",
          icon: Activity,
        },
        {
          id: "fin-month",
          nameAr: "ملخص الشهر",
          nameEn: "Month Summary",
          descAr: "الملخص الشهري العام للأداء",
          descEn: "Monthly performance overview",
          href: "/financial-reports/month-summary",
          icon: CalendarDays,
        },
        {
          id: "fin-oos",
          nameAr: "سجل النواقص",
          nameEn: "Out of Stock",
          descAr: "سجل الأصناف المنتهية والناقصة",
          descEn: "Depleted inventory tracking",
          href: "/financials/out-of-stock",
          icon: PackageMinus,
        },
        {
          id: "fin-voids",
          nameAr: "الفواتير الملغاة والفويد",
          nameEn: "Voids & Cancelled",
          descAr: "مراجعة العمليات المرتجعة والملغاة",
          descEn: "Audit voided and cancelled tickets",
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
      id: "products",
      nameAr: "المنتجات والمخزون",
      nameEn: "Products & Stock",
      descAr: "متابعة تواريخ الصلاحية، الجرد الأعمى، طلبات الموردين وبحث الباركود",
      descEn: "Expiries audit, blind inventory stocktake, supplier orders, and barcode lookup",
      color: "purple",
      borderColor: "border-purple-500/25 dark:border-purple-500/20 hover:border-purple-500/50",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
      accentBg: "from-purple-500/10 via-purple-500/5 to-transparent",
      icon: Package,
      items: [
        {
          id: "prod-expiries",
          nameAr: "فحص الصلاحيات (Expiries)",
          nameEn: "Expiries Audit",
          descAr: "جدول المنتجات المنتهية وقريبة الانتهاء",
          descEn: "Audit near-expiry and expired goods",
          href: "/products/expiries-audit",
          icon: ClipboardList,
          badge: "Daily",
          badgeAr: "يومي",
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
      id: "operations",
      nameAr: "التشغيل وإدارة الفرع",
      nameEn: "Store Operations",
      descAr: "قوائم الفحص والتشيك لست، سجلات النظافة، المستندات الرسمية، والعروض",
      descEn: "Daily operational checklists, hygiene logs, official receipts, and promotions",
      color: "amber",
      borderColor: "border-amber-500/25 dark:border-amber-500/20 hover:border-amber-500/50",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      accentBg: "from-amber-500/10 via-amber-500/5 to-transparent",
      icon: Briefcase,
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
          badge: "Active",
          badgeAr: "مستمر",
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
      id: "hr",
      nameAr: "الموارد البشرية وفريق العمل",
      nameEn: "Human Resources (HR)",
      descAr: "قاعدة بيانات الموظفين، طباعة العقود وإخلاء الطرف، مسير المرتبات، والجدول الذكي",
      descEn: "Staff directory, employment contracts, clearance release forms, payroll, and schedules",
      color: "sky",
      borderColor: "border-sky-500/25 dark:border-sky-500/20 hover:border-sky-500/50",
      badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
      accentBg: "from-sky-500/10 via-sky-500/5 to-transparent",
      icon: Users,
      requiresAdmin: true,
      items: [
        {
          id: "hr-employees",
          nameAr: "سجل الموظفين والعقود",
          nameEn: "Employee Directory & Contracts",
          descAr: "ملفات العاملين، طباعة العقود، ونماذج إخلاء الطرف",
          descEn: "Staff roster, print contracts & clearances",
          href: "/hr/employees",
          icon: Users,
          badge: "Security",
          badgeAr: "مؤمّن",
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
      descAr: "إدارة المستخدمين، الأجهزة المتصلة، إرسال المستندات، استيراد البيانات وسجلات الأمان",
      descEn: "User access, connected devices, document dispatch, security logs, and data imports",
      color: "rose",
      borderColor: "border-rose-500/25 dark:border-rose-500/20 hover:border-rose-500/50",
      badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
      accentBg: "from-rose-500/10 via-rose-500/5 to-transparent",
      icon: Shield,
      requiresAdmin: true,
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
          badge: "Admin",
          badgeAr: "إدارة",
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

  // Filtered by role security first!
  const visibleDepartments = useMemo(() => {
    return departments.filter((dept) => {
      if (dept.requiresAdmin && !isAdminOrOwner) {
        return false;
      }
      return true;
    });
  }, [departments, isAdminOrOwner]);

  // Filtered by tab and search query
  const filteredDepartments = useMemo(() => {
    let list = visibleDepartments;

    if (activeTab !== "all") {
      list = list.filter((d) => d.id === activeTab);
    }

    if (!searchQuery.trim()) {
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return list
      .map((dept) => {
        const matchesDept =
          dept.nameAr.toLowerCase().includes(q) ||
          dept.nameEn.toLowerCase().includes(q) ||
          dept.descAr.toLowerCase().includes(q) ||
          dept.descEn.toLowerCase().includes(q);

        const matchingItems = dept.items.filter(
          (item) =>
            item.nameAr.toLowerCase().includes(q) ||
            item.nameEn.toLowerCase().includes(q) ||
            item.descAr.toLowerCase().includes(q) ||
            item.descEn.toLowerCase().includes(q)
        );

        if (matchesDept) {
          return dept;
        }

        if (matchingItems.length > 0) {
          return {
            ...dept,
            items: matchingItems,
          };
        }

        return null;
      })
      .filter(Boolean) as Department[];
  }, [visibleDepartments, activeTab, searchQuery]);

  const totalPagesCount = useMemo(() => {
    return visibleDepartments.reduce((acc, d) => acc + d.items.length, 0);
  }, [visibleDepartments]);

  return (
    <div 
      className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden bg-background text-foreground"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Ambient background glow orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-600/10 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-emerald-600/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-sky-600/10 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* EXECUTIVE HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-card/85 dark:bg-card/45 backdrop-blur-2xl border border-border/80 shadow-xl shadow-black/5">
            {/* Left: Brand, Greeting & Role Security Badge */}
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg shadow-rose-500/30 border border-rose-400/30 flex-shrink-0">
                K
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className="text-xs font-black tracking-widest uppercase text-rose-500">
                    Circle K Portal
                  </span>
                  
                  {/* Branch Pill */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {branchDisplayName}
                  </span>

                  {/* Role Security Badge */}
                  {isAdminOrOwner ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                      <Sparkle className="w-3 h-3 text-purple-400" />
                      {isAr ? "صلاحيات إدارة كاملة (Admin)" : "Full Admin Access"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Lock className="w-3 h-3 text-amber-500" />
                      {isAr ? "مدير فرع (Store Manager)" : "Store Manager Mode"}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                  <span>{isAr ? "مركز العمليات والإدارة الشامل" : "Enterprise Command Center"}</span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                  {isAr 
                    ? `مرحباً بك ${userName ? `، ${userName}` : ""} — كافة أقسام وأدوات الفرع في منصة واحدة موحدة (${totalPagesCount} أداة وصفحة متاحة)`
                    : `Welcome back ${userName ? `, ${userName}` : ""} — All store tools & pages categorized in one unified launchpad (${totalPagesCount} total pages)`}
                </p>
              </div>
            </div>

            {/* Right: Real-time clock & Assistant */}
            <div className="flex items-center flex-wrap gap-2.5 lg:justify-end">
              {time && (
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-muted/70 border border-border text-xs font-bold">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {time.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="w-px h-3 bg-border mx-0.5" />
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-mono font-black text-foreground">
                    {time.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {/* AI Assistant shortcut */}
              <Link
                href="/ai-assistant"
                prefetch={true}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-600/15 via-purple-600/15 to-indigo-600/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold text-xs hover:bg-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group"
              >
                <Bot className="w-4 h-4 text-purple-500 group-hover:rotate-12 transition-transform" />
                <span>{isAr ? "مساعد إبراهيم AI" : "Ibrahim AI"}</span>
              </Link>

              {/* Language Switcher */}
              <button
                onClick={() => setLanguage(isAr ? "en" : "ar")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-muted/60 hover:bg-muted border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title={isAr ? "Switch to English" : "التحويل للعربية"}
              >
                <span className="font-mono font-bold">{isAr ? "EN" : "عربي"}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* SEARCH AND FILTER BAR */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-8">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isAr ? "right-3.5" : "left-3.5"}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? "ابحث عن أي صفحة، تقرير، تشيك لست، أو أداة..."
                  : "Search any tool, report, checklist, or page..."
              }
              className={`w-full py-2.5 rounded-2xl bg-card/80 border border-border/80 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 text-xs font-semibold placeholder:text-muted-foreground/70 outline-none transition-all ${
                isAr ? "pr-10 pl-9" : "pl-10 pr-9"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground ${
                  isAr ? "left-2.5" : "right-2.5"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Tabs */}
          <div className="flex items-center overflow-x-auto pb-1 md:pb-0 gap-1.5 no-scrollbar">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "all"
                  ? "bg-foreground text-background shadow-md"
                  : "bg-card/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              {isAr ? "جميع الأقسام" : "All Departments"} ({totalPagesCount})
            </button>

            {visibleDepartments.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveTab(d.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === d.id
                    ? "bg-foreground text-background shadow-md"
                    : "bg-card/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                <d.icon className="w-3.5 h-3.5 opacity-80" />
                <span>{isAr ? d.nameAr : d.nameEn}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-muted/60 opacity-80">
                  {d.items.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* DEPARTMENTS CONTAINER */}
        <div className="space-y-8 sm:space-y-10">
          <AnimatePresence>
            {filteredDepartments.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-16 text-center rounded-3xl bg-card/40 border border-dashed border-border"
              >
                <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-bold text-muted-foreground">
                  {isAr ? "لم يتم العثور على صفحات تطابق بحثك" : "No pages found matching your search"}
                </p>
                <button
                  onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
                  className="mt-3 px-4 py-1.5 rounded-xl bg-muted text-xs font-bold text-foreground hover:bg-muted/80 cursor-pointer"
                >
                  {isAr ? "إلغاء التصفية" : "Reset Filter"}
                </button>
              </motion.div>
            ) : (
              filteredDepartments.map((dept, deptIdx) => {
                const DeptIcon = dept.icon;

                return (
                  <motion.section 
                    key={dept.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: deptIdx * 0.05 }}
                    className="relative"
                  >
                    {/* Department Header Strip */}
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner ${
                          dept.color === "emerald"
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : dept.color === "purple"
                            ? "bg-purple-500/15 text-purple-500 border-purple-500/30"
                            : dept.color === "amber"
                            ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                            : dept.color === "sky"
                            ? "bg-sky-500/15 text-sky-500 border-sky-500/30"
                            : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                        }`}>
                          <DeptIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-black text-foreground">
                              {isAr ? dept.nameAr : dept.nameEn}
                            </h2>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black border ${dept.badgeColor}`}>
                              {dept.items.length} {isAr ? "صفحات" : "Tools"}
                            </span>
                            {dept.requiresAdmin && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Lock className="w-2.5 h-2.5" />
                                {isAr ? "للإدارة فقط" : "Admin Only"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-medium hidden sm:block">
                            {isAr ? dept.descAr : dept.descEn}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Department Grid of App Tiles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                      {dept.items.map((item) => {
                        const ItemIcon = item.icon;

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            prefetch={true}
                            className={`group relative p-4 rounded-2xl bg-card/75 dark:bg-card/40 backdrop-blur-xl border border-border/80 ${dept.borderColor} transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] hover:shadow-lg flex flex-col justify-between overflow-hidden cursor-pointer`}
                          >
                            {/* Card Accent Glow */}
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${dept.accentBg} rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity`} />

                            <div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                  dept.color === "emerald"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white"
                                    : dept.color === "purple"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white"
                                    : dept.color === "amber"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white"
                                    : dept.color === "sky"
                                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white"
                                }`}>
                                  <ItemIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </div>

                                {item.badge && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${dept.badgeColor}`}>
                                    {isAr ? item.badgeAr || item.badge : item.badge}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-bold text-foreground group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors line-clamp-1 mb-1">
                                {isAr ? item.nameAr : item.nameEn}
                              </h3>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {isAr ? item.descAr : item.descEn}
                              </p>
                            </div>

                            <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                              <span>{isAr ? "فتح الصفحة" : "Open Page"}</span>
                              {isAr ? (
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                              ) : (
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.section>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FOOTER STRIP */}
      <div className="mt-12 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground relative z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
            <span className="text-foreground">{isAr ? "النظام متصل ومتزامن لحظياً" : "Live Firebase Cloud Sync"}</span>
          </span>
          <span className="text-border">•</span>
          <span>Circle K Franchise Management</span>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/cashier" 
            prefetch={true}
            className="hover:text-foreground font-semibold transition-colors"
          >
            {isAr ? "بوابة الكاشير" : "Cashier Portal"}
          </Link>
          <span className="text-border">•</span>
          <Link 
            href="/manager/documents" 
            prefetch={true}
            className="hover:text-foreground font-semibold transition-colors"
          >
            {isAr ? "المستندات الرسمية" : "Official Documents"}
          </Link>
          <span className="text-border">•</span>
          <Link 
            href="/ai-assistant" 
            prefetch={true}
            className="hover:text-purple-400 font-semibold transition-colors flex items-center gap-1"
          >
            <Bot className="w-3.5 h-3.5" />
            {isAr ? "مساعد إبراهيم" : "Ibrahim AI"}
          </Link>
        </div>
      </div>
    </div>
  );
}
