"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Printer, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { useBranch } from "@/context/BranchContext";
import { productsDb } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useState, useEffect } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ManagerChecklistsPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  
  const { data, error, isLoading: apiLoading } = useSWR("/api/checklists", fetcher, {
    revalidateOnFocus: false, // Save Firebase reads!
    dedupingInterval: 60000, // Cache for 1 minute
  });

  const [productChecklists, setProductChecklists] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchProductChecklists = async () => {
      try {
        const q = query(collection(productsDb, "audited_checklists"), orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProductChecklists(docs);
      } catch (err) {
        console.error("Failed to fetch products db checklists", err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProductChecklists();
  }, []);

  const loading = apiLoading || loadingProducts;

  let allChecklistsCombined = [...(data?.checklists || []), ...productChecklists];
  allChecklistsCombined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let checklists: any[] = allChecklistsCombined;
  if (currentBranch !== "all") {
    checklists = checklists.filter(cl => {
      if (cl.branchId) return cl.branchId === currentBranch;
      const storeStr = (cl.storeId || cl.cashierDetails?.storeId || "").toLowerCase();
      const inferredBranch = storeStr.includes("ola") || storeStr.includes("koronfol") ? "ola" : "alamein4";
      return inferredBranch === currentBranch;
    });
  }

  return (
    <PageWrapper className="bg-background text-foreground" dir="rtl">
      <header className="glass-header p-4">
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
          
          <select 
            onChange={(e) => {
              if (e.target.value) {
                router.push(`/checklists/manager/print/blank-${e.target.value}`);
                e.target.value = "";
              }
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all outline-none cursor-pointer appearance-none text-center"
          >
            <option value="">🖨️ طباعة نموذج فارغ...</option>
            <option value="mohamed-ahmed-checklist">قائمة التفتيش على المتاجر</option>
            <option value="food-dept-checklist">قائمة المتابعة اليومية لاداء قسم الفود</option>
            <option value="temperature-checklist">تشيك ليست درجات الحرارة</option>
            <option value="cleaning-checklist">نموذج متابعة نظافة الفرع</option>
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap gap-4 items-center justify-between bg-card/50">
            <h2 className="font-bold text-foreground flex items-center gap-2">
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
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-8 w-24 mx-auto" /></td>
                    </tr>
                  ))
                ) : checklists.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد قوائم مكتملة بعد</td></tr>
                ) : checklists.map((cl, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={cl.id} 
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {new Date(cl.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{cl.checklistTitle}</td>
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
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </PageWrapper>
  );
}
