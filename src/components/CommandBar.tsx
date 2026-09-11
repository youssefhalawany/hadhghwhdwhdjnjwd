"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Package, 
  TrendingUp, 
  Activity, 
  X, 
  Receipt, 
  CreditCard, 
  Calendar, 
  Users, 
  Shield, 
  FileText, 
  Wallet, 
  CheckCircle2, 
  Briefcase, 
  Sparkles, 
  Clock, 
  ChevronRight, 
  CornerDownLeft, 
  SlidersHorizontal,
  Layers,
  ArrowRight,
  Bot,
  Truck,
  Zap,
  Wrench
} from "lucide-react";
import { db, productsDb } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { useDebounce } from "use-debounce";

interface SearchResultItem {
  id: string;
  type: "payment" | "product" | "page" | "employee";
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  tags?: { label: string; color: string }[];
  amount?: string;
  date?: string;
  poNumber?: string;
  invoiceNumber?: string;
  categoryLabel?: string;
}

const PORTAL_PAGES = [
  // Financials & Vault
  { name: "Payments Control", nameAr: "إدارة ومراقبة المدفوعات", desc: "Corporate outgoings, vendor invoices, disbursements, and POs", href: "/financials/inputs/payments", category: "Financials", keywords: "payment payments invoice invoices po voucher outgoings ulker vendor supplier مصروفات مدفوعات فواتير سند صرف", icon: Receipt, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { name: "Safe Inputs & Cash Vault", nameAr: "تسجيل مدخلات الخزينة", desc: "Daily safe drop reconciliation, cashier float balance", href: "/financials/inputs", category: "Financials", keywords: "safe vault cash float drop reconciliation خزينة عهدة توريد درج", icon: Wallet, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  { name: "Detailed Sales Telemetry", nameAr: "تفاصيل المبيعات اليومية", desc: "Daily sales shift reports, cash and visa reconciliation", href: "/financials/detailed-sales", category: "Financials", keywords: "sales detailed revenue register shifts telemetry مبيعات تقفيل وردية كاش فيزا", icon: Activity, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  { name: "Financial Reports & P&L", nameAr: "التقارير المالية والأرباح", desc: "Comprehensive P&L, expense breakdown, and executive reports", href: "/financial-reports", category: "Financials", keywords: "reports pnl expenses financial summary تقارير مالية أرباح خسائر مصروفات", icon: FileText, color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30" },
  { name: "Month Summary", nameAr: "ملخص مبيعات الشهر", desc: "Month-to-date target vs actual sales breakdown", href: "/financial-reports/month-summary", category: "Financials", keywords: "month summary target monthly mtd شهر ملخص مبيعات تارجت", icon: Calendar, color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  { name: "Zero-Stock & Out of Stock", nameAr: "سجل النواقص المفقودة", desc: "Zero-stock inventory tracker & alert system", href: "/financials/out-of-stock", category: "Financials", keywords: "out of stock oos zero inventory نواقص رفوف مفقود نفاد", icon: Package, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  { name: "Voids & Return Approvals", nameAr: "الفواتير الملغاة والمرتجعات", desc: "Cashier void requests & refund approvals", href: "/voids/manager", category: "Financials", keywords: "void voids return refund approval إلغاء مرتجع فواتير ملغاة اعتماد", icon: Shield, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { name: "Shift Audit & Review", nameAr: "تدقيق واعتماد الشيفتات", desc: "Cashier shift reconciliation & cash variance", href: "/shift-reports/manager", category: "Financials", keywords: "shift audit review cashier variance ورديات تدقيق شيفت عجز زيادة", icon: CheckCircle2, color: "text-teal-400 bg-teal-500/15 border-teal-500/30" },
  { name: "Margin Strategy Calculator", nameAr: "حاسبة هوامش الربح", desc: "Gross margin optimization & retail pricing", href: "/dashboard/margin-calculator", category: "Financials", keywords: "margin calculator pricing profit هامش ربح تسعير حاسبة", icon: TrendingUp, color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" },
  { name: "Bank Cheques Log", nameAr: "سجل الشيكات البنكية", desc: "Corporate cheques, maturity dates, and status", href: "/financials/inputs/cheques", category: "Financials", keywords: "cheque cheques bank شيكات بنك صرف استحقاق", icon: CreditCard, color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
  { name: "Customer & Vendor Credits", nameAr: "سجل الآجل والمديونيات", desc: "Credit accounts, receivables, and customer balances", href: "/financials/inputs/credits", category: "Financials", keywords: "credit credits debt accounts آجل مديونية عملاء موردين", icon: CreditCard, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  
  // Products & Inventory
  { name: "Barcode & Product Lookup", nameAr: "البحث الفوري بالباركود", desc: "Instant price check & category verification", href: "/admin/product-lookup", category: "Products", keywords: "barcode product lookup price check باركود صنف سعر استعلام بحث", icon: Search, color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
  { name: "Expiries Audit Tracker", nameAr: "فحص وتدقيق الصلاحيات", desc: "Near-expiry tracking, write-offs & rotation", href: "/products/expiries-audit", category: "Products", keywords: "expiry expiries audit near date صلاحية تواريخ منتهي قريب السحب", icon: Clock, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  { name: "Blind Inventory Audit", nameAr: "الجرد الأعمى للمخزون", desc: "Blind stock counting to prevent shrinkage", href: "/inventory-audit/manager", category: "Products", keywords: "inventory audit blind stock count جرد أعمى مخزون عجز بضاعة", icon: Package, color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  { name: "Supplier Purchase Orders (PO)", nameAr: "طلبيات بضاعة الموردين", desc: "Direct purchase order dispatch to vendors", href: "/products/supplier-orders", category: "Products", keywords: "po purchase order supplier orders طلبيات أوامر شراء توريد موردين", icon: Truck, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
  { name: "Supplier Returns (RTV)", nameAr: "مرتجعات بضاعة الموردين", desc: "Damaged/expired goods return to vendor tracking", href: "/dashboard/supplier-returns", category: "Products", keywords: "rtv return vendor supplier damaged مرتجع مورد بضاعة تالفة", icon: Truck, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  
  // Operations
  { name: "Store Checklists", nameAr: "التشيك لست اليومية للفرع", desc: "Opening, midday and handover operational checklists", href: "/checklists/manager", category: "Operations", keywords: "checklist checklists opening audit تشيك لست مهام يومية نظافة استلام", icon: Briefcase, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  { name: "Official Documents & Circulars", nameAr: "المستندات الرسمية والتعاميم", desc: "Store licenses, official circulars & notices", href: "/manager/documents", category: "Operations", keywords: "documents licenses circulars official أوراق مستندات تعاميم تراخيص", icon: FileText, color: "text-slate-300 bg-white/[0.05] border-white/10" },
  { name: "Cleaning Schedules", nameAr: "سجلات وجدول النظافة", desc: "Coffee machine, food contact & premise sanitation", href: "/admin/cleaning", category: "Operations", keywords: "cleaning sanitation hygiene نظافة جدول تعقيم ثلاجات مكن", icon: Sparkles, color: "text-teal-400 bg-teal-500/15 border-teal-500/30" },
  { name: "Promotions & Offers", nameAr: "إدارة وتفعيل العروض", desc: "Promotional campaigns, combo deals & banners", href: "/admin/offers", category: "Operations", keywords: "offers promotions deals combos عروض خصومات تخفيضات باقات", icon: TagIcon, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { name: "Food Service Codes (PLU)", nameAr: "أكواد وباركود الفود كورت", desc: "Bakery, beverage PLU quick lookup codes", href: "/admin/food-codes", category: "Operations", keywords: "plu food codes bakery coffee فود كورت مخبوزات مشروبات أكواد سريعة", icon: Package, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" },

  // HR & Staff
  { name: "Employee Directory & Contracts", nameAr: "سجل الموظفين والعقود", desc: "Full staff roster, contracts & clearance forms", href: "/hr/employees", category: "HR", keywords: "employees staff roster contracts موظفين عمال عقود رواتب حضور", icon: Users, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
  { name: "Payroll & Salary Distribution", nameAr: "مسير المرتبات والمستحقات", desc: "Automated monthly salary calculation & slips", href: "/admin/payroll", category: "HR", keywords: "payroll salary salaries pay slips رواتب مسير مرتبات مستحقات", icon: Wallet, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  { name: "Staff Adjustments & Loans", nameAr: "السلف والخصومات والمكافآت", desc: "Cash advances, disciplinary deductions & bonuses", href: "/admin/adjustments", category: "HR", keywords: "adjustments loans advances deductions سلف خصومات مكافآت جزاءات", icon: CreditCard, color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
  { name: "Shift Scheduling & Roster", nameAr: "جدول الورديات والإجازات", desc: "Biometric schedules, off days, and shifts", href: "/admin/schedule", category: "HR", keywords: "schedule roster shifts leaves off جدول ورديات إجازات شيفتات", icon: Calendar, color: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30" },
  { name: "Cashier Terminals & PINs", nameAr: "حسابات وبن كود الكاشير", desc: "Manage 4-digit POS PINs and shift permissions", href: "/settings/cashiers", category: "HR", keywords: "pin cashier pos passwords terminals كاشير بن كود صلاحيات نقاط بيع", icon: Shield, color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" },

  // Intelligence & System
  { name: "Ibrahim AI Copilot", nameAr: "مساعد إبراهيم الذكي", desc: "Copilot engine for retail numbers, inventory, and forecasting", href: "/ai-assistant", category: "AI", keywords: "ai ibrahim copilot assistant chat ذكاء اصطناعي إبراهيم محادثة استفسار", icon: Bot, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { name: "Connected POS Devices", nameAr: "شاشات الكاشير والأجهزة المتصلة", desc: "Live ping, battery, and app version for all POS", href: "/admin/devices", category: "Admin", keywords: "devices pos tablets ping online أجهزة تابلت شاشات نقاط البيع", icon: Layers, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  { name: "Security & Action Audit Log", nameAr: "سجل العمليات والأمان", desc: "Immutable audit trail of all sensitive operations", href: "/settings/audit-log", category: "Admin", keywords: "audit log security trail سجل العمليات أمان رقابة تعديلات", icon: Shield, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { name: "CSV Bulk Data Import", nameAr: "استيراد البيانات وقوائم الأسعار", desc: "Bulk catalog & pricing import via spreadsheets", href: "/admin/import-csv", category: "Admin", keywords: "csv import bulk prices رفع شيت أسعار استيراد إكسيل", icon: FileText, color: "text-amber-400 bg-amber-500/15 border-amber-500/30" }
];

function TagIcon(props: any) {
  return <Sparkles {...props} />;
}

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "payments" | "products" | "tools" | "staff">("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const [cachedPayments, setCachedPayments] = useState<any[]>([]);
  const [dbPaymentResults, setDbPaymentResults] = useState<any[]>([]);
  const [dbProductResults, setDbProductResults] = useState<any[]>([]);
  const [dbEmployeeResults, setDbEmployeeResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [debouncedSearch] = useDebounce(search, 250);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 2. Pre-fetch / Load local cache of recent payments when opened
  useEffect(() => {
    if (!isOpen) return;

    // Load instantly from localStorage if present
    try {
      const local = localStorage.getItem("cached_detailed_payments");
      if (local) {
        setCachedPayments(JSON.parse(local));
      }
    } catch (e) {}

    // Fetch latest 200 payments from Firestore in background
    const fetchRecentPayments = async () => {
      try {
        const snap = await getDocs(query(collection(db, "cash_payments"), orderBy("date", "desc"), limit(200)));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) {
          setCachedPayments(docs);
        }
      } catch (e) {
        console.warn("CommandBar recent payments background fetch error:", e);
      }
    };

    fetchRecentPayments();
    // Focus input on open
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // 3. Multi-source Search logic (PO, Invoice, Date, Products, Staff, Tools)
  useEffect(() => {
    const term = debouncedSearch.trim();
    if (term.length < 2) {
      setDbPaymentResults([]);
      setDbProductResults([]);
      setDbEmployeeResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const runSearch = async () => {
      try {
        const termLower = term.toLowerCase();
        const termUpper = term.toUpperCase();
        const termClean = term.replace(/[^a-zA-Z0-9]/g, "");
        const termTitle = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();

        // --- A. Query Firestore for Payments by PO, Invoice, or Date ---
        const paymentQueries: Promise<any>[] = [];
        
        // Exact / clean matches on poNumber
        if (termClean) {
          paymentQueries.push(getDocs(query(collection(db, "cash_payments"), where("poNumber", "==", termClean), limit(6))));
          paymentQueries.push(getDocs(query(collection(db, "cash_payments"), where("invoiceNumber", "==", termClean), limit(6))));
        }
        if (term !== termClean) {
          paymentQueries.push(getDocs(query(collection(db, "cash_payments"), where("poNumber", "==", term), limit(6))));
          paymentQueries.push(getDocs(query(collection(db, "cash_payments"), where("invoiceNumber", "==", term), limit(6))));
        }
        // Match exact date (YYYY-MM-DD or partial YYYY-MM)
        if (term.match(/^\d{4}-\d{2}(-\d{2})?$/)) {
          paymentQueries.push(getDocs(query(collection(db, "cash_payments"), where("date", "==", term), limit(10))));
        }

        // --- B. Query Firestore for Products by Barcode & Description ---
        const productQueries: Promise<any>[] = [];
        if (termClean && termClean.length >= 3) {
          productQueries.push(getDocs(query(collection(productsDb, "products"), where("barcode", "==", termClean), limit(5))));
        }
        productQueries.push(getDocs(query(collection(productsDb, "products"), where("description", ">=", termLower), where("description", "<=", termLower + '\uf8ff'), limit(4))));
        productQueries.push(getDocs(query(collection(productsDb, "products"), where("description", ">=", termUpper), where("description", "<=", termUpper + '\uf8ff'), limit(4))));
        productQueries.push(getDocs(query(collection(productsDb, "products"), where("itemName", ">=", termTitle), where("itemName", "<=", termTitle + '\uf8ff'), limit(4))));

        // --- C. Query Firestore for Employees by Name ---
        const employeeQueries: Promise<any>[] = [
          getDocs(query(collection(db, "employees"), limit(50)))
        ];

        // Execute queries concurrently
        const [paymentSnaps, productSnaps, empSnaps] = await Promise.all([
          Promise.all(paymentQueries),
          Promise.all(productQueries),
          Promise.all(employeeQueries)
        ]);

        // Process Payments
        const payMap = new Map<string, any>();
        paymentSnaps.forEach(snap => {
          snap.docs.forEach((doc: any) => {
            if (!payMap.has(doc.id)) payMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
        });

        // Also add matches from cached payments (in-memory substring search for PO, invoice, company, and date)
        cachedPayments.forEach(p => {
          const po = String(p.poNumber || "").toLowerCase();
          const inv = String(p.invoiceNumber || "").toLowerCase();
          const comp = String(p.companyName || "").toLowerCase();
          const dt = String(p.date || "").toLowerCase();
          const rep = String(p.supplierRepName || "").toLowerCase();
          const cat = String(p.category || "").toLowerCase();

          if (
            po.includes(termLower) ||
            inv.includes(termLower) ||
            comp.includes(termLower) ||
            dt.includes(termLower) ||
            rep.includes(termLower) ||
            cat.includes(termLower)
          ) {
            if (!payMap.has(p.id)) payMap.set(p.id, p);
          }
        });

        setDbPaymentResults(Array.from(payMap.values()).slice(0, 15));

        // Process Products
        const prodMap = new Map<string, any>();
        productSnaps.forEach(snap => {
          snap.docs.forEach((doc: any) => {
            if (!prodMap.has(doc.id)) prodMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
        });
        setDbProductResults(Array.from(prodMap.values()).slice(0, 8));

        // Process Employees
        const empList: any[] = [];
        empSnaps.forEach(snap => {
          snap.docs.forEach((doc: any) => {
            const data = doc.data();
            const name = String(data.name || data.displayName || "").toLowerCase();
            const role = String(data.role || "").toLowerCase();
            const phone = String(data.phone || "").toLowerCase();
            if (name.includes(termLower) || role.includes(termLower) || phone.includes(termLower)) {
              empList.push({ id: doc.id, ...data });
            }
          });
        });
        setDbEmployeeResults(empList.slice(0, 5));

      } catch (err) {
        console.error("Universal CommandBar search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    runSearch();
  }, [debouncedSearch, cachedPayments]);

  // 4. Map Portal Tools to Search Items
  const toolResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      // Return 6 recommended quick jumps
      return PORTAL_PAGES.slice(0, 6).map(t => ({
        id: `tool_${t.href}`,
        type: "page" as const,
        title: t.name,
        subtitle: t.desc,
        href: t.href,
        icon: <t.icon className="w-4 h-4 text-rose-400" />,
        categoryLabel: t.category,
        tags: [{ label: t.category, color: "bg-white/[0.06] text-slate-300 border-white/10" }]
      }));
    }

    return PORTAL_PAGES.filter(t => {
      return (
        t.name.toLowerCase().includes(q) ||
        t.nameAr.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.keywords.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }).map(t => ({
      id: `tool_${t.href}`,
      type: "page" as const,
      title: t.name,
      subtitle: t.desc,
      href: t.href,
      icon: <t.icon className="w-4 h-4 text-rose-400" />,
      categoryLabel: t.category,
      tags: [{ label: t.category, color: "bg-white/[0.06] text-slate-300 border-white/10" }]
    }));
  }, [search]);

  // 5. Map Payment Results
  const paymentItems: SearchResultItem[] = useMemo(() => {
    return dbPaymentResults.map(p => {
      const company = p.companyName || "Disbursement / Payment";
      const totalNum = Number(p.total || p.amount || 0);
      const totalStr = totalNum > 0 ? `EGP ${totalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
      
      const tags = [];
      if (p.poNumber) tags.push({ label: `PO: ${p.poNumber}`, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" });
      if (p.invoiceNumber) tags.push({ label: `Inv: ${p.invoiceNumber}`, color: "bg-blue-500/15 text-blue-300 border-blue-500/30" });
      if (p.date) tags.push({ label: p.date, color: "bg-white/[0.05] text-slate-400 border-white/[0.08]" });
      if (p.method) tags.push({ label: p.method.replace('_', ' '), color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" });

      const searchParam = p.poNumber || p.invoiceNumber || p.companyName || "";
      const href = `/financials/inputs/payments?search=${encodeURIComponent(searchParam)}${p.date ? `&month=${p.date.substring(0, 7)}` : ""}`;

      return {
        id: `pay_${p.id}`,
        type: "payment",
        title: company,
        subtitle: `${p.category ? p.category.toUpperCase() : "PAYMENT"} • ${p.supplierRepName || "Verified Voucher"}`,
        href,
        icon: <Receipt className="w-4 h-4 text-rose-400" />,
        amount: totalStr,
        date: p.date,
        poNumber: p.poNumber,
        invoiceNumber: p.invoiceNumber,
        categoryLabel: "Payment",
        tags
      };
    });
  }, [dbPaymentResults]);

  // 6. Map Product Results
  const productItems: SearchResultItem[] = useMemo(() => {
    return dbProductResults.map(p => {
      const name = p.itemName || p.description || p.name || "Unknown Product";
      const barcode = p.barcode || p.id;
      const price = p.price || p.retailPrice || p.sellingPrice;
      const priceStr = price ? `EGP ${Number(price).toLocaleString()}` : "";

      const tags = [];
      if (barcode) tags.push({ label: `#${barcode}`, color: "bg-purple-500/15 text-purple-300 border-purple-500/30" });
      if (priceStr) tags.push({ label: priceStr, color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" });

      return {
        id: `prod_${p.id}`,
        type: "product",
        title: name,
        subtitle: p.category ? `Category: ${p.category}` : "Stock Catalog Item",
        href: `/admin/product-lookup?search=${encodeURIComponent(barcode)}`,
        icon: <Package className="w-4 h-4 text-purple-400" />,
        categoryLabel: "Product",
        tags
      };
    });
  }, [dbProductResults]);

  // 7. Map Employee Results
  const employeeItems: SearchResultItem[] = useMemo(() => {
    return dbEmployeeResults.map(e => ({
      id: `emp_${e.id}`,
      type: "employee",
      title: e.name || e.displayName || "Staff Member",
      subtitle: `${e.role || "Employee"} • Shift: ${e.shiftTime || "Standard"} • ${e.phone || ""}`,
      href: `/hr/employees`,
      icon: <Users className="w-4 h-4 text-sky-400" />,
      categoryLabel: "Staff",
      tags: [
        { label: e.role || "Staff", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
        { label: e.status || "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
      ]
    }));
  }, [dbEmployeeResults]);

  // 8. Filter based on active tab
  const allCategorized = useMemo(() => {
    if (activeTab === "payments") return paymentItems;
    if (activeTab === "products") return productItems;
    if (activeTab === "tools") return toolResults;
    if (activeTab === "staff") return employeeItems;
    return [...paymentItems, ...productItems, ...toolResults, ...employeeItems];
  }, [activeTab, paymentItems, productItems, toolResults, employeeItems]);

  // Reset selected index when search or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search, activeTab]);

  // Keyboard navigation inside results
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev < allCategorized.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : allCategorized.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allCategorized[selectedIndex]) {
          handleSelect(allCategorized[selectedIndex].href);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const tabs: ("all" | "payments" | "products" | "tools" | "staff")[] = ["all", "payments", "products", "tools", "staff"];
        const nextIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
        setActiveTab(tabs[nextIdx]);
      }
    };

    window.addEventListener("keydown", handleNavigation);
    return () => window.removeEventListener("keydown", handleNavigation);
  }, [isOpen, allCategorized, selectedIndex, activeTab]);

  const handleSelect = useCallback((href: string) => {
    setIsOpen(false);
    setSearch("");
    router.push(href);
  }, [router]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Ambient Glass Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-[#070709]/80 backdrop-blur-2xl transition-all"
            onClick={() => setIsOpen(false)}
          />

          {/* Luxury Command Palette Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed top-[10%] sm:top-[12%] left-1/2 -translate-x-1/2 w-[95%] max-w-2xl z-[9999] px-2"
          >
            <div className="bg-[#111116]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col relative">
              
              {/* Top Luxury Light Strip */}
              <div className="h-[2.5px] w-full bg-gradient-to-r from-red-600 via-rose-500 via-amber-400 via-emerald-400 to-indigo-500" />

              {/* Main Search Input Header */}
              <div className="flex items-center px-4 sm:px-6 py-3.5 border-b border-white/[0.08] relative">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mr-3">
                  <Search className="w-4 h-4 text-rose-400" />
                </div>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO#, invoice#, supplier, date (e.g. 2026-09-11), product, or tool..."
                  className="w-full bg-transparent text-white placeholder-slate-500 px-1 py-2 outline-none font-medium text-sm sm:text-base selection:bg-rose-500 selection:text-white"
                />

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {isSearching && (
                    <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mr-1" />
                  )}

                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[10px] font-mono text-slate-400">
                    ESC
                  </kbd>
                </div>
              </div>

              {/* Quick Filter Category Tabs */}
              <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2 border-b border-white/[0.05] overflow-x-auto scrollbar-none bg-white/[0.01]">
                {[
                  { id: "all", label: "All Results", count: allCategorized.length },
                  { id: "payments", label: "💳 Payments & POs", count: paymentItems.length },
                  { id: "products", label: "📦 Products", count: productItems.length },
                  { id: "tools", label: "⚡ Pages & Tools", count: toolResults.length },
                  { id: "staff", label: "👥 Staff", count: employeeItems.length },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 border border-rose-400/40"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-white/20 text-white" : "bg-white/[0.06] text-slate-400"
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Categorized Results View */}
              <div ref={resultsContainerRef} className="max-h-[55vh] overflow-y-auto p-2 sm:p-3 space-y-1 scrollbar-thin">
                {allCategorized.length > 0 ? (
                  <>
                    {/* PAYMENTS SECTION */}
                    {paymentItems.length > 0 && (activeTab === "all" || activeTab === "payments") && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                            <Receipt className="w-3 h-3 text-rose-400" />
                            <span>Payments & Vendor Vouchers</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{paymentItems.length} records</span>
                        </div>
                        <div className="space-y-1">
                          {paymentItems.map((item) => {
                            const globalIndex = allCategorized.findIndex(i => i.id === item.id);
                            const isSelected = selectedIndex === globalIndex;
                            return (
                              <button
                                key={item.id}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                onClick={() => handleSelect(item.href)}
                                className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-all group cursor-pointer ${
                                  isSelected
                                    ? "bg-white/[0.08] border border-rose-500/40 shadow-lg"
                                    : "hover:bg-white/[0.04] border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 font-black text-rose-400 text-xs">
                                    {item.title.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-black text-white group-hover:text-rose-300 transition-colors truncate">
                                        {item.title}
                                      </span>
                                      {item.tags?.map((tag, tIdx) => (
                                        <span key={tIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color} font-mono`}>
                                          {tag.label}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-slate-400 block mt-0.5 truncate">
                                      {item.subtitle}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                                  {item.amount && (
                                    <span className="text-sm font-black font-mono text-rose-400">
                                      {item.amount}
                                    </span>
                                  )}
                                  <div className={`w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center transition-all ${
                                    isSelected ? "opacity-100 scale-105 bg-rose-600 text-white border-rose-400" : "opacity-0 group-hover:opacity-100"
                                  }`}>
                                    <CornerDownLeft className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* PRODUCTS SECTION */}
                    {productItems.length > 0 && (activeTab === "all" || activeTab === "products") && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-purple-400" />
                            <span>Catalog Products & Barcodes</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{productItems.length} items</span>
                        </div>
                        <div className="space-y-1">
                          {productItems.map((item) => {
                            const globalIndex = allCategorized.findIndex(i => i.id === item.id);
                            const isSelected = selectedIndex === globalIndex;
                            return (
                              <button
                                key={item.id}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                onClick={() => handleSelect(item.href)}
                                className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-all group cursor-pointer ${
                                  isSelected
                                    ? "bg-white/[0.08] border border-purple-500/40 shadow-lg"
                                    : "hover:bg-white/[0.04] border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
                                    <Package className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                                        {item.title}
                                      </span>
                                      {item.tags?.map((tag, tIdx) => (
                                        <span key={tIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color} font-mono`}>
                                          {tag.label}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-slate-400 block mt-0.5 truncate">
                                      {item.subtitle}
                                    </span>
                                  </div>
                                </div>

                                <div className={`w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center transition-all ${
                                  isSelected ? "opacity-100 scale-105 bg-purple-600 text-white border-purple-400" : "opacity-0 group-hover:opacity-100"
                                }`}>
                                  <CornerDownLeft className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TOOLS & PAGES SECTION */}
                    {toolResults.length > 0 && (activeTab === "all" || activeTab === "tools") && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-cyan-400" />
                            <span>Pages & Portal Tools</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{toolResults.length} tools</span>
                        </div>
                        <div className="space-y-1">
                          {toolResults.map((item) => {
                            const globalIndex = allCategorized.findIndex(i => i.id === item.id);
                            const isSelected = selectedIndex === globalIndex;
                            return (
                              <button
                                key={item.id}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                onClick={() => handleSelect(item.href)}
                                className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-all group cursor-pointer ${
                                  isSelected
                                    ? "bg-white/[0.08] border border-cyan-500/40 shadow-lg"
                                    : "hover:bg-white/[0.04] border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
                                    {item.icon}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                                        {item.title}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300 border border-white/10">
                                        {item.categoryLabel}
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-400 block mt-0.5 truncate">
                                      {item.subtitle}
                                    </span>
                                  </div>
                                </div>

                                <div className={`w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center transition-all ${
                                  isSelected ? "opacity-100 scale-105 bg-cyan-600 text-white border-cyan-400" : "opacity-0 group-hover:opacity-100"
                                }`}>
                                  <CornerDownLeft className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* STAFF SECTION */}
                    {employeeItems.length > 0 && (activeTab === "all" || activeTab === "staff") && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-sky-400" />
                            <span>Staff & Cashiers</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{employeeItems.length} staff</span>
                        </div>
                        <div className="space-y-1">
                          {employeeItems.map((item) => {
                            const globalIndex = allCategorized.findIndex(i => i.id === item.id);
                            const isSelected = selectedIndex === globalIndex;
                            return (
                              <button
                                key={item.id}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                onClick={() => handleSelect(item.href)}
                                className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-all group cursor-pointer ${
                                  isSelected
                                    ? "bg-white/[0.08] border border-sky-500/40 shadow-lg"
                                    : "hover:bg-white/[0.04] border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0 text-sky-400">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                                        {item.title}
                                      </span>
                                      {item.tags?.map((tag, tIdx) => (
                                        <span key={tIdx} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.color}`}>
                                          {tag.label}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-slate-400 block mt-0.5 truncate">
                                      {item.subtitle}
                                    </span>
                                  </div>
                                </div>

                                <div className={`w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center transition-all ${
                                  isSelected ? "opacity-100 scale-105 bg-sky-600 text-white border-sky-400" : "opacity-0 group-hover:opacity-100"
                                }`}>
                                  <CornerDownLeft className="w-3.5 h-3.5" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-6 py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">No results found for "{search}"</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Try searching by PO number, invoice number (e.g. 181134), date (YYYY-MM-DD), supplier name (e.g. Ulker), or product barcode.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Ultra-Pro Footer with Keyboard Shortcuts */}
              <div className="bg-white/[0.02] px-4 sm:px-6 py-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[10px] text-slate-300">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[10px] text-slate-300">↓</kbd>
                    <span>Navigate</span>
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[10px] text-slate-300">↵</kbd>
                    <span>Select</span>
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 font-mono text-[10px] text-slate-300">Tab</kbd>
                    <span>Filter Category</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  <span>Circle K Enterprise Search</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
