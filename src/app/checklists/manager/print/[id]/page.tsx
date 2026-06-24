"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mohamedAhmedChecklist } from "@/lib/checklists-data";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const SectionTitle = ({ title }: { title: string }) => (
  <div className="bg-gray-200 print:bg-gray-200 print:exact-colors text-red-600 font-bold text-center py-1 border-x border-t border-black text-xs">
    {title}
  </div>
);

export default function PrintChecklistPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isBlank = id === "blank-mohamed-ahmed";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!isBlank);

  useEffect(() => {
    if (isBlank || !id) return;
    async function fetchData() {
      try {
        const docRef = doc(db, "audited_checklists", id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setData(snapshot.data());
        } else {
          alert("Checklist not found");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, isBlank]);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  const getAnswerScore = (itemId: string, maxScore: number) => {
    if (isBlank || !data) return { yes: "", no: "", score: "" };
    const ans = data.answers?.[itemId];
    if (ans === "yes") return { yes: "✓", no: "", score: maxScore };
    if (ans === "no") return { yes: "", no: "✓", score: 0 };
    return { yes: "", no: "", score: "" };
  };

  // Helper to render a category table
  const renderCategory = (categoryId: string) => {
    const cat = mohamedAhmedChecklist.categories.find(c => c.id === categoryId);
    if (!cat) return null;

    let catTotalScore = 0;
    cat.items.forEach(item => {
      const ans = getAnswerScore(item.id, item.score);
      if (typeof ans.score === 'number') catTotalScore += ans.score;
    });

    return (
      <div className="mb-2 break-inside-avoid">
        <table className="w-full border-collapse border border-black text-[10px] text-right">
          <thead>
            <tr className="bg-yellow-300 print:bg-yellow-300 print:exact-colors">
              <th className="border border-black p-1 font-bold text-center w-full" colSpan={2}>{cat.title}</th>
              <th className="border border-black p-1 text-center w-8">نعم</th>
              <th className="border border-black p-1 text-center w-8">لا</th>
              <th className="border border-black p-1 text-center w-10">الدرجة</th>
            </tr>
          </thead>
          <tbody>
            {cat.items.map((item, idx) => {
              const ans = getAnswerScore(item.id, item.score);
              return (
                <tr key={item.id}>
                  <td className="border border-black p-1 text-center w-4 font-bold">{idx + 1}</td>
                  <td className="border border-black p-1 leading-tight">{item.text}</td>
                  <td className="border border-black p-1 text-center font-bold">{ans.yes}</td>
                  <td className="border border-black p-1 text-center font-bold">{ans.no}</td>
                  <td className="border border-black p-1 text-center font-bold bg-yellow-100 print:bg-yellow-100 print:exact-colors">{isBlank ? item.score : ans.score}</td>
                </tr>
              );
            })}
            {/* Category Total Row */}
            <tr className="bg-yellow-300 print:bg-yellow-300 print:exact-colors font-bold">
              <td className="border border-black p-1 text-center" colSpan={4}>الإجمالي</td>
              <td className="border border-black p-1 text-center">
                {isBlank ? cat.items.reduce((sum, item) => sum + item.score, 0) : catTotalScore}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("printable-checklist");
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`checklist-${id}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Failed to generate PDF. You can try the browser print function instead.");
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white flex justify-center py-8 print:py-0">
      
      {/* Floating action buttons for web view */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <button onClick={handleDownloadPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg">
          تحميل PDF / طباعة
        </button>
        <button onClick={() => router.back()} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-lg">
          رجوع
        </button>
      </div>

      {/* A4 Page Container */}
      <div 
        id="printable-checklist"
        className="bg-white w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:h-full"
        dir="rtl"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        <div className="p-4 print:p-0">
          
          {/* Header */}
          <div className="border border-black mb-2">
            <div className="flex justify-between items-center p-2 border-b border-black">
              <div className="text-red-600 font-black text-2xl tracking-tighter">CIRCLE K</div>
              <div className="text-red-600 font-bold text-sm underline underline-offset-4">قائمة التفتيش على المتاجر(Check List)</div>
              <div className="w-24"></div> {/* Spacer to center the title */}
            </div>
            <div className="flex">
              <div className="flex-1 flex flex-col">
                <div className="border-b border-black p-1 text-xs">
                  <span className="font-bold">الشيفت :</span> 
                </div>
                <div className="flex text-xs">
                  <div className="flex-1 p-1 border-l border-black"><span className="font-bold">الفرع :</span> الفردوس</div>
                  <div className="flex-1 p-1 border-l border-black"><span className="font-bold">مدير الفرع :</span> أ /محمد يحيى</div>
                  <div className="flex-1 p-1"><span className="font-bold">مدير المنطقة :</span> أ / عمرو نجاح</div>
                </div>
              </div>
              <div className="w-32 border-r border-black flex flex-col">
                <div className="border-b border-black p-1 text-xs font-bold text-center bg-gray-100 print:bg-gray-100">المجموع %</div>
                <div className="flex-1 p-1 text-center font-bold text-xl flex items-center justify-center">
                  {isBlank ? "" : data?.score}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: External */}
          <SectionTitle title="الفرع من الخارج" />
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-l border-black p-1">
              {renderCategory("external_building")}
              {renderCategory("lighting_facade")}
            </div>
            <div className="p-1">
              {renderCategory("gardens_external")}
              {renderCategory("trash_bins")}
            </div>
          </div>

          {/* Section 2: Internal */}
          <SectionTitle title="الفرع من الداخل" />
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-l border-black p-1">
              {renderCategory("internal_branch")}
            </div>
            <div className="p-1">
              {renderCategory("restrooms")}
              {renderCategory("retail_gondolas")}
              {renderCategory("seating_areas")}
            </div>
          </div>

          {/* Section 3: Operating & Customers */}
          <div className="grid grid-cols-2 border-x border-b border-black">
            <div className="border-l border-black p-1">
              {renderCategory("operating_files")}
            </div>
            <div className="p-1">
              {renderCategory("customer_service")}
            </div>
          </div>

          {/* Section 4: Fridges & Office (Page 2 conceptually, but we let it flow) */}
          <div className="mt-4">
             {/* Note: In original PDF this was page 2, we just render them below */}
             <div className="grid grid-cols-2 border-x border-t border-black">
              <div className="border-l border-black p-1 border-b">
                {renderCategory("fridges_freezers")}
              </div>
              <div className="p-1 border-b border-black">
                {renderCategory("cupboards_office")}
              </div>
             </div>
             
             <div className="grid grid-cols-2 border-x border-b border-black">
              <div className="border-l border-black p-1">
                {renderCategory("drinks_equipment")}
                {renderCategory("sales_transaction")}
              </div>
              <div className="p-1">
                {renderCategory("fast_food_equipment")}
                {renderCategory("store_staff")}
              </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
