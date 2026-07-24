"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { Camera, CheckCircle, UploadCloud, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileUploadInvoicePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const docSnap = await getDoc(doc(db, "cash_payments", id));
        if (docSnap.exists()) {
          setPaymentInfo(docSnap.data());
          if (docSnap.data().invoiceUrl) {
            setSuccess(true);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPayment();
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    
    try {
      const storageRef = ref(storage, `invoices/${id}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(p);
        },
        (error) => {
          console.error(error);
          toast.error("Upload failed");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          await updateDoc(doc(db, "cash_payments", id), {
            invoiceUrl: downloadURL,
            updatedAt: new Date().toISOString(),
          });
          
          setSuccess(true);
          toast.success("Uploaded successfully!");
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("Error saving document");
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle className="h-12 w-12 text-white" />
        </motion.div>
        <h1 className="text-3xl font-black text-white mb-2">Upload Complete!</h1>
        <p className="text-slate-400 font-medium mb-8">
          The invoice has been successfully attached to the payment. You can now return to the computer.
        </p>
        <p className="text-sm text-slate-500">
          This window can be closed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="p-6 pb-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold text-white tracking-tight">Upload Invoice</h1>
        {paymentInfo && (
          <p className="text-emerald-400 text-sm mt-1 font-medium">
            Payment: {paymentInfo.companyName} • EGP {paymentInfo.total}
          </p>
        )}
      </div>

      <div className="flex-1 p-6 flex flex-col">
        {!preview ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-48 h-48 rounded-full bg-indigo-500/10 border-4 border-indigo-500/30 flex flex-col items-center justify-center gap-4 hover:bg-indigo-500/20 active:scale-95 transition-all duration-200"
            >
              <Camera className="h-16 w-16 text-indigo-400" />
              <span className="text-indigo-300 font-bold tracking-widest uppercase">Take Photo</span>
            </button>
            <p className="text-slate-400 text-center mt-8 px-4 leading-relaxed">
              Scan the original paper invoice. Make sure it is clear and well-lit.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            <div className="relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border border-white/10 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              
              {!uploading && (
                <button 
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-4 right-4 p-3 rounded-full bg-black/50 text-white backdrop-blur-md"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Uploading... {progress}%
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6" />
                  Confirm & Upload
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
