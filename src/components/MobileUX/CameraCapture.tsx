"use client";

import React, { useState } from "react";
import { Camera, X, UploadCloud, CheckCircle } from "lucide-react";
import { productsStorage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useLanguage } from "@/context/LanguageContext";

interface CameraCaptureProps {
  onPhotoUploaded: (url: string) => void;
  label?: string;
}

export function CameraCapture({ onPhotoUploaded, label }: CameraCaptureProps) {
  const { language } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview and compress immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Compress image using canvas
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6);
        setPreview(compressedDataUrl);

        // Upload data URL directly using uploadString
        setUploading(true);
        setProgress(10); // Show initial progress
        const fileName = `checklists/proof_${Date.now()}_optimized.jpg`;
        const storageRef = ref(productsStorage, fileName);
        
        import("firebase/storage").then(({ uploadString, getDownloadURL }) => {
          uploadString(storageRef, compressedDataUrl, 'data_url')
            .then(async (snapshot) => {
              setProgress(100);
              const downloadURL = await getDownloadURL(snapshot.ref);
              setUploading(false);
              onPhotoUploaded(downloadURL);
            })
            .catch((error) => {
              console.error("Upload failed", error);
              setUploading(false);
            });
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full relative">
      {!preview && (
        <label className="w-full h-24 border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 group">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Camera className="text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-cyan-300 font-bold uppercase tracking-wider">
            {label || (language === "en" ? "Take Photo Proof" : "التقط صورة إثبات")}
          </span>
        </label>
      )}

      {preview && (
        <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Proof" className="w-full h-full object-cover" />
          
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="text-cyan-400 animate-bounce" size={32} />
                <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 transition-all duration-300" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
                <span className="text-xs text-white font-bold">{Math.round(progress)}%</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-white" size={24} />
                </div>
                <span className="text-xs text-white font-bold bg-black/50 px-2 py-1 rounded-md">
                  {language === "en" ? "Uploaded" : "تم الرفع"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
