"use client";

import QRCodeLib from "qrcode";

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";
  
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  
  function getBelow100(n: number): string {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return tens[t];
    return ones[o] + " و" + tens[t];
  }
  
  function getBelow1000(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (h === 0) return getBelow100(rest);
    const hText = hundreds[h];
    if (rest === 0) return hText;
    return hText + " و" + getBelow100(rest);
  }
  
  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;
  
  let result = "";
  
  if (thousands > 0) {
    if (thousands === 1) result += "ألف";
    else if (thousands === 2) result += "ألفان";
    else if (thousands >= 3 && thousands <= 10) result += getBelow100(thousands) + " آلاف";
    else result += getBelow1000(thousands) + " ألف";
  }
  
  if (remainder > 0) {
    if (result !== "") result += " و";
    result += getBelow1000(remainder);
  }
  
  return result;
}

import React, { useState, useEffect, useMemo } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp,
  limit,
  where,
  updateDoc
} from "firebase/firestore";
import { 
  Plus, 
  Download, 
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  Image as ImageIcon,
  Eye,
  ClipboardPaste,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  FileText,
  PieChart as PieChartIcon
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis } from 'recharts';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useBranch } from "@/context/BranchContext";
import { motion, AnimatePresence } from "framer-motion";
import { syncProductsToMaster } from "@/lib/products-sync";
import { playPrinterSound } from "@/lib/audioCues";

const compressImage = (file: File, maxWidth: number = 1500, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const CATEGORY_EMOJIS: Record<string, string> = {
  order: "📦",
  maintenance: "🔧",
  utilities: "💡",
  transportation: "🚚",
  other: "📝"
};

const METHOD_EMOJIS: Record<string, string> = {
  cash: "💵",
  visa: "💳",
  bank_transfer: "🏦"
};

export default function PaymentsRedesignPage() {
  const { currentBranch } = useBranch();
  const branchIds = useMemo(() => {
    const ids = [];
    if (currentBranch === "all") {
      // no filter
    } else if (currentBranch === "alamein4") {
      ids.push("eL-alamein-4");
    } else if (currentBranch === "ola") {
      ids.push("ola-el-koronfol");
    } else {
      ids.push(currentBranch);
    }
    return ids;
  }, [currentBranch]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${mm}`;
  });

  // Supplier Features State
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<string | null>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [savedPaymentForQR, setSavedPaymentForQR] = useState<any>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("order");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [categoryNote, setCategoryNote] = useState("");
  const [supplierRepName, setSupplierRepName] = useState("");
  const [supplierNationalId, setSupplierNationalId] = useState("");
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  
  // PO Extraction State
  const [poItems, setPoItems] = useState<{barcode: string, quantity: number, description: string, unitPrice: number}[]>([]);
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  const [poImageFile, setPoImageFile] = useState<File | null>(null);
  const [selectedPaymentForPoUpload, setSelectedPaymentForPoUpload] = useState<any>(null);
  const [uploadingPoToOldInvoice, setUploadingPoToOldInvoice] = useState(false);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<any>(null);
  const [selectedPaymentForView, setSelectedPaymentForView] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (selectedPaymentForPrint) {
      const urlText = `${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/handshake?data=${encodeURIComponent(JSON.stringify({ 
        id: selectedPaymentForPrint.id, 
        amount: selectedPaymentForPrint.total, 
        company: selectedPaymentForPrint.companyName, 
        date: selectedPaymentForPrint.date,
        action: "verify_receipt" 
      }))}`;
      QRCodeLib.toDataURL(urlText)
        .then((url: string) => setQrCodeData(url))
        .catch((err: any) => console.error(err));
    } else {
      setQrCodeData("");
    }
  }, [selectedPaymentForPrint]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, currentBranch, monthFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payments
      let q1;
      if (monthFilter) {
        const monthStart = `${monthFilter}-01`;
        const monthEnd = `${monthFilter}-31`;
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"))
          : query(collection(db, "cash_payments"), where("date", ">=", monthStart), where("date", "<=", monthEnd), orderBy("date", "desc"));
      } else {
        q1 = branchIds.length > 0
          ? query(collection(db, "cash_payments"), where("storeId", "in", branchIds), orderBy("date", "desc"), limit(500))
          : query(collection(db, "cash_payments"), orderBy("date", "desc"), limit(500));
      }
      const paySnapshot = await getDocs(q1);
      const loadedPayments = paySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPayments(loadedPayments);

      // 2. Extract Suppliers from cash_payments
      const uniqueSuppliers = new Set<string>();
      
      loadedPayments.forEach(p => {
        if (p.companyName) uniqueSuppliers.add(p.companyName.toUpperCase());
      });

      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));

      // 3. Fetch Credits to calculate Outstanding Debt
      const q2 = branchIds.length > 0 
          ? query(collection(db, "credits"), where("storeId", "in", branchIds), orderBy("createdAt", "desc"))
          : query(collection(db, "credits"), orderBy("createdAt", "desc"));
      try {
        const credSnapshot = await getDocs(q2);
        setCredits(credSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (err) {
        console.error("Failed to load credits", err);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("https://console.firebase.google.com")) {
        const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
        if (urlMatch) {
          toast.error("Firebase Index Missing (Required for filtering)", {
            description: "Click the button to automatically create the required index.",
            action: {
              label: "Create Index",
              onClick: () => window.open(urlMatch[0], "_blank")
            },
            duration: 20000,
          });
          setLoading(false);
          return;
        }
      }
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const name = newSupplierName.trim().toUpperCase();
    
    // Just add to local state, it will be persisted to cash_payments when a payment is saved
    const newSupp = { id: `sup_new_${Date.now()}`, name };
    setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyName(name);
    setShowAddSupplier(false);
    setNewSupplierName("");
    toast.success("Supplier ready to be used!");
  };
  const handlePastePoImageButtonClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          if (selectedPaymentForPoUpload) {
            handleUploadPoToOldInvoice(file);
          } else {
            handleImageUpload(file);
          }
          return;
        }
      }
      toast.error('No image found in clipboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to read clipboard. Please use Cmd+V / Ctrl+V on your keyboard.');
    }
  };
  const handleUploadPoToOldInvoice = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setUploadingPoToOldInvoice(true);
    try {
      const base64Image = await compressImage(file);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
        });
        
        if (!response.ok) {
          if (response.status === 429) throw new Error("RATE_LIMIT");
          throw new Error('Failed to process image');
        }
        const data = await response.json();
        
        let newItems: any[] = [];
        if (data.items && Array.isArray(data.items)) {
          newItems = data.items;
        }

        // User requested to skip saving PO images to storage for faster processing
        const updateData: any = {};
        if (newItems.length > 0) updateData.items = newItems;
        if (data.poNumber && !selectedPaymentForPoUpload.poNumber) updateData.poNumber = data.poNumber;

        await updateDoc(doc(db, "cash_payments", selectedPaymentForPoUpload.id), updateData);
        
        // Sync products to the secondary Firebase db
        if (newItems.length > 0) {
          syncProductsToMaster(newItems, data.date || selectedPaymentForPoUpload.date || new Date().toISOString().split('T')[0], selectedPaymentForPoUpload.companyName);
        }

        setPayments(prev => prev.map(p => {
          if (p.id === selectedPaymentForPoUpload.id) {
            return { ...p, ...updateData };
          }
          return p;
        }));

        toast.success('PO added successfully to old invoice!');
        setSelectedPaymentForPoUpload(null);
      } catch (err: any) {
        console.error(err);
        if (err.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Error adding PO to old invoice.');
        }
      } finally {
        setUploadingPoToOldInvoice(false);
      }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setIsProcessingPo(true);
    setPoImageFile(file);
    try {
      const base64Image = await compressImage(file);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
        
        if (!response.ok) {
          if (response.status === 429) throw new Error("RATE_LIMIT");
          throw new Error('Failed to process image');
        }
        const data = await response.json();
        
        if (data.poNumber) setPoNumber(data.poNumber);
        if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
        if (data.date) setDate(data.date);
        
        if (data.companyName) {
           const match = suppliers.find(s => s.name.toLowerCase().includes(data.companyName.toLowerCase()) || data.companyName.toLowerCase().includes(s.name.toLowerCase()));
           if (match) {
             setCompanyName(match.name);
           } else {
             const name = data.companyName.trim().toUpperCase();
             const newSupp = { id: `sup_new_${Date.now()}`, name };
             setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
             setCompanyName(name);
           }
        }
        
        if (data.amount !== undefined) setAmount(data.amount.toString());
        if (data.tax !== undefined) setTax(data.tax.toString());
        
        if (data.items && Array.isArray(data.items)) {
          setPoItems(data.items);
        }
        
        toast.success('PO processed successfully!');
      } catch (err: any) {
        console.error(err);
        if (err.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Error processing PO image. Please enter manually.');
        }
      } finally {
        setIsProcessingPo(false);
      }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (selectedPaymentForPoUpload) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              handleUploadPoToOldInvoice(file);
            }
            break;
          }
        }
        return;
      }

      if (!showAddModal || category !== 'order') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageUpload(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
     
  }, [showAddModal, category, selectedPaymentForPoUpload]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (category !== 'order') return;
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setDate(new Date().toISOString().split("T")[0]);
    setMethod("cash");
    setCategory("order");
    setInvoiceNumber("");
    setPoNumber("");
    setCompanyName("");
    setNewSupplierName("");
    setAmount("");
    setTax("");
    setCategoryNote("");
    setSupplierRepName("");
    setSupplierNationalId("");
    setShowAddSupplier(false);
    setPoItems([]);
    setIsProcessingPo(false);
  };

  const handlePoItemChange = (index: number, field: 'barcode' | 'quantity' | 'description' | 'unitPrice', value: any) => {
    const newItems = [...poItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setPoItems(newItems);
  };

  const handleRemovePoItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleAddPoItem = () => {
    setPoItems([...poItems, { barcode: "", quantity: 1, description: "", unitPrice: 0 }]);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !amount) {
      toast.error("Company name and amount are required.");
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const numTax = parseFloat(tax) || 0;
    const total = numAmount + numTax;

    try {
      setSubmitting(true);
      const poImageUrl = null;
      // User requested to skip saving PO images to storage for faster processing

      const newPayment = {
        amount: numAmount,
        category,
        categoryNote,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date,
        description: categoryNote,
        invoiceNumber,
        isTaxable: numTax > 0,
        method,
        poNumber,
        storeId: branchIds.length > 0 ? branchIds[0] : "eL-alamein-4", 
        tax: numTax,
        total,
        supplierRepName,
        supplierNationalId,
        ...(poItems.length > 0 ? { items: poItems } : {}),
        ...(poImageUrl ? { poImageUrl } : {})
      };

      const docRef = await addDoc(collection(db, "cash_payments"), newPayment);
      
      // Sync products to secondary Firebase
      if (poItems.length > 0) {
        syncProductsToMaster(poItems, date, companyName);
      }

      toast.success("Payment saved!");
      handleCloseModal();
      fetchData();
      const savedPayment = { id: docRef.id, ...newPayment, createdAt: Timestamp.now() };
      setPayments([savedPayment, ...payments]);
      setShowAddModal(false);
      
      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setAmount("");
      setTax("");
      setCategoryNote("");
      setSupplierRepName("");
      setSupplierNationalId("");
      setPoItems([]);
      setPoImageFile(null);
      
      // Auto Print & QR
      setSelectedPaymentForPrint(savedPayment);
      setSavedPaymentForQR(savedPayment);
      setTimeout(() => generatePDF(), 500);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    try {
      await deleteDoc(doc(db, "cash_payments", id));
      setPayments(payments.filter(p => p.id !== id));
      toast.success("Payment deleted successfully.");
    } catch (err) {
      toast.error("Failed to delete payment.");
    }
  };

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const page1 = document.getElementById("pdf-receipt");
      
      if (page1) {
        page1.style.left = "0";
        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true });
        const imgData1 = canvas1.toDataURL("image/png");
        const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
        pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
        page1.style.left = "-9999px";
      }

      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
      setSelectedPaymentForPrint(null);
    } catch (error) {
      toast.error("Failed to generate PDF.");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Derived filtered data
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Month Filter
      if (monthFilter && p.date && !p.date.startsWith(monthFilter)) return false;
      
      // Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.companyName?.toLowerCase().includes(q) ||
          p.invoiceNumber?.toLowerCase().includes(q) ||
          p.poNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, monthFilter, searchQuery]);

  // Aggregate Category Stats for the top cards
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    filteredPayments.forEach(p => {
      const cat = p.category || "other";
      if (!stats[cat]) stats[cat] = { count: 0, total: 0 };
      stats[cat].count += 1;
      stats[cat].total += (p.total || 0);
    });
    return stats;
  }, [filteredPayments]);

  // Derived Supplier Profile Data
  const supplierProfileData = useMemo(() => {
    if (!selectedSupplierProfile) return null;
    
    // 1. Filter payments for this supplier
    const sPayments = payments.filter(p => p.companyName?.toUpperCase() === selectedSupplierProfile.toUpperCase());
    sPayments.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    
    // 2. Lifetime Spend
    const lifetimeSpend = sPayments.reduce((sum, p) => sum + (p.total || 0), 0);
    
    // 3. Outstanding Debt (from credits)
    const sCredits = credits.filter(c => c.companyName?.toUpperCase() === selectedSupplierProfile.toUpperCase() && c.status === "open");
    const outstandingDebt = sCredits.reduce((sum, c) => sum + ((parseFloat(c.amountDue) || 0) - (parseFloat(c.paidAmount) || 0)), 0);
    
    // 4. Sparkline Trend (last 6 months)
    const monthlyTotals: Record<string, number> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // include current month + 5 previous
    sixMonthsAgo.setDate(1);
    
    sPayments.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      if (d >= sixMonthsAgo) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (p.total || 0);
      }
    });
    
    const trendData = Object.entries(monthlyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }));

    let hasPriceHike = false;
    if (trendData.length >= 2) {
      const latestMonthTotal = trendData[trendData.length - 1].total;
      const prevMonths = trendData.slice(0, trendData.length - 1);
      const avgPrev = prevMonths.reduce((sum, t) => sum + t.total, 0) / prevMonths.length;
      if (avgPrev > 0 && latestMonthTotal > (avgPrev * 1.2)) {
        hasPriceHike = true;
      }
    }

    return { sPayments, lifetimeSpend, outstandingDebt, trendData, hasPriceHike };
  }, [selectedSupplierProfile, payments, credits]);

  const handleGenerateSOA = () => {
    if (!selectedSupplierProfile || !supplierProfileData) return;
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      pdf.setFontSize(22);
      pdf.text(`Statement of Account`, 20, 20);
      pdf.setFontSize(14);
      pdf.setTextColor(100);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      
      pdf.setTextColor(0);
      pdf.setFontSize(16);
      pdf.text(`Supplier: ${selectedSupplierProfile}`, 20, 50);
      pdf.text(`Outstanding Debt: EGP ${supplierProfileData.outstandingDebt.toLocaleString()}`, 20, 60);
      pdf.text(`Lifetime Spend: EGP ${supplierProfileData.lifetimeSpend.toLocaleString()}`, 20, 70);
      
      pdf.setFontSize(14);
      pdf.text(`Recent Payments:`, 20, 90);
      pdf.setFontSize(11);
      
      let y = 100;
      supplierProfileData.sPayments.slice(0, 15).forEach((p, i) => {
        pdf.text(`${p.date}   |   EGP ${Number(p.total).toLocaleString()}   |   Inv: ${p.invoiceNumber || 'N/A'}`, 20, y);
        y += 8;
      });

      pdf.save(`SOA_${selectedSupplierProfile}.pdf`);
      
      // Open WhatsApp
      const waText = encodeURIComponent(`Hello ${selectedSupplierProfile} team. Please find our Statement of Account attached (downloaded to my device). Our records show an outstanding debt of EGP ${supplierProfileData.outstandingDebt.toLocaleString()} and a lifetime spend of EGP ${supplierProfileData.lifetimeSpend.toLocaleString()}.`);
      window.open(`https://wa.me/?text=${waText}`, '_blank');
      toast.success("SOA Generated! Please attach the downloaded PDF in WhatsApp.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate SOA.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-20">
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Payments Control</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Track and manage all corporate outgoings.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-white transition-all">
              <FileDown size={18} /> Export All
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#ef4444] text-white px-5 py-2.5 rounded-xl font-semibold shadow-md hover:bg-[#dc2626] hover:-translate-y-0.5 transition-all"
            >
              <Plus size={20} /> Record Payment
            </button>
          </div>
        </div>

        {/* NEW DASHBOARD TOP */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
              <PieChartIcon className="text-blue-500" size={20} /> Spending Breakdown
            </h3>
            <div className="h-64 w-full">
              {Object.keys(categoryStats).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(categoryStats).map(([name, val]) => ({ name, value: val.total }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {Object.entries(categoryStats).map(([name], index) => {
                        const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: any) => `EGP ${Number(value).toLocaleString()}`} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
                  No data for this period
                </div>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
            {categoryStats["order"] && (
              <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 p-5 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">📦</div>
                <div className="flex items-center gap-2 text-blue-600 mb-3">
                  <span className="text-sm font-bold tracking-wide uppercase">Order</span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["order"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p className="text-xs font-semibold text-blue-600/70 mt-1 relative z-10">{categoryStats["order"].count} payment(s)</p>
              </motion.div>
            )}
            {categoryStats["utilities"] && (
              <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100/50 p-5 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">💡</div>
                <div className="flex items-center gap-2 text-amber-600 mb-3">
                  <span className="text-sm font-bold tracking-wide uppercase">Utilities</span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["utilities"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p className="text-xs font-semibold text-amber-600/70 mt-1 relative z-10">{categoryStats["utilities"].count} payment(s)</p>
              </motion.div>
            )}
            {categoryStats["maintenance"] && (
              <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100/50 p-5 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">🔧</div>
                <div className="flex items-center gap-2 text-purple-600 mb-3">
                  <span className="text-sm font-bold tracking-wide uppercase">Maintenance</span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["maintenance"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p className="text-xs font-semibold text-purple-600/70 mt-1 relative z-10">{categoryStats["maintenance"].count} payment(s)</p>
              </motion.div>
            )}
            {categoryStats["transportation"] && (
              <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100/50 p-5 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">🚚</div>
                <div className="flex items-center gap-2 text-emerald-600 mb-3">
                  <span className="text-sm font-bold tracking-wide uppercase">Transportation</span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["transportation"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p className="text-xs font-semibold text-emerald-600/70 mt-1 relative z-10">{categoryStats["transportation"].count} payment(s)</p>
              </motion.div>
            )}
            {categoryStats["other"] && (
              <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-100/50 p-5 rounded-3xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">📝</div>
                <div className="flex items-center gap-2 text-slate-600 mb-3">
                  <span className="text-sm font-bold tracking-wide uppercase">Other</span>
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {categoryStats["other"].total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p className="text-xs font-semibold text-slate-600/70 mt-1 relative z-10">{categoryStats["other"].count} payment(s)</p>
              </motion.div>
            )}
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search company, invoice, PO number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent focus:bg-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-none outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 font-medium"
            />
          </div>
          <div className="h-px md:h-auto md:w-px bg-slate-200 dark:bg-slate-700"></div>
          <input 
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full md:w-64 px-4 py-3 rounded-xl bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 transition-colors border-none outline-none text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">
            All Records ({filteredPayments.length})
          </h2>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {filteredPayments.map((pay, idx) => {
              const initials = pay.companyName ? pay.companyName.substring(0, 2).toUpperCase() : "NA";
              const colors = [
                'bg-indigo-100 text-indigo-700 border-indigo-200', 
                'bg-rose-100 text-rose-700 border-rose-200', 
                'bg-emerald-100 text-emerald-700 border-emerald-200',
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-blue-100 text-blue-700 border-blue-200'
              ];
              const charCode = pay.companyName ? pay.companyName.charCodeAt(0) : 0;
              const avatarColor = colors[charCode % colors.length];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  key={pay.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-black text-lg tracking-tight ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <button 
                            onClick={() => setSelectedSupplierProfile(pay.companyName)}
                            className="text-lg font-bold text-slate-900 dark:text-white capitalize tracking-tight hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left transition-colors flex items-center gap-1 group/name"
                          >
                            {pay.companyName}
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover/name:opacity-100 transition-opacity -ml-1" />
                          </button>
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            {CATEGORY_EMOJIS[pay.category]} <span className="capitalize">{pay.category}</span>
                          </span>
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            {METHOD_EMOJIS[pay.method] || "💵"} <span className="capitalize">{pay.method?.replace('_', ' ') || 'cash'}</span>
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <span className="text-slate-400">{pay.date}</span>
                          {(pay.invoiceNumber || pay.poNumber) && (
                            <>
                              <span className="text-slate-300">•</span>
                              {pay.invoiceNumber && `Inv: ${pay.invoiceNumber}`} 
                              {pay.invoiceNumber && pay.poNumber && " | "}
                              {pay.poNumber && `PO: ${pay.poNumber}`}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                      <div className="text-right">
                        <p className="text-2xl font-black text-[#dc2626] tracking-tight font-mono">
                          <span className="text-sm font-medium text-slate-400 dark:text-slate-500 mr-1">EGP</span>
                          {Number(pay.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {pay.category === "order" && (!pay.items || pay.items.length === 0) && !pay.poImageUrl && (
                          <button 
                            onClick={() => setSelectedPaymentForPoUpload(pay)}
                            className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mr-2"
                          >
                            <Plus size={14} /> Add PO
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedPaymentForView(pay);
                            playPrinterSound();
                          }}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                          title="View Receipt"
                        >
                          <Eye size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedPaymentForPrint(pay);
                            setTimeout(() => generatePDF(), 100);
                          }}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                        >
                          <Download size={20} />
                        </button>
                        <button onClick={() => handleDelete(pay.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12 text-slate-500 font-medium">
              No payments found matching your criteria.
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl relative my-auto border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={handleCloseModal}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <form onSubmit={handleSavePayment} className="p-8">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white pb-6 tracking-tight">Record Payment</h2>
                
                {category === 'order' && (
                  <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className={`mb-6 border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${isProcessingPo ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-slate-50/80 dark:bg-slate-800/50 dark:border-slate-700'}`}
                  >
                    {isProcessingPo ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="font-bold">Reading Purchase Order...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                        <ImageIcon className="h-8 w-8 text-slate-400" />
                        <span className="font-bold">Paste or Drop PO Image Here</span>
                        <span className="text-xs">We'll automatically extract the details using AI</span>
                        <button
                          type="button"
                          onClick={handlePastePoImageButtonClick}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-colors text-xs"
                        >
                          <ClipboardPaste size={14} />
                          Paste from Clipboard
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Basic Info</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                            <input type="date" required className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={date} onChange={(e) => setDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Method *</label>
                            <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={method} onChange={(e) => setMethod(e.target.value)}>
                              <option value="cash">Cash</option>
                              <option value="visa">Visa</option>
                              <option value="bank_transfer">Bank Transfer</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Company / Supplier *</label>
                            <button type="button" onClick={() => setShowAddSupplier(true)} className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                              + New Supplier
                            </button>
                          </div>
                          <select required className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                            <option value="">Select a supplier...</option>
                            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rep Name</label>
                          <input type="text" placeholder="Driver / Representative" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={supplierRepName} onChange={(e) => setSupplierRepName(e.target.value)} />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rep National ID</label>
                          <input type="text" placeholder="14-digit ID" maxLength={14} className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={supplierNationalId} onChange={(e) => setSupplierNationalId(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Financials</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount (Before Tax) *</label>
                            <input type="number" required placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all outline-none font-bold text-red-600 text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tax Amount</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900 text-lg" value={tax} onChange={(e) => setTax(e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice #</label>
                            <input type="text" placeholder="INV-123" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PO #</label>
                            <input type="text" placeholder="PO-123" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category *</label>
                            <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={category} onChange={(e) => setCategory(e.target.value)}>
                              <option value="order">Order</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="utilities">Utilities</option>
                              <option value="transportation">Transportation</option>
                              <option value="other">Other / Misc</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                            <input type="text" placeholder="Optional details..." className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={categoryNote} onChange={(e) => setCategoryNote(e.target.value)} />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {poItems.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Extracted Items ({poItems.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase font-bold">
                          <tr>
                            <th className="px-4 py-3 rounded-l-xl">Barcode</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-center w-24">Qty</th>
                            <th className="px-4 py-3 text-right w-32">Price</th>
                            <th className="px-4 py-3 text-right w-24">Total</th>
                            <th className="px-4 py-3 text-center rounded-r-xl w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {poItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                              <td className="px-2 py-2">
                                <input type="text" className="w-full p-2 rounded bg-slate-50 border-none focus:ring-1 focus:ring-blue-500 text-sm" value={item.barcode} onChange={e => handlePoItemChange(idx, 'barcode', e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="text" className="w-full p-2 rounded bg-slate-50 border-none focus:ring-1 focus:ring-blue-500 text-sm" value={item.description} onChange={e => handlePoItemChange(idx, 'description', e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="1" className="w-full p-2 rounded bg-slate-50 border-none focus:ring-1 focus:ring-blue-500 text-sm text-center" value={item.quantity} onChange={e => handlePoItemChange(idx, 'quantity', parseInt(e.target.value) || 0)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="0" step="0.01" className="w-full p-2 rounded bg-slate-50 border-none focus:ring-1 focus:ring-blue-500 text-sm text-right" value={item.unitPrice} onChange={e => handlePoItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => handleRemovePoItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 flex justify-start">
                        <button type="button" onClick={handleAddPoItem} className="text-sm font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                          + Add Item
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save & Print Receipt"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddSupplier && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Add New Supplier</h3>
              <input 
                type="text" 
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="e.g. COCA COLA EG"
                className="w-full border-none bg-slate-50 focus:ring-2 focus:ring-blue-500/20 rounded-xl p-3 text-slate-900 font-medium mb-6 outline-none"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowAddSupplier(false)}
                  className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSupplier}
                  disabled={!newSupplierName.trim()}
                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Use Supplier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDDEN PRINT LAYOUT (A4) */}
      {selectedPaymentForPrint && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id="pdf-receipt" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>PAYMENT VOUCHER</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Auth</p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: 1, whiteSpace: 'nowrap' }}>{selectedPaymentForPrint.createdBy?.split('@')[0] || "SYS"}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">إيصال استلام نقدية</span>
                </div>
              </div>
            </div>

            {/* Intro Text */}
            <div style={{ padding: '20px 30px 10px', textAlign: 'right' }}>
              <div style={{ padding: '15px', border: '1px dashed #000', borderRadius: '4px', display: 'inline-block', width: '100%', boxSizing: 'border-box' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#000', fontWeight: 'bold', lineHeight: '1.6' }} dir="rtl">
                  أقر أنا الموقع أدناه {selectedPaymentForPrint.supplierRepName ? `(الاسم: ${selectedPaymentForPrint.supplierRepName}) ` : ""}{selectedPaymentForPrint.supplierNationalId ? `(رقم قومي: ${selectedPaymentForPrint.supplierNationalId}) ` : ""}باستلامي كامل قيمة الفاتورة/المطالبة المذكورة أعلاه استلاماً نهائياً وناجزاً لا رجعة فيه. وبموجب هذا الإيصال، أبرئ ذمة شركة سيركل كيه العلمين 4 إبراءً ذمة تاماً ونهائياً وشاملاً كافة المستحقات المالية المتعلقة بهذه الفاتورة، ولا يحق لي، لا حاضراً ولا مستقبلاً، المطالبة بأي مبالغ إضافية أو تعويضات تخصها أمام أي جهة قضائية أو إدارية.
                </p>
              </div>
            </div>

            {/* 2x3 Grid Data */}
            <div style={{ padding: '0 30px', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                {/* Row 1 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000', backgroundColor: '#f9f9f9' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Our Company</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم شركتنا</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>El Masreya for Trade</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice Company</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الشركة للفاتورة</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedPaymentForPrint.companyName}</div>
                  </div>
                </div>
                {/* Row 2 */}
                <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice #</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الفاتورة</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.invoiceNumber || '-'}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>PO #</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الأمر</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedPaymentForPrint.poNumber || '-'}</div>
                  </div>
                </div>
                {/* Row 3 */}
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Branch</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>اسم الفرع</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>El Alamein 4</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Date</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>التاريخ</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedPaymentForPrint.date}</div>
                  </div>
                </div>
              </div>
            </div>



            {/* Financial Details Table */}
            <div style={{ padding: '0 30px', position: 'relative' }}>
              <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden', position: 'relative', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative', zIndex: 2 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #000' }}>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Invoice Value</span> <span style={{ letterSpacing: '0' }}>/ قيمة الفاتورة</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Tax</span> <span style={{ letterSpacing: '0' }}>/ الضريبة</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', borderRight: '1px dotted #ccc' }}>
                        <span style={{ letterSpacing: '1px' }}>Total</span> <span style={{ letterSpacing: '0' }}>/ الإجمالي</span>
                      </th>
                      <th style={{ padding: '8px 15px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase' }}>
                        <span style={{ letterSpacing: '1px' }}>Taxable</span> <span style={{ letterSpacing: '0' }}>/ خاضع</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ backgroundColor: '#fff' }}>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedPaymentForPrint.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedPaymentForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>EGP {Number(selectedPaymentForPrint.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'center', fontSize: '12px' }}>{Number(selectedPaymentForPrint.tax) > 0 ? '(Yes) نعم' : '(No) لا'}</td>
                    </tr>
                  </tbody>
                </table>
                <div dir="rtl" style={{ backgroundColor: '#f9f9f9', padding: '10px 15px', textAlign: 'right', fontWeight: 'bold', color: '#333', fontSize: '12px', borderTop: '1px solid #000' }}>
                  فقط وقدره: {numberToArabicWords(Number(selectedPaymentForPrint.total))} جنيهاً مصرياً لا غير
                </div>
              </div>
            </div>

            {/* Signatures & Stamp */}
            <div style={{ padding: '0 30px', marginTop: '50px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
                
                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                    {selectedPaymentForPrint.method === 'bank_transfer' ? 
                      "Bank transfers are executed electronically. Manager signature confirms execution." : 
                      "I declare the above info is accurate and I received the funds."}
                  </p>
                  <div>
                    <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>
                      {selectedPaymentForPrint.method === 'bank_transfer' ? "MANAGER / المدير المعتمد" : (selectedPaymentForPrint.supplierRepName || "SUPPLIER / المورد")}
                    </p>
                  </div>
                </div>

                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {selectedPaymentForPrint.method !== 'bank_transfer' && (
                    <>
                      <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold', textAlign: 'center' }}>
                        National ID attached.
                      </p>
                      <div>
                        <div style={{ position: 'relative', height: '30px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                          <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            {selectedPaymentForPrint.supplierNationalId || "[ ID COPY ]"}
                          </div>
                        </div>
                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>National ID / الرقم القومي</p>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                  {qrCodeData && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img src={qrCodeData} alt="QR Code" style={{ width: "70px", height: "70px" }} />
                      <span style={{ fontSize: "8px", fontWeight: "bold", color: "#666", marginTop: "4px" }}>VERIFICATION</span>
                    </div>
                  )}
                  {/* The specific blue stamp from the Shift Report */}
                  <div style={{ 
                    border: '3px solid #000080', 
                    borderRadius: '4px', 
                    padding: '10px 15px', 
                    transform: 'rotate(-2deg)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontFamily: '"Arial Black", Impact, "Arial Rounded MT Bold", sans-serif',
                    opacity: 0.85,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,128,0.2), 0 0 0 1px rgba(0,0,128,0.2)'
                  }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#000080', letterSpacing: '1px', lineHeight: 1.2 }}>Circle k</span>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#000080', letterSpacing: '0.5px', lineHeight: 1.2 }}>El Alamein 4</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Dynamic Stamp (placed in the large empty area at the bottom) */}
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
              {(() => {
                const payMethod = selectedPaymentForPrint.method || 'cash';
                const stampColor = payMethod === 'cash' ? '#16a34a' : '#ef4444';
                const stampText = payMethod === 'cash' ? 'PAID IN CASH' : (payMethod === 'visa' ? 'PAID BY VISA' : 'PAID BY BANK');
                
                return (
                  <div style={{ transform: 'rotate(-5deg)', opacity: 0.85 }}>
                    <div style={{ border: `5px solid ${stampColor}`, borderRadius: '50%', width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: stampColor, backgroundColor: 'transparent', boxShadow: `inset 0 0 0 2px ${stampColor}33, 0 0 0 2px ${stampColor}33` }}>
                      <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>{stampText}</span>
                      <span style={{ fontSize: '16px', fontWeight: '900', borderBottom: `2px solid ${stampColor}`, paddingBottom: '4px', marginBottom: '6px' }}>معتمد</span>
                      <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>PAYMENT</span>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>{selectedPaymentForPrint.date}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                PAYMENT ID: {selectedPaymentForPrint.id} | PRINTED: {new Date().toLocaleString()} | AUTHORIZED: SYS
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE 1 OF 1</p>
            </div>

          </div>
        </div>
      )}

      {/* View Items Modal - Tear-off Digital Receipt */}
      <AnimatePresence>
        {selectedPaymentForView && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            
            <div className="relative w-full max-w-2xl flex flex-col items-center">
              {/* Printer Slot Hardware */}
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="w-[102%] h-6 bg-slate-800 dark:bg-black rounded-full z-50 relative flex items-center justify-center shadow-2xl border-b-2 border-slate-900"
                style={{ boxShadow: 'inset 0px -4px 6px rgba(0,0,0,0.4), 0 10px 15px -3px rgba(0,0,0,0.3)' }}
              >
                <div className="w-[98%] h-2 bg-black rounded-full" style={{ boxShadow: 'inset 0 4px 4px rgba(0,0,0,0.9)' }} />
                {/* Printing light indicator */}
                <motion.div 
                  animate={{ opacity: [0.2, 1, 0.2] }} 
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="absolute right-4 w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" 
                />
              </motion.div>

              <motion.div 
                initial={{ clipPath: 'inset(0% -10% 100% -10%)', y: -20, opacity: 0.8 }}
                animate={{ clipPath: 'inset(-10% -10% -10% -10%)', y: 0, opacity: 1 }}
                exit={{ clipPath: 'inset(0% -10% 100% -10%)', y: -20, opacity: 0, transition: { duration: 0.3 } }}
                transition={{ 
                  duration: 2.2, 
                  ease: "linear", // Linear gives it that mechanical printer feel
                  opacity: { duration: 0.2 } 
                }}
                className="relative w-full flex flex-col -mt-2"
              >
              
              {/* Tear-off Top Edge */}
              <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(-45deg, transparent 12px, #ffffff 0), linear-gradient(45deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -top-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
              <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(-45deg, transparent 12px, #0f172a 0), linear-gradient(45deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -top-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />

              {/* Receipt Body */}
              <div className="bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col relative z-20">
                
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      <FileText className="text-blue-500" size={24} /> Payment Receipt
                    </h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      {selectedPaymentForView.companyName} • {selectedPaymentForView.date} 
                      {selectedPaymentForView.poNumber && ` • PO: ${selectedPaymentForView.poNumber}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPaymentForView.poImageUrl && (
                      <a 
                        href={selectedPaymentForView.poImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mr-2"
                      >
                        <ImageIcon size={14} /> View PO Image
                      </a>
                    )}
                    <button 
                      onClick={() => setSelectedPaymentForView(null)}
                      className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Company / Supplier</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.companyName}>{selectedPaymentForView.companyName}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{selectedPaymentForView.date}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                        {METHOD_EMOJIS[selectedPaymentForView.method] || "💵"} {selectedPaymentForView.method}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                        {CATEGORY_EMOJIS[selectedPaymentForView.category] || "📦"} {selectedPaymentForView.category}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Amount</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax Amount</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedPaymentForView.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Number</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.invoiceNumber || "N/A"}>{selectedPaymentForView.invoiceNumber || "N/A"}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">PO Number</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedPaymentForView.poNumber || "N/A"}>{selectedPaymentForView.poNumber || "N/A"}</p>
                    </div>
                  </div>

                  {(selectedPaymentForView.supplierRepName || selectedPaymentForView.categoryNote) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {selectedPaymentForView.supplierRepName && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Supplier Representative</p>
                          <p className="text-md font-bold text-slate-900 dark:text-white">{selectedPaymentForView.supplierRepName} {selectedPaymentForView.supplierNationalId ? `(${selectedPaymentForView.supplierNationalId})` : ""}</p>
                        </div>
                      )}
                      {selectedPaymentForView.categoryNote && (
                        <div className={`bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl ${!selectedPaymentForView.supplierRepName ? 'col-span-full' : ''}`}>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-md font-medium text-slate-700 dark:text-slate-300">{selectedPaymentForView.categoryNote}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Products / Items ({selectedPaymentForView.items?.length || 0})</h3>
                  <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3">Barcode</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-right">Unit Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPaymentForView.items?.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                            <td className="px-4 py-3 text-slate-500">{item.barcode || "N/A"}</td>
                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{item.description || "N/A"}</td>
                            <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-300">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-300">{Number(item.unitPrice).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Smart QR Code at bottom */}
                  <div className="flex flex-col items-center justify-center mt-8 pt-8 border-t border-dashed border-slate-300 dark:border-slate-700">
                    <div className="bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-sm mb-3">
                      <QRCode 
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/handshake?data=${encodeURIComponent(JSON.stringify({ 
                          id: selectedPaymentForView.id, 
                          amount: selectedPaymentForView.total, 
                          company: selectedPaymentForView.companyName, 
                          date: selectedPaymentForView.date,
                          action: "verify_receipt" 
                        }))}`} 
                        size={120}
                        level="H"
                      />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center max-w-[200px]">Scan for Digital Transaction Verification</p>
                  </div>
                </div>
                
                {/* Action Bar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800">
                   <button onClick={() => {
                      setSelectedPaymentForPrint(selectedPaymentForView);
                      setTimeout(() => generatePDF(), 100);
                   }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm">
                      <Download size={18} /> Download PDF
                   </button>
                   <button onClick={() => {
                      const text = `🧾 *Payment Receipt*\n*Supplier:* ${selectedPaymentForView.companyName}\n*Amount:* EGP ${Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n*Date:* ${selectedPaymentForView.date}\n*Method:* ${selectedPaymentForView.method}\n*ID:* ${selectedPaymentForView.id}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                   }} className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm">
                      WhatsApp
                   </button>
                   <button onClick={() => {
                      const subject = `Payment Receipt - ${selectedPaymentForView.companyName}`;
                      const body = `Payment Receipt\nSupplier: ${selectedPaymentForView.companyName}\nAmount: EGP ${Number(selectedPaymentForView.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}\nDate: ${selectedPaymentForView.date}\nMethod: ${selectedPaymentForView.method}\nID: ${selectedPaymentForView.id}`;
                      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                   }} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl font-bold transition-all">
                      Email
                   </button>
                </div>
              </div>

              {/* Tear-off Bottom Edge */}
              <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(135deg, transparent 12px, #ffffff 0), linear-gradient(225deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
              <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(135deg, transparent 12px, #0f172a 0), linear-gradient(225deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />
              
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload PO to Old Invoice Modal */}
      <AnimatePresence>
        {selectedPaymentForPoUpload && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Add PO to Invoice</h2>
                <button 
                  onClick={() => setSelectedPaymentForPoUpload(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm"
                  disabled={uploadingPoToOldInvoice}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-6">
                  Upload a Purchase Order image to extract the products and attach them to this invoice. This will <strong className="text-slate-700 dark:text-slate-300">not</strong> overwrite the existing supplier or total amount.
                </p>

                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => e.target.files && handleUploadPoToOldInvoice(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploadingPoToOldInvoice}
                  />
                  {uploadingPoToOldInvoice ? (
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
                      <p className="font-bold text-slate-900 dark:text-white">Processing PO...</p>
                      <p className="text-sm text-slate-500 mt-1">Extracting items & saving to database</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ImageIcon size={32} />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">Click, drag, or paste PO image here</p>
                      <p className="text-sm text-slate-500 mt-1">JPEG, PNG</p>
                    </>
                  )}
                </div>
                
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handlePastePoImageButtonClick}
                    disabled={uploadingPoToOldInvoice}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <ClipboardPaste size={18} />
                    Paste Image from Clipboard
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSupplierProfile && supplierProfileData && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSupplierProfile(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full md:w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-[80] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
                    {selectedSupplierProfile}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Supplier Profile & Analytics</p>
                </div>
                <button 
                  onClick={() => setSelectedSupplierProfile(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-800 rounded-full transition-colors shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Highlight Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Lifetime Spend</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">EGP {supplierProfileData.lifetimeSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`border p-5 rounded-3xl ${supplierProfileData.outstandingDebt > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 dark:border-red-900/50' : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 dark:border-emerald-900/50'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${supplierProfileData.outstandingDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding Debt</p>
                    <p className={`text-2xl font-black tracking-tight ${supplierProfileData.outstandingDebt > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      EGP {supplierProfileData.outstandingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Price Hike Warning */}
                {supplierProfileData.hasPriceHike && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-2xl flex items-start gap-3"
                  >
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-bold text-red-800 dark:text-red-400">Billing Spike Detected</h4>
                      <p className="text-sm font-medium text-red-700/80 dark:text-red-400/80 mt-0.5">
                        Recent payments to this supplier are &gt;20% higher than their 6-month average.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Sparkline */}
                {supplierProfileData.trendData.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                      <TrendingUp className="text-blue-500" size={16} /> 6-Month Billing Trend
                    </h3>
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={supplierProfileData.trendData}>
                          <XAxis dataKey="month" hide />
                          <YAxis hide domain={['auto', 'auto']} />
                          <RechartsTooltip 
                            formatter={(value: any) => `EGP ${Number(value).toLocaleString()}`}
                            labelStyle={{ color: '#000' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                          />
                          <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleGenerateSOA}
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <MessageCircle size={20} />
                    Generate SOA & Share to WhatsApp
                  </button>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Payment History ({supplierProfileData.sPayments.length})</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                    {supplierProfileData.sPayments.slice(0, 15).map((pay, i) => (
                      <div key={pay.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          {METHOD_EMOJIS[pay.method] || "💵"}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-400">{pay.date}</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">EGP {pay.total.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            {pay.invoiceNumber ? `Inv: ${pay.invoiceNumber}` : (pay.categoryNote || "No details")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* QR Handshake Modal */}
      <AnimatePresence>
        {savedPaymentForQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Payment Saved!</h2>
                <p className="text-slate-500 font-medium mb-8">
                  EGP {savedPaymentForQR.total.toLocaleString()} has been recorded for {savedPaymentForQR.companyName}.
                </p>
                
                <div className="bg-white p-4 rounded-2xl border-4 border-slate-100 inline-block mb-6 shadow-sm">
                  <QRCode 
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/handshake?data=${encodeURIComponent(JSON.stringify({ 
                      id: savedPaymentForQR.id, 
                      amount: savedPaymentForQR.total, 
                      company: savedPaymentForQR.companyName, 
                      date: savedPaymentForQR.date,
                      action: "verify_receipt" 
                    }))}`} 
                    size={200}
                    level="H"
                  />
                </div>
                
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Digital Handshake <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] ml-1 uppercase">Optional</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-[250px] mx-auto">
                  Ask the delivery driver to scan this QR code with their app to digitally verify they received the cash.
                </p>
              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button 
                  onClick={() => setSavedPaymentForQR(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                >
                  Skip
                </button>
                <button 
                  onClick={() => {
                    toast.success("Digital Handshake simulated! (Waiting for driver app integration)");
                    setSavedPaymentForQR(null);
                  }}
                  className="flex-[2] px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-sm"
                >
                  Driver Scanned
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
