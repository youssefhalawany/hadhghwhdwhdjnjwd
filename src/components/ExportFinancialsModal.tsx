"use client";

import React, { useState, useEffect } from "react";
import { X, Download, Info } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ExportFinancialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTabName: string; // e.g. "Deposits"
  currentFilterType: string;
  currentFilterValue: string;
  currentTabData: any[];
  currentBranch: string;
}

export default function ExportFinancialsModal({
  isOpen,
  onClose,
  currentTabName,
  currentFilterType,
  currentFilterValue,
  currentTabData,
  currentBranch
}: ExportFinancialsModalProps) {
  const [periodType, setPeriodType] = useState<string>("month");
  const [periodValue, setPeriodValue] = useState(new Date().toISOString().substring(0, 7));
  const [periodEndValue, setPeriodEndValue] = useState("");
  const [exportTarget, setExportTarget] = useState<"current" | "all">("current");
  const [isExporting, setIsExporting] = useState(false);

  // Sync initial state if it matches the current page filter
  useEffect(() => {
    if (isOpen) {
      if (["day", "week", "month", "quarter", "year"].includes(currentFilterType)) {
        setPeriodType(currentFilterType);
      }
      if (currentFilterValue) {
        if (currentFilterType === "month") {
          setPeriodValue(currentFilterValue.substring(0, 7));
        } else if (currentFilterType === "year") {
          setPeriodValue(currentFilterValue.substring(0, 4));
        } else {
          setPeriodValue(currentFilterValue);
        }
      }
    }
  }, [isOpen, currentFilterType, currentFilterValue]);

  if (!isOpen) return null;

  const getDateRange = () => {
    let start = "";
    let end = "";
    const today = new Date();
    
    if (periodType === "day") {
      start = periodValue || today.toISOString().split("T")[0];
      end = start;
    } else if (periodType === "month") {
      const val = periodValue || today.toISOString().substring(0, 7);
      start = `${val}-01`;
      const [yyyy, mm] = val.split("-");
      const lastDay = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
      end = `${val}-${lastDay}`;
    } else if (periodType === "year") {
      const val = periodValue || today.getFullYear().toString();
      start = `${val}-01-01`;
      end = `${val}-12-31`;
    } else if (periodType === "week") {
      const val = periodValue || today.toISOString().split("T")[0];
      const d = new Date(val);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const startD = new Date(d.setDate(diff));
      start = startD.toISOString().split("T")[0];
      const endD = new Date(startD);
      endD.setDate(startD.getDate() + 6);
      end = endD.toISOString().split("T")[0];
    } else if (periodType === "quarter") {
      const val = periodValue || today.toISOString().substring(0, 7);
      const [yyyy, mm] = val.split("-");
      const month = parseInt(mm);
      const quarter = Math.floor((month - 1) / 3);
      const startMonth = quarter * 3 + 1;
      const endMonth = startMonth + 2;
      start = `${yyyy}-${startMonth.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(parseInt(yyyy), endMonth, 0).getDate();
      end = `${yyyy}-${endMonth.toString().padStart(2, "0")}-${lastDay}`;
    } else if (periodType === "custom") {
      start = periodValue;
      end = periodEndValue || periodValue;
    }
    return { start, end };
  };

  const { start, end } = getDateRange();

  // Helper to check if we can skip reads
  const canUseLocalData = () => {
    if (exportTarget === "all") return false;
    
    // If the local tab data matches the exact requested period, reuse it!
    if (currentFilterType === periodType) {
      if (periodType === "day" && currentFilterValue === periodValue) return true;
      if (periodType === "month" && currentFilterValue.startsWith(periodValue)) return true;
      if (periodType === "year" && currentFilterValue.startsWith(periodValue)) return true;
    }
    return false;
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "CIRCLE K";
      workbook.lastModifiedBy = "CIRCLE K";
      workbook.created = new Date();
      workbook.modified = new Date();

      const { start, end } = getDateRange();
      
      const branchIds: string[] = [];
      if (currentBranch === "alamein4") branchIds.push("eL-alamein-4");
      else if (currentBranch === "ola") branchIds.push("ola-el-koronfol");
      else if (currentBranch !== "all") branchIds.push(currentBranch);

      const fetchCollectionData = async (collectionName: string) => {
        let q = collection(db, collectionName) as any;
        if (branchIds.length > 0) {
          q = query(q, where("storeId", "in", branchIds));
        }
        
        // Use standard date filter unless it's payroll which uses createdAt
        if (collectionName === "payroll_lines") {
          const startTs = Timestamp.fromDate(new Date(`${start}T00:00:00`));
          const endTs = Timestamp.fromDate(new Date(`${end}T23:59:59`));
          q = query(q, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));
        } else {
          q = query(q, where("date", ">=", start), where("date", "<=", end));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      };

      const styleHeader = (worksheet: ExcelJS.Worksheet) => {
        worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE61C38" } }; // Circle K Red
        worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getRow(1).height = 25;
      };

      const exportDeposits = async () => {
        let data = [];
        if (exportTarget === "current" && currentTabName.toLowerCase() === "deposits" && canUseLocalData()) {
          data = currentTabData;
        } else {
          data = await fetchCollectionData("deposits");
        }
        
        const sheet = workbook.addWorksheet("Deposits");
        sheet.columns = [
          { header: "Date", key: "date", width: 15 },
          { header: "Shift", key: "shift", width: 15 },
          { header: "From", key: "from", width: 15 },
          { header: "To", key: "to", width: 15 },
          { header: "Amount (EGP)", key: "amount", width: 20 },
          { header: "Notes", key: "notes", width: 30 }
        ];
        styleHeader(sheet);

        let totalAmount = 0;
        data.forEach(d => {
          totalAmount += Number(d.amount || 0);
          sheet.addRow({
            date: d.date,
            shift: d.shift || "N/A",
            from: d.from?.toUpperCase(),
            to: d.to?.toUpperCase(),
            amount: Number(d.amount || 0),
            notes: d.notes || ""
          });
        });

        // Add Summary Row
        const summaryRow = sheet.addRow(["TOTAL", "", "", "", totalAmount, ""]);
        summaryRow.font = { bold: true };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        sheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
      };

      const exportSales = async () => {
        let data = [];
        if (exportTarget === "current" && currentTabName.toLowerCase() === "sales" && canUseLocalData()) {
          data = currentTabData;
        } else {
          data = await fetchCollectionData("sales");
        }
        
        const sheet = workbook.addWorksheet("Sales");
        sheet.columns = [
          { header: "Date", key: "date", width: 15 },
          { header: "Shift", key: "shift", width: 15 },
          { header: "System Total", key: "systemTotal", width: 20 },
          { header: "Cash", key: "cash", width: 20 },
          { header: "Visa", key: "visa", width: 20 },
          { header: "Over/Short", key: "overShort", width: 20 }
        ];
        styleHeader(sheet);

        let sumSystem = 0, sumCash = 0, sumVisa = 0, sumOverShort = 0;
        data.forEach(d => {
          sumSystem += Number(d.systemTotal || 0);
          sumCash += Number(d.cash || 0);
          sumVisa += Number(d.visa || 0);
          sumOverShort += Number(d.overShort || 0);
          
          sheet.addRow({
            date: d.date,
            shift: d.shift || "N/A",
            systemTotal: Number(d.systemTotal || 0),
            cash: Number(d.cash || 0),
            visa: Number(d.visa || 0),
            overShort: Number(d.overShort || 0)
          });
        });

        const summaryRow = sheet.addRow(["TOTAL", "", sumSystem, sumCash, sumVisa, sumOverShort]);
        summaryRow.font = { bold: true };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        ["systemTotal", "cash", "visa", "overShort"].forEach(k => {
          sheet.getColumn(k).numFmt = '#,##0.00;[Red]-#,##0.00';
        });
      };

      const exportPayments = async () => {
        let data = [];
        if (exportTarget === "current" && currentTabName.toLowerCase() === "payments" && canUseLocalData()) {
          data = currentTabData;
        } else {
          data = await fetchCollectionData("cash_payments");
        }
        
        const sheet = workbook.addWorksheet("Payments");
        sheet.columns = [
          { header: "Date", key: "date", width: 15 },
          { header: "Recipient/Supplier", key: "recipient", width: 25 },
          { header: "Amount (EGP)", key: "amount", width: 20 },
          { header: "Method", key: "method", width: 15 },
          { header: "Category", key: "category", width: 20 },
          { header: "Notes", key: "notes", width: 30 }
        ];
        styleHeader(sheet);

        let totalAmount = 0;
        data.forEach(d => {
          totalAmount += Number(d.amount || 0);
          sheet.addRow({
            date: d.date || (d.createdAt ? new Date(d.createdAt?.seconds * 1000).toISOString().split('T')[0] : ""),
            recipient: d.supplier || d.recipient || d.company || "",
            amount: Number(d.amount || 0),
            method: d.method?.toUpperCase() || "",
            category: d.category || "",
            notes: d.notes || ""
          });
        });

        const summaryRow = sheet.addRow(["TOTAL", "", totalAmount, "", "", ""]);
        summaryRow.font = { bold: true };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        sheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
      };

      const exportCheques = async () => {
        let data = [];
        if (exportTarget === "current" && currentTabName.toLowerCase() === "cheques" && canUseLocalData()) {
          data = currentTabData;
        } else {
          data = await fetchCollectionData("cheques");
        }
        
        const sheet = workbook.addWorksheet("Cheques");
        sheet.columns = [
          { header: "Cheque Date", key: "chequeDate", width: 15 },
          { header: "Created Date", key: "date", width: 15 },
          { header: "Cheque Number", key: "chequeNumber", width: 20 },
          { header: "Company", key: "company", width: 25 },
          { header: "Amount", key: "amount", width: 20 },
          { header: "Status", key: "status", width: 15 },
          { header: "Notes", key: "notes", width: 30 }
        ];
        styleHeader(sheet);

        let totalAmount = 0;
        data.forEach(d => {
          totalAmount += Number(d.amount || 0);
          sheet.addRow({
            chequeDate: d.chequeDate,
            date: d.date,
            chequeNumber: d.chequeNumber || d.number,
            company: d.company || d.recipient,
            amount: Number(d.amount || 0),
            status: d.status?.toUpperCase(),
            notes: d.notes || ""
          });
        });

        const summaryRow = sheet.addRow(["TOTAL", "", "", "", totalAmount, "", ""]);
        summaryRow.font = { bold: true };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        sheet.getColumn("amount").numFmt = '#,##0.00;[Red]-#,##0.00';
      };

      const exportCredits = async () => {
        let data = [];
        if (exportTarget === "current" && currentTabName.toLowerCase() === "credits" && canUseLocalData()) {
          data = currentTabData;
        } else {
          data = await fetchCollectionData("credits");
        }
        
        const sheet = workbook.addWorksheet("Credits");
        sheet.columns = [
          { header: "Date", key: "date", width: 15 },
          { header: "Company/Person", key: "entity", width: 25 },
          { header: "Amount", key: "amount", width: 20 },
          { header: "Status", key: "status", width: 15 },
          { header: "Paid", key: "paid", width: 20 },
          { header: "Remaining", key: "remaining", width: 20 }
        ];
        styleHeader(sheet);

        let totalAmount = 0, totalPaid = 0, totalRemaining = 0;
        data.forEach(d => {
          const amt = Number(d.amount || 0);
          const pd = Number(d.paid || 0);
          const rem = amt - pd;
          totalAmount += amt;
          totalPaid += pd;
          totalRemaining += rem;

          sheet.addRow({
            date: d.date,
            entity: d.company || d.person || d.name,
            amount: amt,
            status: d.status?.toUpperCase() || (rem <= 0 ? "PAID" : "PENDING"),
            paid: pd,
            remaining: rem
          });
        });

        const summaryRow = sheet.addRow(["TOTAL", "", totalAmount, "", totalPaid, totalRemaining]);
        summaryRow.font = { bold: true };
        summaryRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        ["amount", "paid", "remaining"].forEach(k => {
          sheet.getColumn(k).numFmt = '#,##0.00;[Red]-#,##0.00';
        });
      };

      if (exportTarget === "all") {
        await Promise.all([
          exportSales(),
          exportPayments(),
          exportCredits(),
          exportCheques(),
          exportDeposits()
        ]);
      } else {
        const tab = currentTabName.toLowerCase();
        if (tab === "deposits") await exportDeposits();
        else if (tab === "sales") await exportSales();
        else if (tab === "payments") await exportPayments();
        else if (tab === "cheques") await exportCheques();
        else if (tab === "credits") await exportCredits();
        else await exportDeposits(); // fallback
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CircleK_${exportTarget === "all" ? "AllFinancials" : currentTabName}_${start}_to_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success("Export successful!");
      onClose();

    } catch (err) {
      console.error(err);
      toast.error("Failed to generate export file.");
    } finally {
      setIsExporting(false);
    }
  };

  const periodOptions = ["Day", "Week", "Month", "Quarter", "Year", "Custom"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="h-6 w-6 text-red-500" />
            Select Export Period
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Period Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Period Type</label>
            <div className="grid grid-cols-2 gap-3">
              {periodOptions.map((option) => {
                const optKey = option.toLowerCase();
                const isSelected = periodType === optKey;
                return (
                  <button
                    key={optKey}
                    onClick={() => setPeriodType(optKey)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-bold border transition-all ${
                      isSelected 
                        ? "bg-blue-500 border-blue-600 text-white shadow-md shadow-blue-500/20" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker (Dynamic based on Period Type) */}
          {periodType !== "custom" && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select {periodType.charAt(0).toUpperCase() + periodType.slice(1)}</label>
              <input
                type={periodType === "day" || periodType === "week" ? "date" : periodType === "month" || periodType === "quarter" ? "month" : "number"}
                min={periodType === "year" ? "2020" : undefined}
                max={periodType === "year" ? "2100" : undefined}
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          )}

          {periodType === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Start Date</label>
                <input
                  type="date"
                  value={periodValue}
                  onChange={(e) => setPeriodValue(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">End Date</label>
                <input
                  type="date"
                  value={periodEndValue}
                  onChange={(e) => setPeriodEndValue(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-foreground focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Export Range Preview */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Export Range:</p>
            <p className="text-sm font-black text-blue-800 dark:text-blue-300">{start} to {end}</p>
          </div>

          {/* What would you like to export? */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">What would you like to export?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExportTarget("current")}
                className={`py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
                  exportTarget === "current"
                    ? "bg-red-500 border-red-600 text-white shadow-md shadow-red-500/20"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <Download size={16} /> Current Tab ({currentTabName})
              </button>
              <button
                onClick={() => setExportTarget("all")}
                className={`py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
                  exportTarget === "all"
                    ? "bg-slate-800 dark:bg-slate-200 border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-md"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <Download size={16} /> All Tabs
              </button>
            </div>
          </div>

          {/* Export Details */}
          <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-700/30 text-xs text-amber-800 dark:text-amber-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold mb-2">
              <Info size={14} /> Export Details:
            </div>
            <ul className="list-disc pl-4 space-y-1.5 opacity-90">
              <li><b>Current Tab:</b> Exports only the active tab data</li>
              <li><b>All Tabs:</b> Creates one Excel file with multiple sheets (Sales, Payments, Credits, Cheques, Deposits)</li>
              <li>All exports include totals and summary rows</li>
              {canUseLocalData() ? (
                <li className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Matches active view: Zero reads consumed for Current Tab export</li>
              ) : (
                <li><b>Note:</b> This export will query the database for accurate historical data</li>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={18} /> Export Now
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
