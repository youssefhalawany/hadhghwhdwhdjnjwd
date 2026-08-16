"use client";

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, CheckCircle, UploadCloud, X, Loader2, RefreshCw, MapPin, Maximize, Focus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

  // WebRTC Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isAligned, setIsAligned] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cropper State
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const collectionName = type === "credit" ? "credits" : "cash_payments";
        const docSnap = await getDoc(doc(db, collectionName, id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const normalizedUrls = type === "credit" 
            ? (data?.poUrls || (data?.poUrl ? [data.poUrl] : []) || data?.invoiceUrls || (data?.invoiceUrl ? [data.invoiceUrl] : []))
            : (data?.invoiceUrls || (data?.invoiceUrl ? [data.invoiceUrl] : []));
          setPaymentInfo({ ...data, invoiceUrls: normalizedUrls });
          if (normalizedUrls && normalizedUrls.length > 0) {
            setSuccess(true);
          }
          return;
        }

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
    if (id) fetchPayment();
  }, [id, type]);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: (deviceId && typeof deviceId === 'string' && deviceId.trim()) 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      
      const currentTrack = stream.getVideoTracks()[0];
      if (currentTrack && !deviceId) {
        setSelectedDeviceId(currentTrack.getSettings().deviceId || null);
      } else if (deviceId) {
        setSelectedDeviceId(deviceId);
      }

    } catch (err) {
      console.error("Camera access failed", err);
      toast.error("Camera access denied or failed. Opening file picker.");
      fileInputRef.current?.click();
    }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isCameraActive) {
      const interval = setInterval(() => {
        setIsAligned(prev => !prev);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isCameraActive]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      stopCamera();
      setCroppingImageSrc(dataUrl);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (e) {
      console.error("Error capturing frame", e);
      stopCamera();
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCroppingImageSrc(reader.result as string);
        setCrop(undefined);
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(selectedFile);
      e.target.value = '';
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setCrop({
      unit: '%',
      x: 2,
      y: 2,
      width: 96,
      height: 96
    });
  };

  const handleApplyCrop = () => {
    if (!croppingImageSrc) return;

    try {
      const canvas = document.createElement('canvas');
      const img = imgRef.current;
      
      const naturalW = img?.naturalWidth || 1000;
      const naturalH = img?.naturalHeight || 1000;
      const displayW = img?.width || naturalW;
      const displayH = img?.height || naturalH;

      const scaleX = naturalW / displayW;
      const scaleY = naturalH / displayH;

      const cropX = (completedCrop && completedCrop.width > 0) ? completedCrop.x * scaleX : 0;
      const cropY = (completedCrop && completedCrop.height > 0) ? completedCrop.y * scaleY : 0;
      const cropW = (completedCrop && completedCrop.width > 0) ? completedCrop.width * scaleX : naturalW;
      const cropH = (completedCrop && completedCrop.height > 0) ? completedCrop.height * scaleY : naturalH;

      const safeW = Math.max(1, Math.round(cropW));
      const safeH = Math.max(1, Math.round(cropH));

      // Ultra-fast downscaling for instantaneous mobile processing & tiny upload size
      const MAX_DIMENSION = 1000;
      let targetW = safeW;
      let targetH = safeH;

      if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIMENSION) / targetW);
          targetW = MAX_DIMENSION;
        } else {
          targetW = Math.round((targetW * MAX_DIMENSION) / targetH);
          targetH = MAX_DIMENSION;
        }
      }

      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setCompressedDataUrls(prev => [...prev, croppingImageSrc]);
        setCroppingImageSrc(null);
        return;
      }

      if (img) {
        ctx.drawImage(
          img,
          Math.max(0, Math.round(cropX)),
          Math.max(0, Math.round(cropY)),
          safeW,
          safeH,
          0,
          0,
          targetW,
          targetH
        );
      }

      if (isEnhancing) {
        try {
          ctx.filter = 'grayscale(100%) contrast(140%)';
          if (img) {
            ctx.drawImage(
              img,
              Math.max(0, Math.round(cropX)),
              Math.max(0, Math.round(cropY)),
              safeW,
              safeH,
              0,
              0,
              targetW,
              targetH
            );
          }
        } catch (e) {
          try {
            const imageData = ctx.getImageData(0, 0, targetW, targetH);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              gray = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 128));
              data[i] = gray;
              data[i + 1] = gray;
              data[i + 2] = gray;
            }
            ctx.putImageData(imageData, 0, 0);
          } catch (err) {
            console.warn("ImageData enhancement fallback failed", err);
          }
        }
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setCompressedDataUrls(prev => [...prev, dataUrl]);
    } catch (err) {
      console.error("Error applying crop:", err);
      if (croppingImageSrc) {
        setCompressedDataUrls(prev => [...prev, croppingImageSrc]);
      }
    }
    
    setCroppingImageSrc(null);
  };

  const handleCancelCrop = () => {
    setCroppingImageSrc(null);
  };

  const handleUpload = async () => {
    if (compressedDataUrls.length === 0) return;
    setUploading(true);
    setProgress(30);
    
    try {
      const collectionName = type === "credit" ? "credits" : "cash_payments";
      const updateField = type === "credit"
        ? { poUrls: compressedDataUrls, poUrl: compressedDataUrls[0], invoiceUrls: compressedDataUrls, invoiceUrl: compressedDataUrls[0], updatedAt: new Date().toISOString() }
        : { invoiceUrls: compressedDataUrls, invoiceUrl: compressedDataUrls[0], updatedAt: new Date().toISOString() };

      try {
        await setDoc(doc(db, collectionName, id), updateField, { merge: true });
        setProgress(100);
        setSuccess(true);
        toast.success("Uploaded successfully!");
        return;
      } catch (clientErr) {
        console.warn("Client direct write failed, attempting API route fallback:", clientErr);
      }

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

      setProgress(100);

      if (res.ok) {
        setSuccess(true);
        toast.success("Uploaded successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
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
        
        <h1 className="text-2xl font-bold text-white mb-2">Invoice Document Uploaded!</h1>
        <p className="text-slate-400 text-sm max-w-xs mb-8">
          The document has been securely attached to the payment record in the system.
        </p>

        <button
          onClick={() => {
            setSuccess(false);
            setCompressedDataUrls([]);
          }}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors"
        >
          Upload Another Page
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        capture="environment"
        className="hidden" 
      />

      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-white/10 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-black flex items-center justify-center text-xs">
            K
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">Circle K Invoice Capture</h1>
            <p className="text-[10px] text-slate-400">Ref: #{id ? id.substring(0, 8) : 'NEW'}</p>
          </div>
        </div>

        {compressedDataUrls.length > 0 && (
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3 py-1 rounded-full">
            {compressedDataUrls.length} Page{compressedDataUrls.length > 1 ? 's' : ''} Ready
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col overflow-hidden p-4">
        {isCameraActive ? (
          <div className="flex-1 flex flex-col bg-black rounded-2xl overflow-hidden relative border border-white/10">
            {/* Top Camera Bar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
              <button 
                onClick={stopCamera}
                className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md"
              >
                <X className="h-5 w-5" />
              </button>

              {devices.length > 1 && (
                <button 
                  onClick={() => {
                    const currentIndex = devices.findIndex(d => d.deviceId === selectedDeviceId);
                    const nextDevice = devices[(currentIndex + 1) % devices.length];
                    if (nextDevice) startCamera(nextDevice.deviceId);
                  }}
                  className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center gap-1 text-xs font-bold px-3"
                >
                  <RefreshCw className="h-4 w-4" />
                  Switch Camera
                </button>
              )}
            </div>

            {/* Video Viewport */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
              
              {/* AR Overlay Guide Frame */}
              <div className="absolute inset-8 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-indigo-400" />
                  <div className="w-6 h-6 border-t-4 border-r-4 border-indigo-400" />
                </div>
                <div className="text-center bg-black/60 backdrop-blur-md py-1 px-3 rounded-full text-[11px] font-bold text-indigo-300 self-center uppercase tracking-wider">
                  Align Invoice Within Frame
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-indigo-400" />
                  <div className="w-6 h-6 border-b-4 border-r-4 border-indigo-400" />
                </div>
              </div>
            </div>

            {/* Shutter Button */}
            <div className="h-28 bg-black flex items-center justify-center relative z-20 pb-4">
              <button 
                onClick={handleCapture}
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 ${isAligned ? 'bg-emerald-500/20 border-emerald-500' : 'bg-white/10 border-white/50 hover:bg-white/20'}`}
              >
                <div className={`w-16 h-16 rounded-full ${isAligned ? 'bg-emerald-500' : 'bg-white'}`} />
              </button>
            </div>
          </div>
        ) : croppingImageSrc ? (
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
                  style={{ filter: isEnhancing ? 'grayscale(100%) contrast(140%)' : 'none' }}
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
              onClick={() => startCamera()}
              className="w-44 h-44 rounded-full bg-indigo-500/10 border-4 border-indigo-500/30 flex flex-col items-center justify-center gap-4 hover:bg-indigo-500/20 active:scale-95 transition-all duration-200"
            >
              <Focus className="h-14 w-14 text-indigo-400 animate-pulse" />
              <span className="text-indigo-300 font-bold text-xs tracking-widest uppercase">Start Live Camera</span>
            </button>
            <p className="text-slate-400 text-center mt-6 px-4 leading-relaxed text-xs">
              Point your phone camera at the supplier invoice document.
            </p>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-10 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200 transition-colors"
            >
              Select Image From Gallery / Device
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col gap-4">
              {compressedDataUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shrink-0" style={{ height: '280px' }}>
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
                  onClick={() => startCamera()}
                  className="w-full h-20 rounded-2xl border-2 border-dashed border-indigo-500/50 flex flex-col items-center justify-center gap-1 hover:bg-indigo-500/10 active:scale-[0.98] transition-all shrink-0 mt-2"
                >
                  <Camera className="h-5 w-5 text-indigo-400" />
                  <span className="text-indigo-300 font-bold text-xs tracking-widest uppercase">Scan Next Page</span>
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 mt-auto shrink-0">
              <button
                onClick={handleUpload}
                disabled={uploading || compressedDataUrls.length === 0}
                className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploading {compressedDataUrls.length} Page{compressedDataUrls.length > 1 ? 's' : ''}... {progress}%
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-5 w-5" />
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

export default function UploadInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    }>
      <UploadInvoiceContent />
    </Suspense>
  );
}
