"use client";

import React, { useState, useEffect } from "react";
import { productsDb } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { PageWrapper } from "@/components/PageWrapper";
import { Sparkles, Calendar, User, Search, MapPin, Eye, Share2, X, FileText, Printer } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";

interface CleaningLog {
  id: string;
  areaId: string;
  areaNameEn: string;
  areaNameAr: string;
  photoUrl: string;
  signatureUrl: string;
  cashierName: string;
  timestamp: string;
  localTime?: string;
}

export default function ManagerCleaningLogsPage() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<CleaningLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all_time"); // all_time, today, yesterday, this_week, this_month
  const [cashierFilter, setCashierFilter] = useState("all");
  
  const [selectedLog, setSelectedLog] = useState<CleaningLog | null>(null);

  // Report States
  const [showReportConfig, setShowReportConfig] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportShift, setReportShift] = useState("morning");
  const [generatedReportLogs, setGeneratedReportLogs] = useState<CleaningLog[] | null>(null);

  const generateShiftReport = () => {
    if (!reportDate) return;
    const [year, month, day] = reportDate.split('-').map(Number);
    
    // Using local browser timezone to match user expectation
    const middleOfDay = new Date(year, month - 1, day, 12, 30, 0);
    const middleOfNight = new Date(year, month - 1, day, 0, 30, 0);
    const nextNight = new Date(year, month - 1, day + 1, 0, 30, 0);

    let rLogs = [];
    if (reportShift === 'morning') {
      rLogs = logs.filter(log => {
        const d = new Date(log.timestamp);
        return d >= middleOfDay && d < nextNight;
      });
    } else {
      rLogs = logs.filter(log => {
        const d = new Date(log.timestamp);
        return d >= middleOfNight && d < middleOfDay;
      });
    }
    
    rLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setGeneratedReportLogs(rLogs);
    setShowReportConfig(false);
  };

  const shareReportToWhatsApp = async () => {
    if (!generatedReportLogs) return;

    const dateStr = reportDate.split('-').reverse().join('/');
    const shiftName = reportShift === 'morning' 
      ? (language === 'en' ? 'Morning Shift' : 'الوردية الصباحية')
      : (language === 'en' ? 'Night Shift' : 'الوردية المسائية');

    const title = language === 'en' ? 'Shift Cleaning Report' : 'تقرير نظافة الوردية';

    // Show loading text on button (optional, handled by fast processing)
    try {
      const reportElement = document.getElementById("printable-report");
      if (!reportElement) throw new Error("Report element not found");

      const originalDisplay = reportElement.style.display;
      reportElement.style.display = 'block';

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let currentY = 10;

      // 1. Capture Header
      const headerElement = document.getElementById("report-header");
      if (headerElement) {
        const headerImg = await toJpeg(headerElement, { quality: 1.0, backgroundColor: '#ffffff', pixelRatio: 2 });
        const hProps = pdf.getImageProperties(headerImg);
        const hHeight = (hProps.height * pdfWidth) / hProps.width;
        pdf.addImage(headerImg, 'JPEG', 0, currentY, pdfWidth, hHeight);
        currentY += hHeight + 10;
      }

      // 2. Capture Each Log (One per page)
      for (let i = 0; i < generatedReportLogs.length; i++) {
        const logElement = document.getElementById(`report-log-${i}`);
        if (logElement) {
          const logImg = await toJpeg(logElement, { quality: 0.95, backgroundColor: '#ffffff', pixelRatio: 2 });
          const lProps = pdf.getImageProperties(logImg);
          
          let lWidth = pdfWidth - 20; // 10mm padding on sides
          let lHeight = (lProps.height * lWidth) / lProps.width;
          
          const maxAllowedHeight = pageHeight - currentY - 10;
          
          // Shrink if it exceeds the remaining page height
          if (lHeight > maxAllowedHeight) {
            const ratio = maxAllowedHeight / lHeight;
            lHeight = lHeight * ratio;
            lWidth = lWidth * ratio;
          }
          
          const xOffset = (pdfWidth - lWidth) / 2;
          pdf.addImage(logImg, 'JPEG', xOffset, currentY, lWidth, lHeight);
          
          // Add a new page for the next record
          if (i < generatedReportLogs.length - 1) {
            pdf.addPage();
            currentY = 10;
          }
        }
      }

      // Restore original styles
      reportElement.style.display = originalDisplay;

      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `Shift_Cleaning_Report_${reportDate}.pdf`, { type: 'application/pdf' });

      const text = `*${title}*\n*Date:* ${dateStr}\n*Shift:* ${shiftName}\n(Please find the attached PDF report)`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title,
          text: text,
          files: [file]
        });
      } else {
        pdf.save(`Shift_Cleaning_Report_${reportDate}.pdf`);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      alert((language === 'en' ? 'Error generating PDF report: ' : 'حدث خطأ أثناء إنشاء التقرير: ') + err.message);
    }
  };

  const shareToWhatsApp = async (log: CleaningLog) => {
    try {
      const formattedDate = formatDate(log.timestamp, log.localTime);
      const text = language === 'en' 
        ? `*Cleaning Report*\nArea: ${log.areaNameEn}\nCashier: ${log.cashierName}\nDate: ${formattedDate}`
        : `*تقرير النظافة*\nالمنطقة: ${log.areaNameAr}\nالصراف: ${log.cashierName}\nالتاريخ: ${formattedDate}`;

      if (navigator.share) {
        let file: File | null = null;
        if (log.photoUrl.startsWith('data:')) {
          const res = await fetch(log.photoUrl);
          const blob = await res.blob();
          file = new File([blob], `cleaning_${log.cashierName.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' });
        }
        
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: language === 'en' ? 'Cleaning Report' : 'تقرير النظافة',
            text: text,
            files: [file]
          });
          return;
        }
      }

      // Fallback
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } catch (err) {
      console.error("Error sharing:", err);
      // fallback
      const formattedDate = formatDate(log.timestamp, log.localTime);
      const text = `*Cleaning Report*\nArea: ${log.areaNameEn}\nCashier: ${log.cashierName}\nDate: ${formattedDate}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  useEffect(() => {
    const q = query(collection(productsDb, "cleaning_logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CleaningLog[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as CleaningLog);
      });
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching cleaning logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const uniqueCashiers = Array.from(new Set(logs.map(l => l.cashierName))).filter(Boolean);

  const filteredLogs = logs.filter(log => {
    // 1. Search filter
    const matchesSearch = log.cashierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.areaNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.areaNameAr.includes(searchTerm);
    
    // 2. Cashier filter
    const matchesCashier = cashierFilter === "all" || log.cashierName === cashierFilter;
    
    // 3. Date filter
    let matchesDate = true;
    if (dateFilter !== "all_time") {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      if (dateFilter === "today") {
        matchesDate = logDate.toDateString() === now.toDateString();
      } else if (dateFilter === "yesterday") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        matchesDate = logDate.toDateString() === yesterday.toDateString();
      } else if (dateFilter === "this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = logDate >= weekAgo;
      } else if (dateFilter === "this_month") {
        matchesDate = logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
      }
    }
    
    return matchesSearch && matchesCashier && matchesDate;
  });

  const formatDate = (isoString: string, fallbackLocal?: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh'
      }).format(d);
    } catch {
      return fallbackLocal || isoString;
    }
  };

  return (
    <PageWrapper className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8" dir={language === "ar" ? "rtl" : "ltr"}>
      
      {/* Header & Filters */}
      <header className="mb-8 flex flex-col gap-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Sparkles className="text-cyan-500" size={32} />
              {language === 'en' ? 'Cleaning Logs' : 'سجلات النظافة'}
            </h1>
            <p className="text-slate-500 mt-2">
              {language === 'en' ? 'Review and filter cleaning tasks submitted by cashiers.' : 'مراجعة وتصفية مهام النظافة المقدمة من قبل الصرافين.'}
            </p>
          </div>
          <button 
            onClick={() => setShowReportConfig(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
          >
            <FileText size={20} />
            {language === 'en' ? 'Shift Report' : 'تقرير الوردية'}
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'en' ? 'Search logs...' : 'ابحث في السجلات...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
            />
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full md:w-48 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            <option value="all_time">{language === 'en' ? 'All Time' : 'كل الوقت'}</option>
            <option value="today">{language === 'en' ? 'Today' : 'اليوم'}</option>
            <option value="yesterday">{language === 'en' ? 'Yesterday' : 'أمس'}</option>
            <option value="this_week">{language === 'en' ? 'This Week' : 'هذا الأسبوع'}</option>
            <option value="this_month">{language === 'en' ? 'This Month' : 'هذا الشهر'}</option>
          </select>

          {/* Cashier Filter */}
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="w-full md:w-48 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            <option value="all">{language === 'en' ? 'All Cashiers' : 'كل الصرافين'}</option>
            {uniqueCashiers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Content */}
      <main className="print:hidden">
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
            <Sparkles size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              {language === 'en' ? 'No logs found' : 'لم يتم العثور على سجلات'}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLogs.map(log => (
              <div key={log.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                
                {/* Photo Header */}
                <div 
                  className="h-48 w-full bg-slate-100 dark:bg-slate-800 relative group cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <img src={log.photoUrl} alt={log.areaNameEn} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(log.timestamp, log.localTime)}
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                        <MapPin size={18} className="text-cyan-500" />
                        {language === 'en' ? log.areaNameEn : log.areaNameAr}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mt-1">
                        <User size={14} />
                        {log.cashierName}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      {language === 'en' ? 'Signature' : 'التوقيع'}
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 h-16 flex items-center justify-center">
                      {log.signatureUrl ? (
                        <img src={log.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain filter dark:invert" />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Signature</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Report Configuration Modal */}
      {showReportConfig && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-cyan-500" />
                {language === 'en' ? 'Generate Shift Report' : 'إنشاء تقرير الوردية'}
              </h2>
              <button onClick={() => setShowReportConfig(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full p-2">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'en' ? 'Select Date' : 'اختر التاريخ'}
                </label>
                <input 
                  type="date" 
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {language === 'en' ? 'Select Shift' : 'اختر الوردية'}
                </label>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setReportShift('morning')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${reportShift === 'morning' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800'}`}
                  >
                    {language === 'en' ? 'Morning (12:30 PM - 12:30 AM)' : 'الصباح (12:30 م - 12:30 ص)'}
                  </button>
                  <button 
                    onClick={() => setReportShift('night')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${reportShift === 'night' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800'}`}
                  >
                    {language === 'en' ? 'Night (12:30 AM - 12:30 PM)' : 'المساء (12:30 ص - 12:30 م)'}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={generateShiftReport}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold text-lg active:scale-95 transition-transform"
            >
              {language === 'en' ? 'Generate' : 'إنشاء'}
            </button>
          </div>
        </div>
      )}

      {/* Generated Report View */}
      {generatedReportLogs && (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 overflow-y-auto print:bg-white print:p-0 print:m-0">
          <div className="max-w-4xl mx-auto p-4 md:p-8 print:p-0">
            
            {/* Action Bar (Hidden in print) */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setGeneratedReportLogs(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl"
              >
                <X size={20} />
                {language === 'en' ? 'Close' : 'إغلاق'}
              </button>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2 rounded-xl font-bold shadow-md active:scale-95 transition-transform"
                >
                  <Printer size={18} />
                  {language === 'en' ? 'Print' : 'طباعة'}
                </button>
                <button 
                  onClick={shareReportToWhatsApp}
                  className="flex items-center gap-2 bg-[#25D366] text-white px-5 py-2 rounded-xl font-bold shadow-md active:scale-95 transition-transform"
                >
                  <Share2 size={18} />
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div id="printable-report" className="bg-white dark:bg-slate-900 print:bg-white p-6 md:p-10 rounded-3xl shadow-xl print:shadow-none border border-slate-200 dark:border-slate-800 print:border-none text-slate-900 dark:text-slate-900">
              
              <div id="report-header" className="text-center mb-10 pb-6 border-b-2 border-slate-100 print:border-slate-300 bg-white">
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2 text-black">
                  {language === 'en' ? 'Shift Cleaning Report' : 'تقرير نظافة الوردية'}
                </h1>
                <p className="text-lg text-slate-500 print:text-slate-700 font-medium">
                  {language === 'en' ? 'Date:' : 'التاريخ:'} {reportDate.split('-').reverse().join('/')} &nbsp;|&nbsp; 
                  {language === 'en' ? 'Shift:' : 'الوردية:'} {reportShift === 'morning' ? (language === 'en' ? 'Morning Shift (12:30 PM - 12:30 AM)' : 'الصباح (12:30 م - 12:30 ص)') : (language === 'en' ? 'Night Shift (12:30 AM - 12:30 PM)' : 'المساء (12:30 ص - 12:30 م)')}
                </p>
                <p className="text-md text-slate-400 mt-2">
                  {language === 'en' ? 'Total Tasks Completed:' : 'إجمالي المهام المنجزة:'} <span className="font-bold text-cyan-600">{generatedReportLogs.length}</span>
                </p>
              </div>

              {generatedReportLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-medium">
                  {language === 'en' ? 'No cleaning tasks recorded during this shift.' : 'لم يتم تسجيل أي مهام نظافة خلال هذه الوردية.'}
                </div>
              ) : (
                <div className="flex flex-col gap-8 print:gap-12">
                  {generatedReportLogs.map((log, idx) => (
                    <div id={`report-log-${idx}`} key={log.id} className="flex flex-col sm:flex-row gap-6 border border-slate-200 dark:border-slate-800 print:border-slate-400 p-6 rounded-3xl print:break-inside-avoid bg-white dark:bg-slate-800/50 print:bg-white">
                      
                      {/* Massive Image Container */}
                      <div className="w-full sm:w-72 h-72 shrink-0 bg-slate-200 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner">
                        <img src={log.photoUrl} alt="Cleaning" className="w-full h-full object-cover" />
                      </div>
                      
                      {/* Big Details */}
                      <div className="flex flex-col justify-center flex-1">
                        <h3 className="font-black text-2xl md:text-3xl text-slate-900 dark:text-white print:text-black mb-4">
                          {idx + 1}. {language === 'en' ? log.areaNameEn : log.areaNameAr}
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-lg font-bold text-slate-700 dark:text-slate-300 print:text-slate-800">
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800"><User size={20} className="text-cyan-500" /></div>
                            {log.cashierName}
                          </div>
                          <div className="flex items-center gap-3 text-lg font-bold text-slate-700 dark:text-slate-300 print:text-slate-800">
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800"><Calendar size={20} className="text-cyan-500" /></div>
                            {formatDate(log.timestamp, log.localTime)}
                          </div>
                        </div>

                        {/* Signature (if available) */}
                        {log.signatureUrl && (
                          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 print:border-slate-300">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                              {language === 'en' ? 'Signature' : 'التوقيع'}
                            </span>
                            <div className="h-20 max-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center p-2 shadow-sm">
                              <img src={log.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain filter dark:invert print:invert-0" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-12 pt-6 border-t-2 border-slate-100 print:border-slate-300 text-center text-sm text-slate-400">
                Generated via ANH Reports System
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 print:hidden" onClick={() => setSelectedLog(null)}>
          <div className="relative w-full max-w-lg flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedLog(null)} 
              className="absolute -top-12 right-0 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X size={24} />
            </button>
            
            <img src={selectedLog.photoUrl} alt="Full view" className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-2xl" />
            
            <div className="w-full mt-6 flex flex-col items-center gap-4">
              <button 
                onClick={async (e) => { 
                  e.stopPropagation(); 
                  const text = `*${language === 'en' ? 'Cleaning Log' : 'سجل النظافة'}* 🧹\n*${language === 'en' ? 'Area:' : 'المنطقة:'}* ${language === 'en' ? selectedLog.areaNameEn : selectedLog.areaNameAr}\n*${language === 'en' ? 'Cashier:' : 'الكاشير:'}* ${selectedLog.cashierName}\n*${language === 'en' ? 'Date & Time:' : 'الوقت والتاريخ:'}* ${formatDate(selectedLog.timestamp, selectedLog.localTime)}`;
                  
                  try {
                    if (navigator.share && selectedLog.photoUrl.startsWith('data:')) {
                      const res = await fetch(selectedLog.photoUrl);
                      const blob = await res.blob();
                      const file = new File([blob], 'cleaning_log.jpg', { type: 'image/jpeg' });
                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          text: text,
                          files: [file]
                        });
                        return;
                      }
                    }
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  } catch (err) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(37,211,102,0.3)] active:scale-95 transition-transform text-lg"
              >
                <Share2 size={24} />
                {language === 'en' ? 'Share to WhatsApp' : 'مشاركة عبر واتساب'}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}
