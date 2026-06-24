"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Save, AlertTriangle } from "lucide-react";
import { allChecklists } from "@/lib/checklists-data";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export default function ChecklistFillPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [lang, setLang] = useState<"en" | "ar">("ar");
  const [cashierName, setCashierName] = useState("");
  const [loading, setLoading] = useState(false);

  // We map answers by item.id to values
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const checklist = allChecklists.find(c => c.id === id) || null;

  useEffect(() => {
    const savedUserStr = localStorage.getItem("active_cashier_session");
    if (savedUserStr) {
      try {
        const user = JSON.parse(savedUserStr);
        if (user && user.name) {
          setCashierName(user.name);
        }
      } catch (e) {
        console.error("Invalid session");
      }
    }
  }, []);

  if (!checklist) {
    return <div className="p-8 text-center text-red-500 font-bold">Checklist not found.</div>;
  }

  const handleAnswer = (itemId: string, answer: "yes" | "no") => {
    setAnswers(prev => ({ ...prev, [itemId]: answer }));
  };

  const handleGridAnswer = (itemId: string, key: string, value: string | boolean) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [key]: value
      }
    }));
  };

  const calculateScore = () => {
    let score = 0;
    checklist.categories.forEach(cat => {
      cat.items.forEach(item => {
        const ans = answers[item.id];
        if (checklist.type === "temperature_grid" || checklist.type === "hourly_cleaning") {
          if (ans && Object.values(ans).some(val => val !== "" && val !== false)) {
            score += item.score;
          }
        } else {
          if (ans === "yes") {
            score += item.score;
          }
        }
      });
    });
    return score;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all answered
    let unanswered = 0;
    checklist.categories.forEach(cat => {
      cat.items.forEach(item => {
        const ans = answers[item.id];
        if (checklist.type === "temperature_grid" || checklist.type === "hourly_cleaning") {
           // For grids, at least one cell in the row must be filled
           if (!ans || !Object.values(ans).some(val => val !== "" && val !== false)) {
             unanswered++;
           }
        } else {
           if (!ans) unanswered++;
        }
      });
    });

    if (unanswered > 0) {
      alert(`Please answer all questions. (${unanswered} remaining)`);
      return;
    }

    setLoading(true);
    try {
      const finalScore = calculateScore();
      const payload = {
        checklistId: checklist.id,
        checklistTitle: checklist.title,
        cashierName: cashierName || "Unknown Cashier",
        answers,
        score: finalScore,
        totalScore: checklist.totalScore,
        status: "completed",
        createdAt: new Date().toISOString()
      };

      const response = await fetch('/api/submit-checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit checklist to server");
      }

      toast.success("تم إرسال قائمة المراجعة بنجاح!");
      router.push("/checklists/cashier");
    } catch (err: any) {
      console.error(err);
      toast.error("Error submitting: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 pb-28" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-750 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => router.push('/checklists/cashier')}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer text-slate-500 dark:text-slate-200"
            >
              <ChevronLeft className={`h-5 w-5 ${lang === "ar" ? "rotate-180" : ""}`} />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-800 dark:text-white leading-none">
                {checklist.title}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                Cashier: {cashierName}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {checklist.categories.map((category) => (
            <div key={category.id} className="glass-panel rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-200/50 dark:bg-slate-800 p-3 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">{category.title}</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {category.items.map((item) => {
                  const renderInput = (item: any) => {
                    if (checklist.type === "temperature_grid") {
                      const temps = ["6:00 AM", "8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM", "12:00 AM", "2:00 AM", "4:00 AM"];
                      return (
                        <div className="flex flex-wrap gap-2 w-full mt-2">
                          {temps.map(t => (
                            <div key={t} className="flex flex-col items-center border border-slate-300 dark:border-slate-700 rounded p-1 w-16 bg-white dark:bg-slate-900">
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">{t}</span>
                              <input 
                                type="text" 
                                className="w-full text-center text-sm outline-none bg-transparent dark:text-white"
                                value={answers[item.id]?.[t] || ""}
                                onChange={(e) => handleGridAnswer(item.id, t, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (checklist.type === "hourly_cleaning") {
                      const hours = ["7-8 AM", "8-9 AM", "9-10 AM", "10-11 AM", "11-12 PM", "12-1 PM", "1-2 PM", "2-3 PM", "3-4 PM", "4-5 PM", "5-6 PM", "6-7 PM", "7-8 PM", "8-9 PM", "9-10 PM", "10-11 PM", "11-12 AM", "12-1 AM", "1-2 AM", "2-3 AM", "3-4 AM", "4-5 AM", "5-6 AM", "6-7 AM"];
                      return (
                        <div className="flex flex-wrap gap-2 w-full mt-2">
                          {hours.map(h => (
                            <label key={h} className="flex flex-col items-center border border-slate-300 dark:border-slate-700 rounded p-1 w-16 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900">
                              <span className="text-[10px] text-slate-500 text-center leading-tight">{h}</span>
                              <input 
                                type="checkbox" 
                                className="mt-1 w-4 h-4"
                                checked={!!answers[item.id]?.[h]}
                                onChange={(e) => handleGridAnswer(item.id, h, e.target.checked)}
                              />
                            </label>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => handleAnswer(item.id, "yes")}
                          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold border transition-all ${
                            answers[item.id] === "yes" 
                              ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20" 
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-green-300"
                          }`}
                        >
                          نعم (Yes)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswer(item.id, "no")}
                          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold border transition-all ${
                            answers[item.id] === "no" 
                              ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20" 
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-300"
                          }`}
                        >
                          لا (No)
                        </button>
                      </div>
                    );
                  };

                  return (
                    <div key={item.id} className={`p-4 flex flex-col ${checklist.type === 'yes_no' || checklist.type === 'food_dept' ? 'sm:flex-row sm:items-center' : ''} gap-4 justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors`}>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 leading-relaxed">
                        {item.text} <span className="text-slate-400 text-[10px] ml-2">({item.score} pts)</span>
                      </p>
                      <div className="w-full sm:w-auto">
                        {renderInput(item)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sticky Footer */}
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Score: <span className="text-red-600 dark:text-red-400 text-lg">{calculateScore()}</span> / {checklist.totalScore}
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className={`px-8 py-3.5 ${loading ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98] cursor-pointer'} text-white rounded-xl font-bold shadow-lg shadow-red-500/15 transition-all flex items-center justify-center gap-2`}
              >
                {loading ? "Submitting..." : (
                  <>
                    <Save className="h-5 w-5" /> Submit Checklist
                  </>
                )}
              </button>
            </div>
          </footer>

        </form>
      </main>
    </div>
  );
}
