"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, Clock, AlertTriangle } from "lucide-react";
import { allChecklists } from "@/lib/checklists-data";
import { PageWrapper } from "@/components/PageWrapper";
import { CashierBottomNav } from "@/components/CashierBottomNav";

export default function CashierChecklistsList() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("ar");

  const availableChecklists = allChecklists;

  return (
    <>
    <PageWrapper className="bg-background text-foreground pb-28" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="glass-header p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => router.push('/cashier')}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer text-slate-500 dark:text-slate-200"
            >
              <ChevronLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 dark:text-white leading-none">
                {lang === "ar" ? "قوائم المراجعة (Checklists)" : "Checklists"}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                {lang === "ar" ? "اختر القائمة للبدء" : "Select a checklist to begin"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableChecklists.map(checklist => (
            <div 
              key={checklist.id}
              onClick={() => router.push(`/checklists/cashier/${checklist.id}`)}
              className="glass-panel p-5 rounded-2xl cursor-pointer hover:border-red-400 transition-all group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                  {checklist.totalScore} Points
                </div>
              </div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                {checklist.title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
                {lang === "ar" ? "يجب ملء هذه القائمة بانتظام وتسليمها لمدير الفرع." : "Must be filled regularly and submitted to the branch manager."}
              </p>
            </div>
          ))}
        </div>
      </main>
    </PageWrapper>
    <CashierBottomNav lang={lang} />
    </>
  );
}
