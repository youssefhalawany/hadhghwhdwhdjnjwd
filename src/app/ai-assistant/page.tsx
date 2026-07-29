"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, AlertCircle, RefreshCcw, Volume2, Square, Mic, MicOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useBranch } from "@/context/BranchContext";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiAssistantPage() {
  const { currentBranch } = useBranch();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "صباح الفل يا ريس! أنا إبراهيم، الدراع اليمين بتاعك في الفرع. جاهز أظبطلك الدنيا وأجيبلك الخلاصة في المبيعات، اسألني براحتك!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [loadingAudioIdx, setLoadingAudioIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-EG';
        recognition.continuous = false;
        recognition.interimResults = true;
        
        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
             currentTranscript += event.results[i][0].transcript;
          }
          setInput(currentTranscript);
        };
        
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (e: any) => {
          console.error(e);
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      toast.error("Your browser does not support voice input.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput("");
      recognitionRef.current.start();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const safeBal = localStorage.getItem(`cached_safe_balance_${currentBranch}`);
      const bankBal = localStorage.getItem(`cached_bank_balance_${currentBranch}`);
      
      const cachedBalances = {
        safe: safeBal,
        bank: bankBal,
        cashPayments: localStorage.getItem(`cached_total_cash_payments_${currentBranch}`),
        bankPayments: localStorage.getItem(`cached_total_bank_payments_${currentBranch}`),
        creditsCollected: localStorage.getItem(`cached_total_credits_collected_${currentBranch}`),
        payrollsAndLoans: localStorage.getItem(`cached_total_payrolls_loans_${currentBranch}`),
        depositsOutSafe: localStorage.getItem(`cached_deposits_out_safe_${currentBranch}`),
        depositsInSafe: localStorage.getItem(`cached_deposits_in_safe_${currentBranch}`),
        depositsOutBank: localStorage.getItem(`cached_deposits_out_bank_${currentBranch}`),
        depositsInBank: localStorage.getItem(`cached_deposits_in_bank_${currentBranch}`),
        detailedPayments: localStorage.getItem('cached_detailed_payments'),
        detailedDeposits: localStorage.getItem('cached_detailed_deposits'),
        detailedCredits: localStorage.getItem('cached_detailed_credits'),
      };

      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
          branchId: currentBranch,
          cachedBalances: cachedBalances
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        const fallbackMsg = "يا ريس السيرفر عليه ضغط بسيط دلوقتي من السيستم، بس أنا معاك! جرب تسألني تاني كمان ثواني وهرد عليك فوراً يا باشا 🫡";
        setMessages(prev => [...prev, { role: "assistant", content: fallbackMsg }]);
        console.error("Chat error:", data.error);
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered a network error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const QUICK_PROMPTS = [
    "لخصلي مبيعات امبارح",
    "تتوقع مبيعات بكرة كام؟",
    "إيه الأخبار في شيفتات امبارح؟",
    "عندنا حاجة هتنتهي صلاحيتها الأسبوع ده؟"
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 sm:p-6 shrink-0 border-b border-border bg-card/50 backdrop-blur-sm z-10">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden border border-indigo-500/20 shadow-sm">
          <img src="/ibrahim.jpg" alt="Ibrahim" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Ibrahim <Sparkles className="h-5 w-5 text-indigo-500" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your Manager Assistant (مساعد مدير).
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-sm overflow-hidden ${msg.role === "user" ? "bg-emerald-500 text-white" : "bg-indigo-600 border border-indigo-500/20"}`}>
                {msg.role === "user" ? <User className="h-5 w-5" /> : <img src="/ibrahim.jpg" alt="Ibrahim" className="h-full w-full object-cover" />}
              </div>

              <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === "user" ? "bg-emerald-500 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-foreground border border-border rounded-tl-none relative group"}`}>
                {msg.role === "assistant" && (
                  <button 
                    onClick={async () => {
                      if (speakingIdx === index && audioRef.current) {
                        audioRef.current.pause();
                        setSpeakingIdx(null);
                        return;
                      }
                      
                      if (audioRef.current) {
                        audioRef.current.pause();
                        setSpeakingIdx(null);
                      }
                      
                      try {
                        setLoadingAudioIdx(index);
                        const cleanText = msg.content.replace(/\\*\\*/g, '').replace(/#/g, '').replace(/\\[CHART\\].*/g, 'في رسم بياني معروض قدامك يا ريس');
                        
                        const res = await fetch("/api/tts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text: cleanText })
                        });
                        
                        if (!res.ok) throw new Error("TTS Failed");
                        
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        
                        const audio = new Audio(url);
                        audioRef.current = audio;
                        audio.onended = () => {
                          setSpeakingIdx(null);
                        };
                        
                        setLoadingAudioIdx(null);
                        setSpeakingIdx(index);
                        audio.play();
                      } catch (err) {
                        console.error(err);
                        setLoadingAudioIdx(null);
                        setSpeakingIdx(null);
                        toast.error("فشل تشغيل الصوت");
                      }
                    }}
                    className="absolute -left-10 top-2 p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-200"
                    title="اسمع بصوت إبراهيم"
                    disabled={loadingAudioIdx === index}
                  >
                    {loadingAudioIdx === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : speakingIdx === index ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                )}
                {msg.content.trim().startsWith("[CHART]") ? (
                  <div className="w-full mt-2 min-w-[280px] sm:min-w-[400px]" dir="ltr">
                    {(() => {
                      try {
                        const jsonStr = msg.content.replace("[CHART]", "").trim();
                        const chartObj = JSON.parse(jsonStr);
                        return (
                          <>
                            {chartObj.title && <h4 className="font-bold mb-4 text-center">{chartObj.title}</h4>}
                            <div className="h-64 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartObj.data}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                  <XAxis dataKey="name" fontSize={12} />
                                  <YAxis fontSize={12} />
                                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </>
                        );
                      } catch (e) {
                        return <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>;
                      }
                    })()}
                  </div>
                ) : (
                  <div 
                    className="whitespace-pre-wrap text-sm leading-relaxed" 
                    dir={/[\u0600-\u06FF]/.test(msg.content) ? 'rtl' : 'ltr'}
                    dangerouslySetInnerHTML={{ 
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
                        .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-4 list-decimal">$1. $2</li>') 
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="shrink-0 h-10 w-10 rounded-full bg-indigo-600 border border-indigo-500/20 flex items-center justify-center shadow-sm overflow-hidden">
                <img src="/ibrahim.jpg" alt="Ibrahim" className="h-full w-full object-cover" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-5 py-3 shadow-sm bg-white dark:bg-slate-800 border border-border rounded-tl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm text-muted-foreground font-medium">بفكر...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="px-6 pb-2" dir="rtl">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">ممكن تسأل عن:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-full text-xs font-semibold transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Box */}
        <div className="p-4 bg-white/50 dark:bg-slate-900/50 border-t border-border backdrop-blur-md">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              dir="auto"
              placeholder={isListening ? "بِسمعك يا ريس..." : "اسألني أي حاجة..."}
              className={`w-full bg-white dark:bg-slate-800 border ${isListening ? 'border-red-500 ring-1 ring-red-500' : 'border-border'} rounded-full pl-6 pr-24 py-3 sm:py-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm`}
              disabled={isLoading}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={toggleListen}
                disabled={isLoading}
                className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                title="Voice Input"
              >
                {isListening ? <Mic className="h-4 w-4 sm:h-5 sm:w-5" /> : <MicOff className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 sm:h-10 sm:w-10 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors shadow-sm"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" />
              </button>
            </div>
          </div>
          <div className="mt-2 text-center">
             <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
               <AlertCircle className="h-3 w-3" /> AI can make mistakes. Verify important information.
             </p>
          </div>
        </div>

      </div>
    </div>
  );
}
