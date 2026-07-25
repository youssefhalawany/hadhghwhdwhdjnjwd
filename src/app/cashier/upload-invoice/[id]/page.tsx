"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, CheckCircle, UploadCloud, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function UploadInvoiceContent() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'payment';
  
  const router = useRouter();
  
  const [compressedDataUrls, setCompressedDataUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  // Cropper State
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isEnhancing, setIsEnhancing] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await fetch(`/api/upload-invoice?paymentId=${id}&type=${type}`);
        if (res.ok) {
          const data = await res.json();
          setPaymentInfo(data);
          if (data.invoiceUrls && data.invoiceUrls.length > 0) {
            setSuccess(true);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPayment();
  }, [id, type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCroppingImageSrc(reader.result as string);
        // Reset crop state
        setCrop(undefined);
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(selectedFile);
      // clear input so same file can be selected again
      e.target.value = '';
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // Default crop: 10% margin from edges
    const defaultCrop = {
      unit: '%' as const,
      x: 5,
      y: 5,
      width: 90,
      height: 90
    };
    setCrop(defaultCrop);
  };

  const handleApplyCrop = () => {
    if (!completedCrop || !imgRef.current || !croppingImageSrc) return;

    const canvas = document.createElement('canvas');
    const img = imgRef.current;
    
    // Calculate scale factor since image is displayed scaled down
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Optional: apply scanner-like enhancement (grayscale + contrast)
    if (isEnhancing) {
      ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
    }

    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Compress it
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCompressedDataUrls(prev => [...prev, dataUrl]);
    
    // Close cropper
    setCroppingImageSrc(null);
  };

  const handleCancelCrop = () => {
    setCroppingImageSrc(null);
  };

  const handleUpload = async () => {
    if (compressedDataUrls.length === 0) return;
    setUploading(true);
    setProgress(10);
    
    try {
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 15, 90));
      }, 150);

      const res = await fetch('/api/upload-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: id,
          invoiceDataUrls: compressedDataUrls,
          type: type
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (res.ok) {
        setSuccess(true);
        toast.success("Uploaded successfully!");
      } else {
        const { error } = await res.json();
        throw new Error(error || "Upload failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error saving document");
      setUploading(false);
      setProgress(0);
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
          The invoice has been successfully attached. You can now return to the computer.
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
            Record: {paymentInfo.companyName || paymentInfo.supplierName || 'Unknown'} • EGP {paymentInfo.total || paymentInfo.amount || 0}
          </p>
        )}
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
        
        {croppingImageSrc ? (
          <div className="flex-1 flex flex-col h-full bg-slate-900 absolute inset-0 z-50">
            <div className="p-4 bg-slate-950 flex justify-between items-center border-b border-white/10">
              <button onClick={handleCancelCrop} className="text-slate-400 hover:text-white px-3 py-1 font-bold">Cancel</button>
              <h2 className="text-white font-bold text-sm tracking-widest uppercase">Scanner Crop</h2>
              <button onClick={handleApplyCrop} className="text-indigo-400 hover:text-indigo-300 px-3 py-1 font-bold">Done</button>
            </div>
            
            <div className="bg-slate-900 py-3 px-4 flex justify-center items-center border-b border-white/10 gap-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Enhance Document (B&W)</span>
              <button 
                onClick={() => setIsEnhancing(!isEnhancing)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isEnhancing ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isEnhancing ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-full max-w-full outline-none"
              >
                <img 
                  ref={imgRef}
                  src={croppingImageSrc}
                  onLoad={onImageLoad}
                  alt="Crop preview"
                  className="max-h-[70vh] object-contain"
                  style={{ filter: isEnhancing ? 'grayscale(100%) contrast(150%) brightness(110%)' : 'none' }}
                />
              </ReactCrop>
            </div>
            <div className="p-4 bg-slate-950 text-center text-xs text-slate-500 pb-8">
              Drag corners to fit the edges of your document.
            </div>
          </div>
        ) : compressedDataUrls.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-48 h-48 rounded-full bg-indigo-500/10 border-4 border-indigo-500/30 flex flex-col items-center justify-center gap-4 hover:bg-indigo-500/20 active:scale-95 transition-all duration-200"
            >
              <Camera className="h-16 w-16 text-indigo-400" />
              <span className="text-indigo-300 font-bold tracking-widest uppercase">Scan Document</span>
            </button>
            <p className="text-slate-400 text-center mt-8 px-4 leading-relaxed">
              Scan the original paper invoice. Make sure it is clear and well-lit.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-4">
              {compressedDataUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shrink-0" style={{ height: '300px' }}>
                  <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  <div className="absolute top-3 left-3 bg-black/60 px-3 py-1 rounded-full text-white text-xs font-bold tracking-wider">
                    PAGE {idx + 1}
                  </div>
                  {!uploading && (
                    <button 
                      onClick={() => setCompressedDataUrls(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-3 right-3 p-2 rounded-full bg-red-500/80 text-white backdrop-blur-md transition-all hover:bg-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {!uploading && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-indigo-500/50 flex flex-col items-center justify-center gap-2 hover:bg-indigo-500/10 active:scale-[0.98] transition-all shrink-0 mt-2"
                >
                  <Camera className="h-6 w-6 text-indigo-400" />
                  <span className="text-indigo-300 font-bold text-sm tracking-widest uppercase">Add Another Page</span>
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 mt-auto shrink-0">
              <button
                onClick={handleUpload}
                disabled={uploading || compressedDataUrls.length === 0}
                className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Uploading {compressedDataUrls.length} Page{compressedDataUrls.length > 1 ? 's' : ''}... {progress}%
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-6 w-6" />
                    Confirm & Upload {compressedDataUrls.length} Page{compressedDataUrls.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MobileUploadInvoicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center"><Loader2 className="h-8 w-8 animate-spin text-white mb-4" /><p className="text-slate-400 font-medium">Loading...</p></div>}>
      <UploadInvoiceContent />
    </Suspense>
  );
}
