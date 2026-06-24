"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { allChecklists, mohamedAhmedChecklist } from "@/lib/checklists-data";

const SectionTitle = ({ title }: { title: string }) => (
  <div className="bg-gray-200 print:bg-gray-200 print:exact-colors text-red-600 font-bold text-center py-1 border-x border-t border-black text-xs">
    {title}
  </div>
);

import useSWR from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Checklist not found");
  return res.json();
};

export default function PrintChecklistPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isBlank = id.startsWith("blank-");
  
  const { data, error, isLoading } = useSWR(
    !isBlank && id ? `/api/checklists/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false, // Save Firebase reads!
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const baseChecklistId = isBlank ? id.replace("blank-", "") : data?.checklistId;
  const checklistSchema = allChecklists.find(c => c.id === baseChecklistId);
  const loading = !isBlank && isLoading;

  useEffect(() => {
    if (error) {
      alert("Checklist not found or permission denied");
    }
  }, [error]);

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  const getAnswerScore = (itemId: string, maxScore: number) => {
    if (isBlank || !data) return { yes: "", no: "", score: "" };
    const ans = data.answers?.[itemId];
    if (ans === "yes") return { yes: "✓", no: "", score: maxScore };
    if (ans === "no") return { yes: "", no: "✓", score: 0 };
    return { yes: "", no: "", score: "" };
  };

  const getShiftText = () => {
    if (isBlank || !data?.createdAt) return "";
    const hour = new Date(data.createdAt).getHours();
    return hour >= 12 ? "صباحي" : "ليلي";
  };

  const renderCategory = (categoryId: string) => {
    if (!checklistSchema) return null;
    const cat = checklistSchema.categories.find(c => c.id === categoryId);
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

  const getFoodShiftColumn = () => {
    if (isBlank || !data?.createdAt) return "";
    const hour = new Date(data.createdAt).getHours();
    if (hour >= 8 && hour < 16) return "morning";
    if (hour >= 16 && hour <= 23) return "evening";
    return "night";
  };

  const renderFoodDeptLayout = () => {
    if (!checklistSchema) return null;
    const shift = getFoodShiftColumn();
    
    return (
      <div className="pdf-section mb-2 bg-white">
        <table className="w-full border-collapse border border-black text-[10px] text-center">
          <thead>
            <tr className="bg-yellow-300 print:bg-yellow-300 print:exact-colors">
              <th className="border border-black p-1 w-8">م</th>
              <th className="border border-black p-1 text-right">موظفي الفود</th>
              <th className="border border-black p-1 w-16">صباحا</th>
              <th className="border border-black p-1 w-16">مساءا</th>
              <th className="border border-black p-1 w-16">ليلا</th>
              <th className="border border-black p-1 w-40">ملاحظات</th>
            </tr>
          </thead>
            {checklistSchema.categories.map(cat => (
              <tbody key={cat.id}>
                {/* Category Header Row */}
                <tr className="bg-gray-200 print:bg-gray-200 print:exact-colors font-bold">
                  <td className="border border-black p-1 text-right pr-4" colSpan={6}>{cat.title}</td>
                </tr>
                {cat.items.map((item, idx) => {
                  const ans = isBlank ? null : data?.answers?.[item.id];
                  const isYes = ans === "yes";
                  return (
                    <tr key={item.id}>
                      <td className="border border-black p-1 font-bold">{idx + 1}</td>
                      <td className="border border-black p-1 text-right">{item.text}</td>
                      <td className="border border-black p-1 font-bold text-green-600 text-lg">{!isBlank && shift === "morning" && isYes ? "✓" : ""}</td>
                      <td className="border border-black p-1 font-bold text-green-600 text-lg">{!isBlank && shift === "evening" && isYes ? "✓" : ""}</td>
                      <td className="border border-black p-1 font-bold text-green-600 text-lg">{!isBlank && shift === "night" && isYes ? "✓" : ""}</td>
                      <td className="border border-black p-1"></td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
        </table>
      </div>
    );
  };

  const renderTemperatureLayout = () => {
    if (!checklistSchema) return null;
    const cat = checklistSchema.categories[0];
    const temps = ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM", "12:00 AM", "2:00 AM", "4:00 AM", "6:00 AM"];
    return (
      <div className="pdf-section mb-2 bg-white break-inside-avoid">
        <table className="w-full border-collapse border border-black text-[10px] text-center">
          <thead>
            <tr className="bg-yellow-300 print:bg-yellow-300 print:exact-colors">
              <th className="border border-black p-1 w-6">م</th>
              <th className="border border-black p-1">الاسم</th>
              {temps.map(t => <th key={t} className="border border-black p-1 whitespace-nowrap">{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {cat.items.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-black p-1 font-bold">{idx + 1}</td>
                <td className="border border-black p-1 text-right">{item.text}</td>
                {temps.map(t => (
                  <td key={t} className="border border-black p-1 font-bold">
                    {isBlank ? "" : data?.answers?.[item.id]?.[t] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCleaningLayout = () => {
    if (!checklistSchema) return null;
    const hours = ["7-8 AM", "8-9 AM", "9-10 AM", "10-11 AM", "11-12 PM", "12-1 PM", "1-2 PM", "2-3 PM", "3-4 PM", "4-5 PM", "5-6 PM", "6-7 PM", "7-8 PM", "8-9 PM", "9-10 PM", "10-11 PM", "11-12 AM", "12-1 AM", "1-2 AM", "2-3 AM", "3-4 AM", "4-5 AM", "5-6 AM", "6-7 AM"];
    return (
      <div className="pdf-section mb-2 bg-white break-inside-avoid">
        <table className="w-full border-collapse border border-black text-[8px] text-center">
          <thead>
            <tr className="bg-yellow-300 print:bg-yellow-300 print:exact-colors">
              <th className="border border-black p-1 text-right min-w-[120px]">التوقيت</th>
              {hours.map(h => (
                <th key={h} className="border border-black p-0.5 whitespace-nowrap" style={{writingMode: "vertical-rl", transform: "rotate(180deg)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          {checklistSchema.categories.map(cat => (
            <tbody key={cat.id}>
              <tr className="bg-gray-200 print:bg-gray-200 print:exact-colors font-bold">
                <td className="border border-black p-1 text-right pr-4" colSpan={hours.length + 1}>{cat.title}</td>
              </tr>
              {cat.items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black p-1 text-right leading-tight">{item.text}</td>
                  {hours.map(h => (
                    <td key={h} className="border border-black p-0.5 font-bold text-green-600 text-sm">
                      {isBlank ? "" : (data?.answers?.[item.id]?.[h] ? "✓" : "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white flex justify-center py-8 print:py-0">
      
      {/* Floating action buttons for web view */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <button onClick={handlePrint} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg">
          طباعة القائمة
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
        <style>{`
          @media print {
            .pdf-section {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            @page {
              margin: 10mm;
            }
          }
        `}</style>
        <div className="p-4 print:p-0">
          
          {/* Header */}
          <div className="pdf-section border border-black mb-2 bg-white">
            <div className="flex justify-between items-center p-2 border-b border-black">
              <div className="text-red-600 font-black text-2xl tracking-tighter">CIRCLE K</div>
              <div className="text-red-600 font-bold text-sm underline underline-offset-4">قائمة التفتيش على المتاجر(Check List)</div>
              <div className="w-24"></div> {/* Spacer to center the title */}
            </div>
            
            {/* Metadata Row */}
            {!isBlank && data && (
              <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-black text-xs font-bold">
                <div>القائمة: <span className="text-red-600">{data.checklistTitle || checklistSchema?.title}</span></div>
                <div>الكاشير: <span className="text-red-600">{data.cashierName}</span></div>
                <div>التاريخ: <span className="text-red-600">{new Date(data.createdAt).toLocaleString('en-GB')}</span></div>
                <div>النتيجة: <span className="text-red-600">{data.score} / {data.totalScore}</span></div>
              </div>
            )}

            <div className="flex">
              <div className="flex-1 flex flex-col">
                <div className="border-b border-black p-1 text-xs">
                  <span className="font-bold">الشيفت :</span> {getShiftText()}
                </div>
                <div className="flex text-xs">
                  <div className="flex-1 p-1 border-l border-black"><span className="font-bold">الفرع :</span> العلمين 4</div>
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

          {/* Dynamic Content */}
          {checklistSchema?.id === "mohamed-ahmed-checklist" ? (
            <>
              {/* Section 1: External */}
              <div className="pdf-section mb-2 bg-white">
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
              </div>

              {/* Section 2: Internal */}
              <div className="pdf-section mb-2 bg-white">
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
              </div>

              {/* Section 3: Operating & Customers */}
              <div className="pdf-section mb-2 bg-white">
                <div className="grid grid-cols-2 border-x border-b border-t border-black">
                  <div className="border-l border-black p-1">
                    {renderCategory("operating_files")}
                  </div>
                  <div className="p-1">
                    {renderCategory("customer_service")}
                  </div>
                </div>
              </div>

              {/* Section 4: Fridges & Office */}
              <div className="pdf-section mb-2 bg-white">
                 <div className="grid grid-cols-2 border-x border-t border-b border-black">
                  <div className="border-l border-black p-1">
                    {renderCategory("fridges_freezers")}
                  </div>
                  <div className="p-1">
                    {renderCategory("cupboards_office")}
                  </div>
                 </div>
              </div>
                 
              {/* Section 5: Drinks & Fast Food */}
              <div className="pdf-section mb-2 bg-white">
                 <div className="grid grid-cols-2 border-x border-t border-b border-black">
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
            </>
          ) : checklistSchema?.id === "food-dept-checklist" ? (
            renderFoodDeptLayout()
          ) : checklistSchema?.id === "temperature-checklist" ? (
            renderTemperatureLayout()
          ) : checklistSchema?.id === "cleaning-checklist" ? (
            renderCleaningLayout()
          ) : (
            <>
              {/* Fallback Generic 2-Column Layout */}
              <div className="pdf-section mb-2 bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 border-x border-t border-b border-black print:grid-cols-2">
                  <div className="border-b md:border-b-0 md:border-l border-black p-1 print:border-b-0 print:border-l">
                    {checklistSchema?.categories.slice(0, Math.ceil(checklistSchema.categories.length / 2)).map(c => (
                      <div key={c.id}>{renderCategory(c.id)}</div>
                    ))}
                  </div>
                  <div className="p-1">
                    {checklistSchema?.categories.slice(Math.ceil(checklistSchema.categories.length / 2)).map(c => (
                      <div key={c.id}>{renderCategory(c.id)}</div>
                    ))}
                  </div>
                 </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
