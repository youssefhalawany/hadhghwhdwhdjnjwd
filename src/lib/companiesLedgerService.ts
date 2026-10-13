/**
 * Companies Profiles & Vendor Ledger Service
 * High-performance local caching with IndexedDB & LocalStorage fallback
 * Eliminates redundant Firestore reads and enables instant sub-millisecond loads.
 */

import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getCacheEntry, setCacheData } from "@/lib/offlineDb";
import { safeGetLocalStorage, safeSetLocalStorage } from "@/lib/storageUtils";

export type CompanyEventType =
  | "payment"
  | "credit"
  | "credit_payment"
  | "return"
  | "expiry"
  | "cheque";

export interface CompanyEvent {
  id: string;
  type: CompanyEventType;
  date: string; // YYYY-MM-DD
  createdAt?: string | null;
  amount: number; // In EGP
  title: string;
  titleAr: string;
  subtitle?: string;
  status?: string;
  method?: string; // cash, bank_transfer, cheque, etc.
  invoiceNumber?: string;
  poNumber?: string;
  returnNumber?: string;
  transferOutNumber?: string;
  batchId?: string;
  barcode?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  tax?: number;
  grossAmount?: number;
  returnDeductionAmount?: number;
  receiptUrl?: string;
  bankTransferReceiptUrl?: string;
  notes?: string;
  storeId?: string;
  branchId?: string;
  sourceCollection: string;
  raw?: any;
}

export interface VendorContact {
  name: string;
  phone?: string;
  nationalId?: string;
  role: string;
  lastSeenDate: string;
}

export interface VendorBankingInfo {
  bankName?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  lastTransferDate?: string;
  lastTransferReceiptUrl?: string;
  totalTransferred: number;
}

export interface MonthlySpendPoint {
  month: string; // e.g. "2026-05"
  monthLabel: string;
  paid: number;
  invoiced: number;
  returns: number;
}

export interface CompanyProfile {
  id: string; // normalized key
  name: string; // canonical display name
  aliases: string[]; // all raw name variations encountered
  totalPaid: number;
  totalInvoiced: number; // total credits
  totalCreditPaid: number; // total settlements towards credits
  remainingCredit: number; // outstanding unpaid balance
  totalReturnsValue: number;
  totalReturnsCount: number;
  totalExpiriesValue: number;
  totalExpiriesCount: number;
  netBalance: number; // remainingCredit
  firstActivityDate: string;
  lastActivityDate: string;
  activityCount: number;
  paymentCount: number;
  creditCount: number;
  returnCount: number;
  expiryCount: number;
  chequeCount: number;
  paymentMethods: {
    cash: number;
    bankTransfer: number;
    cheque: number;
    other: number;
  };
  contacts: VendorContact[];
  bankingInfo?: VendorBankingInfo;
  monthlySpend: MonthlySpendPoint[];
  events: CompanyEvent[];
}

export interface CompaniesLedgerSummary {
  totalCompanies: number;
  totalPaidAllTime: number;
  totalInvoicedAllTime: number;
  totalOutstandingCredits: number;
  totalReturnsValue: number;
  totalExpiriesValue: number;
  lastSyncedAt: number;
}

export function getCompanyProfileUrl(rawName: string): string {
  if (!rawName) return "/financials/companies-profiles";
  return `/financials/companies-profiles?company=${encodeURIComponent(normalizeCompanyName(rawName))}`;
}

const CACHE_KEY = "companies_profiles_ledger_v1";
const FALLBACK_LOCALSTORAGE_KEY = "companies_profiles_ledger_fallback_v1";

/**
 * Normalizes raw company names to group variations like
 * "Coca-Cola", "COCA COLA", "كوكاكولا", "Coca Cola Bottling"
 */
export function normalizeCompanyName(rawName: string): string {
  if (!rawName) return "";
  let s = String(rawName).trim().toLowerCase();

  // Arabic letter normalization
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[\u064B-\u065F]/g, ""); // Tashkeel / diacritics

  // Remove common company suffixes in English & Arabic
  s = s
    .replace(/\b(for\s+trading|for\s+trade|trading|trade|distrib|distribution|company|co|ltd|llc|corp|egypt|misr)\b/gi, "")
    .replace(/(للتجارة والتوزيع|للتجارة|والتوزيع|شركة|ش\.م\.م|ش\.ذ\.م\.م|مصر|توزيع)/g, "");

  // Strip punctuation, hyphens, underscores, extra whitespaces
  s = s.replace(/[^a-z0-9\u0600-\u06FF]/gi, "");

  return s || rawName.trim().toLowerCase();
}

/**
 * Normalizes dates to YYYY-MM-DD
 */
export function normalizeDate(val: any): string {
  if (!val) return "";
  if (typeof val === "object" && typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString().substring(0, 10);
    } catch (_) {}
  }
  if (typeof val === "object" && val.seconds) {
    try {
      return new Date(val.seconds * 1000).toISOString().substring(0, 10);
    } catch (_) {}
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  } catch (_) {}
  return s.substring(0, 10);
}

/**
 * Selects the most polished, human-friendly canonical display name
 */
function pickBestDisplayName(currentBest: string, candidate: string): string {
  if (!candidate) return currentBest;
  if (!currentBest) return candidate;

  // Prefer names with both proper casing or Arabic lettering over all-lowercase
  const candHasArabic = /[\u0600-\u06FF]/.test(candidate);
  const currHasArabic = /[\u0600-\u06FF]/.test(currentBest);

  if (candHasArabic && !currHasArabic) return candidate;
  if (currHasArabic && !candHasArabic) return currentBest;

  // If both english or both arabic, prefer title cased or cleaner string
  if (candidate.length > currentBest.length && candidate.length < 40) {
    return candidate;
  }
  return currentBest;
}

/**
 * Loads companies ledger from local IndexedDB cache or LocalStorage fallback.
 * Takes < 10ms with ZERO Firestore reads.
 */
export async function loadCompaniesFromLocalCache(): Promise<{
  profiles: CompanyProfile[];
  summary: CompaniesLedgerSummary;
  cachedAt: number;
} | null> {
  if (typeof window === "undefined") return null;

  try {
    // 1. Try IndexedDB
    const entry = await getCacheEntry(CACHE_KEY);
    if (entry && entry.data && Array.isArray(entry.data.profiles)) {
      return {
        profiles: entry.data.profiles,
        summary: entry.data.summary,
        cachedAt: entry.timestamp || entry.data.summary?.lastSyncedAt || Date.now(),
      };
    }
  } catch (err) {
    console.debug("IndexedDB read error in loadCompaniesFromLocalCache:", err);
  }

  // 2. Fallback to LocalStorage
  try {
    const fallbackStr = safeGetLocalStorage(FALLBACK_LOCALSTORAGE_KEY);
    if (fallbackStr) {
      const parsed = JSON.parse(fallbackStr);
      if (parsed && Array.isArray(parsed.profiles)) {
        return {
          profiles: parsed.profiles,
          summary: parsed.summary,
          cachedAt: parsed.cachedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.debug("LocalStorage fallback read error:", err);
  }

  return null;
}

/**
 * Saves processed companies to IndexedDB and compact LocalStorage fallback.
 */
export async function saveCompaniesToLocalCache(
  profiles: CompanyProfile[],
  summary: CompaniesLedgerSummary
): Promise<void> {
  if (typeof window === "undefined") return;

  const cachedAt = Date.now();
  summary.lastSyncedAt = cachedAt;

  // 1. Save full data into IndexedDB
  try {
    await setCacheData(CACHE_KEY, {
      profiles,
      summary,
      cachedAt,
    });
  } catch (err) {
    console.debug("IndexedDB save error in saveCompaniesToLocalCache:", err);
  }

  // 2. Save compact version into LocalStorage (strip raw objects to avoid quota limits)
  try {
    const compactProfiles = profiles.map((p) => ({
      ...p,
      events: p.events.map((e) => {
        const { raw, ...cleanEvent } = e;
        return cleanEvent;
      }),
    }));

    safeSetLocalStorage(
      FALLBACK_LOCALSTORAGE_KEY,
      JSON.stringify({
        profiles: compactProfiles,
        summary,
        cachedAt,
      })
    );
  } catch (err) {
    console.debug("LocalStorage save error in saveCompaniesToLocalCache:", err);
  }
}

/**
 * Clears the local cache (forces next load to sync fresh from Firestore)
 */
export async function clearCompaniesLocalCache(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await setCacheData(CACHE_KEY, null);
  } catch (_) {}
  try {
    localStorage.removeItem(FALLBACK_LOCALSTORAGE_KEY);
  } catch (_) {}
}

/**
 * Syncs all company activity from Firestore collections:
 * - cash_payments
 * - credits
 * - credit_payments
 * - supplier_returns
 * - expiries
 * - cheques
 * Deduplicates, normalizes, indexes, saves to local cache, and returns.
 */
export async function syncCompaniesProfiles(
  onProgress?: (step: string) => void
): Promise<{
  profiles: CompanyProfile[];
  summary: CompaniesLedgerSummary;
}> {
  onProgress?.("جاري الاتصال بقواعد البيانات المالية...");

  const safeGetDocs = async (collectionName: string) => {
    try {
      const snap = await getDocs(collection(db, collectionName));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e: any) {
      console.warn(`Could not read ${collectionName}:`, e?.message);
      return [];
    }
  };

  const [
    cashPaymentsRaw,
    creditsRaw,
    creditPaymentsRaw,
    supplierReturnsRaw,
    expiriesRaw,
    chequesRaw,
  ] = await Promise.all([
    safeGetDocs("cash_payments"),
    safeGetDocs("credits"),
    safeGetDocs("credit_payments"),
    safeGetDocs("supplier_returns"),
    safeGetDocs("expiries"),
    safeGetDocs("cheques"),
  ]);

  onProgress?.("جاري معالجة وتدقيق السجلات ودمج الشركات...");

  const companyMap = new Map<string, {
    canonicalName: string;
    aliases: Set<string>;
    events: CompanyEvent[];
    contacts: Map<string, VendorContact>;
    banking: {
      bankName?: string;
      accountNumber?: string;
      beneficiaryName?: string;
      lastTransferDate?: string;
      lastTransferReceiptUrl?: string;
      totalTransferred: number;
    };
    monthlyMap: Map<string, { paid: number; invoiced: number; returns: number }>;
  }>();

  const getOrCreate = (rawName: string) => {
    const trimmed = (rawName || "").trim();
    if (!trimmed || trimmed === "-" || trimmed === "N/A" || trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return null;
    const norm = normalizeCompanyName(trimmed);
    if (!norm || norm.length < 2) return null;

    if (!companyMap.has(norm)) {
      companyMap.set(norm, {
        canonicalName: trimmed,
        aliases: new Set([trimmed]),
        events: [],
        contacts: new Map(),
        banking: { totalTransferred: 0 },
        monthlyMap: new Map(),
      });
    }

    const entry = companyMap.get(norm)!;
    entry.aliases.add(trimmed);
    entry.canonicalName = pickBestDisplayName(entry.canonicalName, trimmed);
    return entry;
  };

  // 1. Process cash_payments
  cashPaymentsRaw.forEach((pay: any) => {
    if (
      pay.status === "deleted" ||
      pay.status === "cancelled" ||
      pay.deleted === true ||
      pay.isDeleted === true ||
      pay.isCancelled === true
    ) return;
    const rawName = (pay.companyName || pay.supplier || pay.vendor || pay.supplierRepName || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(pay.date || pay.createdAt) || new Date().toISOString().substring(0, 10);
    const totalAmount = Number(pay.total || pay.amount || 0);
    const tax = Number(pay.tax || 0);
    const grossAmount = Number(pay.grossAmount || (totalAmount + Number(pay.returnDeductionAmount || 0)));
    const returnDeduction = Number(pay.returnDeductionAmount || 0);
    const method = (pay.method || "cash").toLowerCase();

    // Extract Representative & Contact
    const repName = (pay.supplierRepName || "").trim();
    if (repName && !repName.includes("التحويل للحساب") && !repName.includes("مندوب الشركة المعتمد")) {
      const cKey = repName.toLowerCase();
      if (!entry.contacts.has(cKey)) {
        entry.contacts.set(cKey, {
          name: repName,
          phone: pay.supplierMobile || pay.repMobile || pay.phone || pay.mobile || undefined,
          nationalId: pay.supplierNationalId || undefined,
          role: "مندوب مبيعات وتحصيل",
          lastSeenDate: date,
        });
      }
    }

    // Extract Banking Info
    if (pay.bankName && !entry.banking.bankName) entry.banking.bankName = pay.bankName;
    if (pay.bankAccountNumber && !entry.banking.accountNumber) entry.banking.accountNumber = pay.bankAccountNumber;
    if (pay.beneficiaryName && !entry.banking.beneficiaryName) entry.banking.beneficiaryName = pay.beneficiaryName;
    if (pay.bankTransferReceiptUrl) {
      entry.banking.lastTransferReceiptUrl = pay.bankTransferReceiptUrl;
      entry.banking.lastTransferDate = date;
    }
    if (method === "bank_transfer" || method === "bank" || pay.bankTransferReceiptUrl) {
      entry.banking.totalTransferred += totalAmount;
    }

    // Accumulate Monthly Spend
    if (date.length >= 7) {
      const mKey = date.substring(0, 7);
      if (!entry.monthlyMap.has(mKey)) entry.monthlyMap.set(mKey, { paid: 0, invoiced: 0, returns: 0 });
      entry.monthlyMap.get(mKey)!.paid += totalAmount;
    }

    let methodLabelAr = "نقداً";
    let methodLabelEn = "Cash";
    if (method === "bank_transfer" || method === "bank") {
      methodLabelAr = "تحويل بنكي";
      methodLabelEn = "Bank Transfer";
    } else if (method === "cheque") {
      methodLabelAr = "شيك بنكي";
      methodLabelEn = "Cheque";
    }

    entry.events.push({
      id: pay.id,
      type: "payment",
      date,
      createdAt: pay.createdAt ? normalizeDate(pay.createdAt) : date,
      amount: totalAmount,
      tax,
      grossAmount,
      returnDeductionAmount: returnDeduction,
      method,
      title: `سداد ${methodLabelAr}`,
      titleAr: `سداد ${methodLabelAr}`,
      subtitle: `${methodLabelEn} Payment`,
      invoiceNumber: pay.invoiceNumber || undefined,
      poNumber: pay.poNumber || undefined,
      returnNumber: pay.returnNumber || undefined,
      receiptUrl: pay.receiptUrl || pay.invoiceUrl || undefined,
      bankTransferReceiptUrl: pay.bankTransferReceiptUrl || undefined,
      notes: pay.notes || pay.description || undefined,
      storeId: pay.storeId,
      branchId: pay.branchId,
      sourceCollection: "cash_payments",
      raw: pay,
    });
  });

  // 2. Process credits (invoices)
  creditsRaw.forEach((cred: any) => {
    if (
      cred.status === "deleted" ||
      cred.status === "cancelled" ||
      cred.deleted === true ||
      cred.isDeleted === true ||
      cred.isCancelled === true
    ) return;
    const rawName = (cred.companyName || cred.supplierName || cred.supplier || cred.vendor || cred.name || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(cred.collectionDate || cred.date || cred.createdAt) || new Date().toISOString().substring(0, 10);
    const baseAmt = Number(cred.amountDue || cred.amount || 0);
    const tax = Number(cred.tax || 0);
    const totalAmount = Number(cred.totalAmount || cred.total || (baseAmt + tax));
    const paidAmount = Number(cred.paidAmount || 0);
    const isPaid = cred.status === "paid" || cred.isPaid === true || (paidAmount >= totalAmount && totalAmount > 0);

    // Extract Representative & Contact from Credits if present
    const credRep = (cred.supplierRepName || cred.repName || cred.agentName || "").trim();
    if (credRep && !credRep.includes("مندوب")) {
      const cKey = credRep.toLowerCase();
      if (!entry.contacts.has(cKey)) {
        entry.contacts.set(cKey, {
          name: credRep,
          phone: cred.supplierMobile || cred.repMobile || cred.mobile || cred.phone || undefined,
          nationalId: cred.supplierNationalId || cred.nationalId || undefined,
          role: "مندوب مبيعات وتوريد",
          lastSeenDate: date,
        });
      }
    }

    // Accumulate Monthly Invoiced
    if (date.length >= 7) {
      const mKey = date.substring(0, 7);
      if (!entry.monthlyMap.has(mKey)) entry.monthlyMap.set(mKey, { paid: 0, invoiced: 0, returns: 0 });
      entry.monthlyMap.get(mKey)!.invoiced += totalAmount;
    }

    entry.events.push({
      id: cred.id,
      type: "credit",
      date,
      createdAt: cred.createdAt ? normalizeDate(cred.createdAt) : date,
      amount: totalAmount,
      tax,
      grossAmount: totalAmount,
      status: isPaid ? "paid" : (paidAmount > 0 ? "partial" : "open"),
      method: cred.paymentMethod || "credit",
      title: isPaid ? "فاتورة آجل (مسددة)" : (paidAmount > 0 ? "فاتورة آجل (مسددة جزئياً)" : "فاتورة آجل (مستحقة)"),
      titleAr: isPaid ? "فاتورة آجل (مسددة)" : (paidAmount > 0 ? "فاتورة آجل (مسددة جزئياً)" : "فاتورة آجل (مستحقة)"),
      subtitle: isPaid ? "Credit Invoice (Paid)" : "Credit Invoice (Open)",
      invoiceNumber: cred.invoiceNumber || undefined,
      poNumber: cred.poNumber || undefined,
      receiptUrl: cred.receiptUrl || cred.invoiceUrl || undefined,
      notes: cred.notes || cred.description || undefined,
      storeId: cred.storeId,
      branchId: cred.branchId,
      sourceCollection: "credits",
      raw: cred,
    });
  });

  // 3. Process credit_payments
  creditPaymentsRaw.forEach((cp: any) => {
    if (
      cp.status === "deleted" ||
      cp.status === "cancelled" ||
      cp.deleted === true ||
      cp.isDeleted === true ||
      cp.isCancelled === true
    ) return;
    const rawName = (cp.companyName || cp.supplierName || cp.supplier || cp.vendor || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(cp.date || cp.createdAt) || new Date().toISOString().substring(0, 10);
    const amt = Number(cp.amount || cp.total || 0);
    const method = (cp.method || "cash").toLowerCase();

    // Accumulate Monthly Paid via credit settlements
    if (date.length >= 7) {
      const mKey = date.substring(0, 7);
      if (!entry.monthlyMap.has(mKey)) entry.monthlyMap.set(mKey, { paid: 0, invoiced: 0, returns: 0 });
      entry.monthlyMap.get(mKey)!.paid += amt;
    }

    entry.events.push({
      id: cp.id,
      type: "credit_payment",
      date,
      createdAt: cp.createdAt ? normalizeDate(cp.createdAt) : date,
      amount: amt,
      method,
      status: "settled",
      title: "سداد دفعة آجل",
      titleAr: "سداد دفعة آجل",
      subtitle: "Credit Settlement Drop",
      invoiceNumber: cp.invoiceNumber || undefined,
      notes: cp.notes || undefined,
      storeId: cp.storeId,
      branchId: cp.branchId,
      sourceCollection: "credit_payments",
      raw: cp,
    });
  });

  // 4. Process supplier_returns
  supplierReturnsRaw.forEach((ret: any) => {
    if (
      ret.isDeleted === true ||
      ret.deleted === true ||
      ret.status === "deleted" ||
      ret.status === "cancelled"
    ) return;
    const rawName = (ret.supplier || ret.supplierName || ret.companyName || ret.vendor || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(ret.returnedAt || ret.date || ret.createdAt) || new Date().toISOString().substring(0, 10);
    const qty = Number(ret.quantity || 1);
    const price = Number(ret.totalPrice || ret.price || (Number(ret.unitPrice || 0) * qty) || 0);
    const isSettled = ret.status === "returned" || ret.isSettled === true;

    // Extract Agent / Driver contact
    const agentName = (ret.agentName || "").trim();
    if (agentName) {
      const cKey = agentName.toLowerCase();
      if (!entry.contacts.has(cKey)) {
        entry.contacts.set(cKey, {
          name: agentName,
          phone: ret.agentMobile || ret.mobile || ret.phone || undefined,
          nationalId: ret.agentNationalId || ret.nationalId || undefined,
          role: "سائق استلام / مندوب مرتجعات",
          lastSeenDate: date,
        });
      }
    }

    // Accumulate Monthly Returns
    if (date.length >= 7) {
      const mKey = date.substring(0, 7);
      if (!entry.monthlyMap.has(mKey)) entry.monthlyMap.set(mKey, { paid: 0, invoiced: 0, returns: 0 });
      entry.monthlyMap.get(mKey)!.returns += price;
    }

    entry.events.push({
      id: ret.id,
      type: "return",
      date,
      createdAt: ret.createdAt ? normalizeDate(ret.createdAt) : date,
      amount: price,
      quantity: qty,
      itemName: ret.itemName || "صنف مرتجع",
      barcode: ret.barcode !== "N/A" ? ret.barcode : undefined,
      returnNumber: ret.returnNumber || undefined,
      transferOutNumber: ret.transferOutNumber || undefined,
      status: isSettled ? "returned" : "pending",
      title: isSettled ? `مرتجع مورد مستلم (${qty} قطعة)` : `مرتجع معلق (${qty} قطعة)`,
      titleAr: isSettled ? `مرتجع مورد مستلم (${qty} قطعة)` : `مرتجع معلق (${qty} قطعة)`,
      subtitle: isSettled ? "Supplier Return (Settled)" : "Supplier Return (Pending)",
      notes: ret.agentName ? `المندوب: ${ret.agentName} ${ret.agentMobile ? `(${ret.agentMobile})` : ""}` : ret.notes,
      storeId: ret.storeId,
      branchId: ret.branchId,
      sourceCollection: "supplier_returns",
      raw: ret,
    });
  });

  // 5. Process expiries
  expiriesRaw.forEach((exp: any) => {
    if (
      exp.status === "deleted" ||
      exp.status === "cancelled" ||
      exp.deleted === true ||
      exp.isDeleted === true
    ) return;
    const rawName = (exp.supplier || exp.vendor || exp.companyName || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(exp.createdAt || exp.poDate || exp.expiryDate) || new Date().toISOString().substring(0, 10);
    const qty = Number(exp.quantity || exp.initialQuantity || 1);
    const unitPrice = Number(exp.unitPrice || 0);
    const totalCost = Number(exp.totalPrice || exp.cost || (unitPrice * qty) || 0);

    entry.events.push({
      id: exp.id,
      type: "expiry",
      date,
      createdAt: exp.createdAt ? normalizeDate(exp.createdAt) : date,
      amount: totalCost,
      quantity: qty,
      unitPrice,
      itemName: exp.itemName || "صنف منتهي الصلاحية",
      barcode: exp.barcode !== "N/A" ? exp.barcode : undefined,
      batchId: exp.batchId || undefined,
      invoiceNumber: exp.invoiceNumber !== "N/A" ? exp.invoiceNumber : undefined,
      status: exp.status || "active",
      title: `صنف تالف/منتهي (${qty} ق)`,
      titleAr: `صنف تالف/منتهي (${qty} ق)`,
      subtitle: `Expiry Claim • Exp: ${exp.expiryDate || "N/A"}`,
      notes: exp.notes || undefined,
      storeId: exp.storeId,
      branchId: exp.branchId,
      sourceCollection: "expiries",
      raw: exp,
    });
  });

  // 6. Process cheques
  chequesRaw.forEach((chq: any) => {
    if (
      chq.status === "deleted" ||
      chq.status === "cancelled" ||
      chq.deleted === true ||
      chq.isDeleted === true
    ) return;
    const rawName = (chq.companyName || chq.payee || chq.supplier || chq.beneficiary || "").trim();
    const entry = getOrCreate(rawName);
    if (!entry) return;

    const date = normalizeDate(chq.date || chq.dueDate || chq.createdAt) || new Date().toISOString().substring(0, 10);
    const amt = Number(chq.amount || 0);

    if (chq.bankName && !entry.banking.bankName) entry.banking.bankName = chq.bankName;
    if (chq.payee && !entry.banking.beneficiaryName) entry.banking.beneficiaryName = chq.payee;

    entry.events.push({
      id: chq.id,
      type: "cheque",
      date,
      createdAt: chq.createdAt ? normalizeDate(chq.createdAt) : date,
      amount: amt,
      method: "cheque",
      status: chq.status || "issued",
      title: `شيك بنكي ${chq.chequeNumber ? `#${chq.chequeNumber}` : ""}`,
      titleAr: `شيك بنكي ${chq.chequeNumber ? `#${chq.chequeNumber}` : ""}`,
      subtitle: `Cheque Issued • Due: ${chq.dueDate || "N/A"}`,
      notes: chq.bankName ? `بنك: ${chq.bankName}` : chq.notes,
      sourceCollection: "cheques",
      raw: chq,
    });
  });

  onProgress?.("جاري حساب مؤشرات الأداء والبيانات التراكمية لكل شركة...");

  // Build CompanyProfile array
  const profiles: CompanyProfile[] = [];

  let grandTotalPaid = 0;
  let grandTotalInvoiced = 0;
  let grandTotalOutstandingCredits = 0;
  let grandTotalReturnsValue = 0;
  let grandTotalExpiriesValue = 0;

  companyMap.forEach((data, normId) => {
    // Strictly omit companies with no active transactions or blank names
    if (!data.events || data.events.length === 0) return;
    if (!data.canonicalName || data.canonicalName.trim().length < 2) return;

    // Sort events descending by date
    const sortedEvents = data.events.sort((a, b) => {
      const dComp = b.date.localeCompare(a.date);
      if (dComp !== 0) return dComp;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    let totalPaid = 0;
    let totalInvoiced = 0;
    let totalCreditPaid = 0;
    let totalReturnsValue = 0;
    let totalReturnsCount = 0;
    let totalExpiriesValue = 0;
    let totalExpiriesCount = 0;

    let paymentCount = 0;
    let creditCount = 0;
    let returnCount = 0;
    let expiryCount = 0;
    let chequeCount = 0;

    const paymentMethods = {
      cash: 0,
      bankTransfer: 0,
      cheque: 0,
      other: 0,
    };

    sortedEvents.forEach((ev) => {
      if (ev.type === "payment") {
        totalPaid += ev.amount;
        paymentCount++;
        if (ev.method === "cash") paymentMethods.cash += ev.amount;
        else if (ev.method === "bank_transfer" || ev.method === "bank") paymentMethods.bankTransfer += ev.amount;
        else if (ev.method === "cheque") paymentMethods.cheque += ev.amount;
        else paymentMethods.other += ev.amount;
      } else if (ev.type === "credit") {
        totalInvoiced += ev.amount;
        creditCount++;
      } else if (ev.type === "credit_payment") {
        totalCreditPaid += ev.amount;
      } else if (ev.type === "return") {
        totalReturnsValue += ev.amount;
        totalReturnsCount += ev.quantity || 1;
        returnCount++;
      } else if (ev.type === "expiry") {
        totalExpiriesValue += ev.amount;
        totalExpiriesCount += ev.quantity || 1;
        expiryCount++;
      } else if (ev.type === "cheque") {
        chequeCount++;
      }
    });

    // Outstanding credit calculation:
    // If invoice is open, remaining is totalInvoiced - totalCreditPaid (capped at 0)
    const remainingCredit = Math.max(0, totalInvoiced - totalCreditPaid);

    const dates = sortedEvents.map((e) => e.date).filter(Boolean).sort();
    const firstActivityDate = dates[0] || "";
    const lastActivityDate = dates[dates.length - 1] || "";

    grandTotalPaid += totalPaid;
    grandTotalInvoiced += totalInvoiced;
    grandTotalOutstandingCredits += remainingCredit;
    grandTotalReturnsValue += totalReturnsValue;
    grandTotalExpiriesValue += totalExpiriesValue;

    // Contact List
    const contacts: VendorContact[] = Array.from(data.contacts.values()).sort((a, b) =>
      (b.lastSeenDate || "").localeCompare(a.lastSeenDate || "")
    );

    // Banking info
    const bankingInfo: VendorBankingInfo | undefined =
      data.banking.bankName ||
      data.banking.accountNumber ||
      data.banking.beneficiaryName ||
      data.banking.totalTransferred > 0 ||
      data.banking.lastTransferReceiptUrl
        ? data.banking
        : undefined;

    // Chronological monthly spend points
    const monthKeys = Array.from(data.monthlyMap.keys()).sort();
    const monthlySpend: MonthlySpendPoint[] = monthKeys.map((mKey) => {
      const [year, monthNum] = mKey.split("-");
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const mIdx = parseInt(monthNum, 10) - 1;
      const monthLabel = mIdx >= 0 && mIdx < 12 ? `${monthNames[mIdx]} ${year}` : mKey;
      const mData = data.monthlyMap.get(mKey) || { paid: 0, invoiced: 0, returns: 0 };
      return {
        month: mKey,
        monthLabel,
        paid: mData.paid,
        invoiced: mData.invoiced,
        returns: mData.returns,
      };
    });

    profiles.push({
      id: normId,
      name: data.canonicalName,
      aliases: Array.from(data.aliases),
      totalPaid,
      totalInvoiced,
      totalCreditPaid,
      remainingCredit,
      totalReturnsValue,
      totalReturnsCount,
      totalExpiriesValue,
      totalExpiriesCount,
      netBalance: remainingCredit,
      firstActivityDate,
      lastActivityDate,
      activityCount: sortedEvents.length,
      paymentCount,
      creditCount,
      returnCount,
      expiryCount,
      chequeCount,
      paymentMethods,
      contacts,
      bankingInfo,
      monthlySpend,
      events: sortedEvents,
    });
  });

  // Sort profiles by activity & spend
  profiles.sort((a, b) => {
    const valA = a.totalPaid + a.totalInvoiced + a.totalReturnsValue + a.totalExpiriesValue;
    const valB = b.totalPaid + b.totalInvoiced + b.totalReturnsValue + b.totalExpiriesValue;
    if (valB !== valA) return valB - valA;
    return b.activityCount - a.activityCount;
  });

  const summary: CompaniesLedgerSummary = {
    totalCompanies: profiles.length,
    totalPaidAllTime: grandTotalPaid,
    totalInvoicedAllTime: grandTotalInvoiced,
    totalOutstandingCredits: grandTotalOutstandingCredits,
    totalReturnsValue: grandTotalReturnsValue,
    totalExpiriesValue: grandTotalExpiriesValue,
    lastSyncedAt: Date.now(),
  };

  onProgress?.("جاري حفظ البيانات محلياً لتفادي استهلاك القراءات...");

  // Save to local cache
  await saveCompaniesToLocalCache(profiles, summary);

  return { profiles, summary };
}
