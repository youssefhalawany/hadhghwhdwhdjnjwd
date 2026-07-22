"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, AlertCircle, RefreshCcw } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiAssistantPage() {
  const { currentBranch } = useBranch();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am Ibrahim, your Manager Assistant (مساعد مدير). Ask me anything about your store's performance, or just chat with me normally!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
          branchId: currentBranch
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        if (data.error && data.error.includes("429")) {
          setMessages(prev => [...prev, { role: "assistant", content: "I am receiving too many requests right now because we are on the free tier limit. Please wait about 60 seconds and try asking me again!" }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
          console.error("Chat error:", data.error);
        }
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
    "Summarize yesterday's sales.",
    "Did we sell any Kinder today?",
    "Write an end of week report.",
    "How to handle an angry customer?"
  ];

  return (
    <div className="p-2 sm:p-4 lg:p-6 w-full h-[calc(100vh-6rem)] sm:h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
          <Bot className="h-6 w-6 text-indigo-500" />
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
      <div className="flex-1 glass-panel rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-sm ${msg.role === "user" ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white"}`}>
                {msg.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === "user" ? "bg-emerald-500 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-foreground border border-border rounded-tl-none"}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="shrink-0 h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Bot className="h-5 w-5" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-5 py-3 shadow-sm bg-white dark:bg-slate-800 border border-border rounded-tl-none flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm text-muted-foreground font-medium">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="px-6 pb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Try asking about:</p>
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
              placeholder="Ask me anything..."
              className="w-full bg-white dark:bg-slate-800 border border-border rounded-full pl-6 pr-14 py-3 sm:py-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Send className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" />
            </button>
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
