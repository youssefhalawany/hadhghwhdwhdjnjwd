"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Shield, UploadCloud, ChevronLeft, AlertTriangle, User as UserIcon } from "lucide-react";

const SignaturePad = ({ onSave, onClear, dict }: { onSave: (data: string) => void, onClear: () => void, dict: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onClear();
    }
  };

  return (
    <div className="space-y-2">
      <div className="border border-border rounded-xl overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[150px] sm:h-[200px] cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button type="button" onClick={clear} className="text-xs text-red-500 font-bold uppercase hover:underline">
        {dict.clearSignature || "Clear Signature"}
      </button>
    </div>
  );
};

export default function CashierVoidPage() {
  const router = useRouter();
  
  const [transactionNumber, setTransactionNumber] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [register, setRegister] = useState("Cash 1");
  const [cashierSignature, setCashierSignature] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Save Document to Firestore
      const payload = {
        transactionNumber,
        cashierName,
        customerName,
        customerPhone,
        amount: Number(amount),
        reason,
        register,
        cashierSignature,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "void_requests"), payload);
      
      router.push("/voids/cashier/success");
    } catch (error: any) {
      console.error("Error submitting void request:", error);
      alert("Failed to submit request: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground max-w-md mx-auto shadow-2xl relative">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800">
        <button 
          onClick={() => router.push('/shift-reports/cashier')}
          className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">Return / Void Request</h1>
          <p className="text-xs text-slate-400 font-semibold">Store Returns Policy</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 text-amber-900 font-bold mb-1">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">Important</p>
          </div>
          <p className="text-xs text-amber-800 font-medium">Please fill out all details accurately. <strong>You MUST keep the physical receipt and hand it to the manager.</strong></p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Transaction Number</label>
            <input 
              type="text" 
              required
              value={transactionNumber}
              onChange={(e) => setTransactionNumber(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 text-lg font-mono"
              placeholder="e.g. TXN-98273"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Cashier Name</label>
            <input 
              type="text" 
              required
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 font-bold"
              placeholder="Your full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Register</label>
              <select 
                value={register}
                onChange={(e) => setRegister(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 font-bold"
              >
                <option value="Cash 1">Cash 1</option>
                <option value="Cash 2">Cash 2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Amount Returned</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 pr-12 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 font-bold text-red-600"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">EGP</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Customer Name</label>
            <input 
              type="text" 
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 font-bold"
              placeholder="Full Name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Customer Phone Number</label>
            <input 
              type="tel" 
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 font-mono"
              placeholder="01xxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Reason for Return/Void</label>
            <textarea 
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-red-500 text-sm h-24 resize-none"
              placeholder="Explain exactly why this transaction was voided or returned..."
            />
          </div>
        </div>

        {/* Signature Capture */}
        <div className="bg-slate-50 p-4 rounded-xl border border-border space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <UserIcon className="h-5 w-5 text-red-500" />
            <h2 className="text-sm font-bold text-slate-800 uppercase">Sign Your Request</h2>
          </div>
          <p className="text-xs text-slate-500">Please sign below to verify this void/return.</p>
          <SignaturePad 
            dict={{ clearSignature: "Clear Signature" }} 
            onSave={(data) => setCashierSignature(data)} 
            onClear={() => setCashierSignature("")} 
          />
          <input type="text" value={cashierSignature} readOnly required className="h-0 w-0 opacity-0 absolute pointer-events-none" />
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
            ) : (
              <>
                <UploadCloud className="h-5 w-5" /> Submit Return Request
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
