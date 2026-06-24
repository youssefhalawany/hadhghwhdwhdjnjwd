"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Printer, Search } from "lucide-react";
import { ChevronLeft, ClipboardCheck, Printer, Search } from "lucide-react";

export default function ManagerChecklistsPage() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChecklists() {
      try {
        const res = await fetch("/api/checklists");
        const data = await res.json();
        if (data.checklists) {
          setChecklists(data.checklists);
        }
      } catch (err) {
        console.error("Error fetching checklists", err);
      } finally {
        setLoading(false);
      }
    }
    fetchChecklists();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      <header className="bg-white shadow-sm border-b border-slate-200 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/admin')}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">قوائم المراجعة المكتملة</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">Audited Checklists</p>
            </div>
          </div>
          
          <button 
            onClick={() => router.push('/checklists/manager/print/blank-mohamed-ahmed')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
          >
            <Printer className="h-4 w-4" />
            طباعة نموذج فارغ
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-red-500" /> 
              السجلات الأخيرة
            </h2>
            <div className="relative">
              <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="بحث..." 
                className="pl-4 pr-9 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-red-400 w-48"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">اسم القائمة</th>
                  <th className="px-4 py-3">الكاشير</th>
                  <th className="px-4 py-3">النتيجة</th>
                  <th className="px-4 py-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                ) : checklists.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد قوائم مكتملة بعد</td></tr>
                ) : checklists.map(cl => (
                  <tr key={cl.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(cl.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{cl.checklistTitle}</td>
                    <td className="px-4 py-3">{cl.cashierName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        (cl.score / cl.totalScore) > 0.8 ? "bg-green-100 text-green-700" :
                        (cl.score / cl.totalScore) > 0.5 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {cl.score} / {cl.totalScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => router.push(`/checklists/manager/print/${cl.id}`)}
                        className="text-red-600 hover:text-red-800 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 inline-flex"
                      >
                        <Printer className="h-3.5 w-3.5" /> عرض وطباعة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
