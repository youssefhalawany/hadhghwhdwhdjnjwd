"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Printer, AlertCircle, CheckCircle2 } from "lucide-react";

export default function PrintServerPage() {
  const [activeJob, setActiveJob] = useState<any>(null);
  const [status, setStatus] = useState("Waiting for print jobs...");
  const [lastPrintedId, setLastPrintedId] = useState<string | null>(null);

  useEffect(() => {
    // Listen for recent pending voids
    const q = query(
      collection(db, "void_requests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Find the first document that hasn't been printed yet
      const unprintedDoc = snapshot.docs.find(d => d.data().printed === false);
      
      if (unprintedDoc && unprintedDoc.id !== lastPrintedId) {
        setStatus(`Incoming job: ${unprintedDoc.id}`);
        setActiveJob({ id: unprintedDoc.id, ...unprintedDoc.data() });
      }
    });

    return () => unsubscribe();
  }, [lastPrintedId]);

  useEffect(() => {
    if (activeJob) {
      const handlePrint = async () => {
        try {
          setStatus(`Printing job: ${activeJob.transactionNumber}`);
          
          // Wait for React to fully render the print layout
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Trigger the print command (bypassed instantly in Kiosk mode)
          window.print();
          
          // Mark as printed in database so it doesn't loop
          setStatus("Updating database...");
          const docRef = doc(db, "void_requests", activeJob.id);
          await updateDoc(docRef, { printed: true });
          
          setLastPrintedId(activeJob.id);
          setActiveJob(null);
          setStatus("Waiting for print jobs...");
        } catch (error: any) {
          console.error("Failed to print/update:", error);
          setStatus(`Error: ${error.message}`);
        }
      };

      handlePrint();
    }
  }, [activeJob]);

  // If no job is active, render the waiting screen
  if (!activeJob) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl border border-slate-700">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-slate-700 rounded-full w-24 h-24 flex items-center justify-center border-4 border-slate-600">
              <Printer className="w-10 h-10 text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black mb-2">Print Daemon Active</h1>
          <p className="text-slate-400 font-medium mb-6">Listening for mobile void requests...</p>
          
          <div className="flex items-center justify-center gap-2 text-sm font-mono bg-slate-900 py-2 px-4 rounded-lg text-emerald-400 border border-emerald-900/50">
            <CheckCircle2 className="w-4 h-4" />
            {status}
          </div>

          <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
            <div className="flex items-start gap-3 text-amber-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">Important Setup</p>
                <p className="text-amber-500/80">Ensure Chrome is running with <code className="bg-amber-500/20 px-1 rounded text-amber-300">--kiosk-printing</code> and the PC never sleeps.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Job Print Layout (Specifically sized for 80mm x 30mm)
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          body { background: #0f172a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          #void-print-area { background: white; padding: 10px; width: 80mm; height: 30mm; overflow: hidden; }
        }
        @media print {
          html, body { 
            height: 100% !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important; 
          }
          body > *:not(#void-print-area) { display: none !important; }
          #void-print-area, #void-print-area * { visibility: visible; display: block !important; }
          #void-print-area { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 80mm !important; 
            height: 30mm !important; 
            overflow: hidden !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box !important;
          }
          @page { size: 80mm 30mm; margin: 0; }
        }
      `}} />

      <div id="void-print-area" className="text-black font-sans relative bg-white">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-black pb-1 mb-1">
          <div>
            <h1 className="text-sm font-black uppercase leading-none tracking-tighter">VOID / إرجاع</h1>
            <p className="text-[8px] font-bold mt-0.5">{new Date(activeJob.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</p>
          </div>
          <div className="text-right">
            <div className="bg-black text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest inline-block mb-0.5">Circle K</div>
          </div>
        </div>

        {/* Details */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase leading-none mb-0.5">TXN #</p>
            <p className="text-xs font-black font-mono leading-none">{activeJob.transactionNumber}</p>
            <p className="text-[8px] font-bold text-gray-500 uppercase mt-1 leading-none">{activeJob.cashierName}</p>
          </div>
          
          <div className="text-right">
            <p className="text-[9px] font-bold text-gray-500 uppercase leading-none mb-0.5">Amount</p>
            <div className="flex items-end gap-1">
              <span className="text-lg font-black leading-none tracking-tighter">{activeJob.amount}</span>
              <span className="text-[8px] font-bold mb-0.5">EGP</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
