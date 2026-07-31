"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db, auth, storage, dbService } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { syncProductsToMaster } from "@/lib/products-sync";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  where,
  limit
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  X,
  FileDown,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Clock,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  PieChart,
  AlertCircle,
  FileText,
  Banknote,
  Calendar,
  MoreHorizontal,
  CreditCard,
  Building,
  Image as ImageIcon,
  ClipboardPaste,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { TiltCard } from "@/components/MobileUX/TiltCard";
import { PullToRefresh } from "@/components/MobileUX/PullToRefresh";
import { onAuthStateChanged } from "firebase/auth";
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QRCode from "react-qr-code";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, AreaChart, Area, ComposedChart, Line, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell } from "recharts";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import dynamic from "next/dynamic";
import { useBranch } from "@/context/BranchContext";
import { AnalogOdometer } from "@/components/SkeuomorphicUX/AnalogOdometer";
import { CoinDropWallet } from "@/components/SkeuomorphicUX/CoinDropWallet";
import { PosReceiptPrinter } from "@/components/SkeuomorphicUX/PosReceiptPrinter";
import { RubberStamp } from "@/components/SkeuomorphicUX/RubberStamp";

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

const SignaturePad = dynamic(() => import("react-signature-canvas"), { ssr: false });

interface Credit {
  id: string;
  amountDue: number;
  collectionDate: string;
  companyName: string;
  createdAt: any;
  createdBy: string;
  invoiceNumber: string;
  isTaxable: boolean;
  onSalesOnly: boolean;
  poNumber: string;
  status: "open" | "pending" | "paid" | "partial" | "overdue";
  storeId: string;
  tax: number;
  paidAmount: number;
  priceAdjustment: number;
  payments: any[];
  managerSignature?: string;
  items?: any[];
  poImageUrl?: string;
  supplierRepName?: string;
  supplierNationalId?: string;
  invoiceUrl?: string;
  invoiceUrls?: string[];
  poUrl?: string;
  poUrls?: string[];
  date?: string;
}

// --- Sortable Item for Kanban Board ---
function SortableInvoiceCard({ credit, onSelect, onStatusChange }: { credit: Credit; onSelect: (c: Credit) => void; onStatusChange: (c: Credit, status: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: credit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-3 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
      {...attributes}
      {...listeners}
      onClick={() => onSelect(credit)}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-slate-900 dark:text-white capitalize text-sm">{credit.companyName}</h4>
        <span className="text-xs font-semibold text-slate-500">{credit.invoiceNumber || 'No Inv'}</span>
      </div>
      <p className="text-lg font-black text-slate-900 dark:text-white mb-2">EGP {Number(credit.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="flex items-center gap-1"><Clock size={12} /> {credit.collectionDate || 'No Date'}</span>
        {credit.paidAmount > 0 && <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Partial</span>}
      </div>
    </div>
  );
}

// --- Droppable Column for Kanban Board ---
function DroppableColumn({ id, title, credits, onSelect }: { id: string, title: string, credits: Credit[], onSelect: (c: Credit) => void }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="flex-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl p-4 flex flex-col border border-slate-200/60 dark:border-slate-800">
      <h3 className="font-black text-slate-800 dark:text-slate-200 mb-4 capitalize flex items-center gap-2">
        {id === 'open' && <AlertCircle size={18} className="text-slate-500" />}
        {id === 'pending' && <Clock size={18} className="text-blue-500" />}
        {id === 'paid' && <CheckCircle size={18} className="text-emerald-500" />}
        {title}
        <span className="ml-auto bg-white dark:bg-slate-800 text-xs px-2 py-1 rounded-lg text-slate-500">
          {credits.length}
        </span>
      </h3>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto pr-2 min-h-[200px]">
        <SortableContext id={id} items={credits.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
          {credits.map((credit: any) => (
            <SortableInvoiceCard 
              key={credit.id} 
              credit={credit} 
              onSelect={onSelect} 
              onStatusChange={() => {}}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function CreditsPage() {
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
  const [credits, setCredits] = useState<Credit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Dashboard & Profile State
  const [simulatorCash, setSimulatorCash] = useState<string>("");
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<string | null>(null);

  // Bulk Print State
  const [selectedBulkItems, setSelectedBulkItems] = useState<Set<string>>(new Set());
  const [isGeneratingBulkPDF, setIsGeneratingBulkPDF] = useState(false);
  const [bulkCreditsForPrint, setBulkCreditsForPrint] = useState<any[]>([]);

  const handleSelectBulkItem = (id: string) => {
    const newSet = new Set(selectedBulkItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedBulkItems(newSet);
  };

  const handleSelectAllBulkItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBulkItems(new Set(filteredCredits.map((c) => c.id)));
    } else {
      setSelectedBulkItems(new Set());
    }
  };

  // Credit Form
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Credit Form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [tax, setTax] = useState("0");
  const [collectionDate, setCollectionDate] = useState("");
  const [onSalesOnly, setOnSalesOnly] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [poImageUrl, setPoImageUrl] = useState("");
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  const [uploadingPoToOldCredit, setUploadingPoToOldCredit] = useState(false);
  const [selectedCreditForPoUpload, setSelectedCreditForPoUpload] = useState<Credit | null>(null);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const sigPadRef = React.useRef<any>(null);
  const [managerSignature, setManagerSignature] = useState("");
  const [hasSigned, setHasSigned] = useState(false);

  // Payment Form
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<Credit | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTransferFile, setBankTransferFile] = useState<File | null>(null);

  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [selectedCreditForPrint, setSelectedCreditForPrint] = useState<Credit | null>(null);
  const [selectedCreditForView, setSelectedCreditForView] = useState<Credit | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeId = selectedCreditForView && (!selectedCreditForView.invoiceUrl && !((selectedCreditForView.invoiceUrls?.length || 0) > 0)) ? selectedCreditForView.id : null;
      if (!activeId) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          setIsPasting(true);
          const reader = new FileReader();
          reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;
            try {
              const res = await fetch("/api/upload-invoice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentId: activeId,
                  invoiceDataUrls: [dataUrl],
                  type: "credit",
                }),
              });
              if (res.ok) {
                toast.success("Invoice uploaded from clipboard!");
              } else {
                const data = await res.json();
                toast.error(data.error || "Failed to upload invoice");
              }
            } catch (err) {
              console.error(err);
              toast.error("Error uploading invoice");
            } finally {
              setIsPasting(false);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selectedCreditForView]);
  
  // Skeuomorphic States
  const [isCoinDropping, setIsCoinDropping] = useState(false);
  const [isReceiptPrinting, setIsReceiptPrinting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchCredits();
    }
  }, [currentUser, currentBranch, monthFilter]);

  const [creditHistories, setCreditHistories] = useState<Record<string, any[]>>({});

  const fetchCredits = async () => {
    try {
      let q;
      if (monthFilter) {
        const [year, month] = monthFilter.split("-");
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        
        q = branchIds.length > 0
          ? query(collection(db, "credits"), where("storeId", "in", branchIds), where("createdAt", ">=", startDate), where("createdAt", "<=", endDate), orderBy("createdAt", "desc"))
          : query(collection(db, "credits"), where("createdAt", ">=", startDate), where("createdAt", "<=", endDate), orderBy("createdAt", "desc"));
      } else {
        q = branchIds.length > 0
          ? query(collection(db, "credits"), where("storeId", "in", branchIds), orderBy("createdAt", "desc"), limit(500))
          : query(collection(db, "credits"), orderBy("createdAt", "desc"), limit(500));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as any;

        let totalPaid = Number(d.paidAmount || 0);
        const totalDue = Number(d.amountDue || 0) + Number(d.tax || 0);

        let status = d.status || "open";

        // Backwards compatibility for old records that have status='paid' but missing paidAmount
        if (status === "paid" && totalPaid === 0 && totalDue > 0) {
          totalPaid = totalDue;
        }

        // Auto-detect status based on true totalPaid
        if (totalPaid >= totalDue && totalDue > 0) {
          status = "paid";
        } else if (totalPaid > 0 && totalPaid < totalDue) {
          status = "partial";
        } else if (status === "open" && d.collectionDate) {
          const cDate = new Date(d.collectionDate);
          const today = new Date();
          cDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          if (cDate < today) {
            status = "overdue";
          }
        }

        return {
          id: doc.id,
          ...d,
          status,
          paidAmount: totalPaid,
          priceAdjustment: Number(d.priceAdjustment || 0),
          tax: Number(d.tax || 0)
        };
      }) as Credit[];
      setCredits(data);
      if (typeof window !== "undefined") {
        localStorage.setItem('cached_detailed_credits', JSON.stringify(data.slice(0, 50)));
      }

      const uniqueSuppliers = new Set<string>();
      data.forEach(c => {
        if (c.companyName) uniqueSuppliers.add(c.companyName.toUpperCase());
      });
      setSuppliers(Array.from(uniqueSuppliers).sort().map((name, index) => ({ id: `sup_${index}`, name })));

    } catch (err: any) {
      console.error("Error fetching credits:", err);
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
      toast.error("Failed to load credits: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (id: string) => {
    const isExpanding = !expandedCredits[id];
    setExpandedCredits(prev => ({ ...prev, [id]: isExpanding }));

    if (isExpanding && !creditHistories[id]) {
      try {
        const hQuery = query(collection(db, "credit_payments"), where("creditId", "==", id));
        const snap = await getDocs(hQuery);
        const history = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });
        setCreditHistories(prev => ({ ...prev, [id]: history }));
        
        // Recalculate true paid amount from history for accuracy
        const calculatedPaid = history.reduce((sum, payment: any) => sum + Number(payment.amount || 0), 0);
        if (calculatedPaid > 0) {
          setCredits(prev => prev.map(c => {
            if (c.id === id) {
              const newPaid = Math.max(c.paidAmount, calculatedPaid);
              const totalDue = c.amountDue + c.tax;
              return { 
                ...c, 
                paidAmount: newPaid,
                status: newPaid >= totalDue ? "paid" : c.status
              };
            }
            return c;
          }));
        }
      } catch (err) {
        console.error("Failed to load history for credit", id, err);
      }
    }
  };

  const handleAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    const name = newSupplierName.trim().toUpperCase();
    const newSupp = { id: `sup_new_${Date.now()}`, name };
    setSuppliers(prev => [...prev, newSupp].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyName(name);
    setShowAddSupplier(false);
    setNewSupplierName("");
    toast.success("Supplier ready to be used!");
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || !companyName || !amountDue || !collectionDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newCredit = {
        amountDue: parseFloat(amountDue),
        collectionDate,
        companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        invoiceNumber,
        isTaxable,
        onSalesOnly,
        poNumber,
        status: "open",
        storeId: branchIds.length > 0 ? branchIds[0] : "eL-alamein-4",
        tax: parseFloat(tax) || 0,
        paidAmount: 0,
        priceAdjustment: 0,
        managerSignature: managerSignature || (hasSigned && sigPadRef.current ? sigPadRef.current.toDataURL() : null),
        items: poItems,
        poImageUrl
      };

      // Sync products to master DB if we have items
      if (poItems && poItems.length > 0) {
        await syncProductsToMaster(poItems, collectionDate || new Date().toISOString().split('T')[0], companyName);
      }

      const docRef = await addDoc(collection(db, "credits"), newCredit);

      // Dispatch Manager Push Notification & Firestore Event
      const notifTitle = "New Credit Logged 💳";
      const notifBody = `Credit statement of EGP ${Number(amountDue).toLocaleString()} logged for ${companyName}.`;

      addDoc(collection(db, "notifications"), {
        title: notifTitle,
        body: notifBody,
        createdAt: new Date().toISOString(),
        url: "/financials/inputs/credits",
        type: "credit_created"
      }).catch(err => console.debug("Notification doc add error:", err));

      fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          url: "/financials/inputs/credits"
        })
      }).catch(err => console.debug("Push send error:", err));

      fetch("/api/notifications/notify-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody
        })
      }).catch(err => console.debug("Master notify error:", err));

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Create Credit Record",
        "N/A",
        `Supplier: ${companyName}, Amount: EGP ${amountDue}`
      ).catch(() => {});

      const savedCredit = { id: docRef.id, ...newCredit, createdAt: Timestamp.now() } as Credit;
      const updatedCredits = [savedCredit, ...credits];
      setCredits(updatedCredits);
      if (typeof window !== "undefined") {
        localStorage.setItem('cached_detailed_credits', JSON.stringify(updatedCredits.slice(0, 50)));
      }

      toast.success("Credit added & notification sent!");
      setShowAddModal(false);

      // Reset form
      setInvoiceNumber("");
      setPoNumber("");
      setCompanyName("");
      setAmountDue("");
      setTax("0");
      setCollectionDate("");
      setOnSalesOnly(false);
      setIsTaxable(false);
      setPoItems([]);
      setPoImageUrl("");
      
      setManagerSignature("");
      setHasSigned(false);
      if (sigPadRef.current) {
        sigPadRef.current.clear();
      }

    } catch (error) {
      console.error("Error adding credit:", error);
      toast.error("Failed to add credit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCredit = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credit?")) return;
    try {
      const creditItem = credits.find(c => c.id === id);
      await deleteDoc(doc(db, "credits", id));

      const role = typeof window !== "undefined" ? (localStorage.getItem("circlek_role") || "manager") : "manager";
      dbService.logAction(
        auth.currentUser?.email || "Unknown User",
        auth.currentUser?.displayName || "User",
        role,
        "Delete Credit Record",
        `ID: ${id}, Supplier: ${creditItem?.companyName || "N/A"}, Amount: EGP ${creditItem?.amountDue || 0}`,
        "Deleted"
      ).catch(() => {});

      setCredits(credits.filter(c => c.id !== id));
      toast.success("Credit deleted.");
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast.error("Failed to delete.");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setIsProcessingPo(true);
    try {
      const base64Image = await compressImage(file);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("RATE_LIMIT");
          }
          throw new Error('Failed to process PO');
        }

        const data = await response.json();
        
        // User requested to skip saving PO images to storage for faster processing
        setPoImageUrl("");


        if (data.invoiceNumber && data.invoiceNumber !== "UNKNOWN") setInvoiceNumber(data.invoiceNumber);
        if (data.poNumber && data.poNumber !== "UNKNOWN") setPoNumber(data.poNumber);
        if (data.companyName && data.companyName !== "UNKNOWN") {
          setCompanyName(data.companyName.toUpperCase());
          // Auto add supplier to dropdown if not exists
          const name = data.companyName.toUpperCase();
          setSuppliers(prev => {
            if (!prev.find(s => s.name === name)) {
              return [...prev, { id: `sup_auto_${Date.now()}`, name }].sort((a, b) => a.name.localeCompare(b.name));
            }
            return prev;
          });
        }
        
        if (data.amount !== undefined) setAmountDue(data.amount.toString());
        if (data.tax !== undefined) setTax(data.tax.toString());
        if (data.items) setPoItems(data.items);
        
        toast.success('PO processed successfully!');
      } catch (error: any) {
        console.error('Error processing PO:', error);
        if (error.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Failed to extract PO details. Please enter manually.');
        }
      } finally {
        setIsProcessingPo(false);
      }
  };

  const handleUploadPoToOldCredit = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    
    setUploadingPoToOldCredit(true);
    try {
      const base64Image = await compressImage(file);
      const response = await fetch('/api/process-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
        
        if (!response.ok) {
          throw new Error('Failed to process PO');
        }

        const data = await response.json();
        
        // User requested to skip saving PO images to storage for faster processing
        const updateData: any = {
          items: data.items || []
        };
        
        // Only update these fields if they exist and aren't "UNKNOWN"
        if (data.poNumber && data.poNumber !== "UNKNOWN") updateData.poNumber = data.poNumber;
        if (data.invoiceNumber && data.invoiceNumber !== "UNKNOWN") updateData.invoiceNumber = data.invoiceNumber;
        
        // Sync products to master DB
        if (data.items && data.items.length > 0) {
          const poDateForSync = selectedCreditForPoUpload?.collectionDate || new Date().toISOString().split('T')[0];
          await syncProductsToMaster(data.items, poDateForSync, selectedCreditForPoUpload?.companyName || "Unknown Supplier");
        }

        // Update the document
        if (selectedCreditForPoUpload) {
          await updateDoc(doc(db, "credits", selectedCreditForPoUpload.id), updateData);
          
          // Refresh local state
          setCredits(prev => prev.map(c => 
            c.id === selectedCreditForPoUpload.id ? { ...c, ...updateData } : c
          ));
          toast.success('PO added to credit and products synchronized!');
        }
      } catch (error: any) {
        console.error('Error adding PO to old credit:', error);
        if (error.message === 'RATE_LIMIT') {
          toast.error("Google AI is busy (Rate Limit). Please wait 60 seconds and try again.");
        } else {
          toast.error('Failed to add PO to credit.');
        }
      } finally {
        setUploadingPoToOldCredit(false);
        setSelectedCreditForPoUpload(null);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePastePoImageButtonClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          if (selectedCreditForPoUpload) {
            handleUploadPoToOldCredit(file);
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

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (selectedCreditForPoUpload || showAddModal) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              if (selectedCreditForPoUpload) {
                handleUploadPoToOldCredit(file);
              } else if (showAddModal) {
                handleImageUpload(file);
              }
            }
            break;
          }
        }
        return;
      }
      
      if (showPaymentModal) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file && paymentMethod === 'bank_transfer') {
              e.preventDefault();
              setBankTransferFile(file);
              toast.success("Bank transfer receipt pasted!");
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [selectedCreditForPoUpload, showAddModal, showPaymentModal, paymentMethod]);

  const handlePasteBankReceipt = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-bank-receipt.png", { type: imageType });
          setBankTransferFile(file);
          toast.success('Bank transfer receipt pasted successfully!');
          return;
        }
      }
      toast.error('No image found in clipboard');
    } catch (err) {
      console.error(err);
      toast.error('Failed to read clipboard. Please use Ctrl+V / Cmd+V directly or upload a file.');
    }
  };

  const handleOpenPaymentModal = (credit: Credit) => {
    setSelectedCreditForPayment(credit);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));

    // Suggest the remaining amount
    const remaining = (credit.amountDue + credit.tax) - credit.paidAmount;
    setPaymentAmount(remaining.toString());
    setPaymentMethod("cash");
    setBankTransferFile(null);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditForPayment) return;
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const pAmt = parseFloat(paymentAmount);
      const newPaidAmount = selectedCreditForPayment.paidAmount + pAmt;
      const totalDue = selectedCreditForPayment.amountDue + selectedCreditForPayment.tax;

      let newStatus = selectedCreditForPayment.status;
      if (newPaidAmount >= totalDue) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      // 1. Update Credit Document
      await updateDoc(doc(db, "credits", selectedCreditForPayment.id), {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      let bankTransferReceiptUrl = null;

      if (paymentMethod === 'bank_transfer' && bankTransferFile) {
        toast.loading("Processing bank transfer receipt...", { id: "bank-upload" });
        bankTransferReceiptUrl = await compressImage(bankTransferFile, 800, 0.6);
        toast.dismiss("bank-upload");
      }

      // 2. Add to Cash Payments
      const paymentRecord = {
        amount: pAmt,
        category: "credit",
        categoryNote: `Credit Payment - Inv #${selectedCreditForPayment.invoiceNumber} - ${selectedCreditForPayment.companyName}`,
        companyName: selectedCreditForPayment.companyName,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date: paymentDate,
        description: `Credit Payment`,
        invoiceNumber: selectedCreditForPayment.invoiceNumber,
        isTaxable: Number(selectedCreditForPayment.tax) > 0,
        method: paymentMethod,
        poNumber: selectedCreditForPayment.poNumber,
        poImageUrl: selectedCreditForPayment.poImageUrl || "",
        supplierRepName: selectedCreditForPayment.supplierRepName || "",
        supplierNationalId: selectedCreditForPayment.supplierNationalId || "",
        items: selectedCreditForPayment.items || [],
        storeId: branchIds.length > 0 && branchIds[0] !== "all" ? branchIds[0] : "eL-alamein-4",
        tax: Number(selectedCreditForPayment.tax) || 0,
        total: pAmt,
        creditId: selectedCreditForPayment.id,
        ...(bankTransferReceiptUrl ? { bankTransferReceiptUrl } : {})
      };
      await addDoc(collection(db, "cash_payments"), paymentRecord);

      // 3. Add to Credit Payments History
      await addDoc(collection(db, "credit_payments"), {
        creditId: selectedCreditForPayment.id,
        amount: pAmt,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "unknown",
        date: paymentDate,
        method: paymentMethod,
        ...(bankTransferReceiptUrl ? { bankTransferReceiptUrl } : {})
      });

      // Trigger Skeuomorphic effects
      setIsCoinDropping(true);
      setTimeout(() => {
        setIsCoinDropping(false);
        setIsReceiptPrinting(true);
        setTimeout(() => setIsReceiptPrinting(false), 3000);
      }, 1500);

      // Refresh data
      await fetchCredits();
      
      // Refresh history if expanded
      if (expandedCredits[selectedCreditForPayment.id]) {
        const hQuery = query(collection(db, "credit_payments"), where("creditId", "==", selectedCreditForPayment.id));
        const snap = await getDocs(hQuery);
        const history = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          }
          return 0;
        });
        setCreditHistories(prev => ({ ...prev, [selectedCreditForPayment.id]: history }));
      }
      toast.success("Payment processed successfully!");
      setShowPaymentModal(false);
      setSelectedCreditForPayment(null);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to process payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPdf = async (credit: Credit) => {
    setSelectedCreditForPrint(credit);
    setIsPrinting(true);

    setTimeout(async () => {
      try {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const page1 = document.getElementById("print-credit-container");
        
        if (page1) {
          page1.style.left = "0";
          const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true });
          const imgData1 = canvas1.toDataURL("image/png");
          const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
          pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
          page1.style.left = "-9999px";
        }

        const invoiceUrls = selectedCreditForPrint?.poUrls && selectedCreditForPrint.poUrls.length > 0 
          ? selectedCreditForPrint.poUrls 
          : (selectedCreditForPrint?.poUrl ? [selectedCreditForPrint.poUrl] : []);

        for (let i = 0; i < invoiceUrls.length; i++) {
          const pageInvoice = document.getElementById(`print-credit-invoice-page-${i}`);
          if (pageInvoice) {
            pageInvoice.style.left = "0";
            const canvasInvoice = await html2canvas(pageInvoice, { scale: 2, useCORS: true });
            const imgDataInvoice = canvasInvoice.toDataURL("image/png");
            const pdfHeightInvoice = (canvasInvoice.height * pdfWidth) / canvasInvoice.width;
            pdf.addPage();
            pdf.addImage(imgDataInvoice, "PNG", 0, 0, pdfWidth, pdfHeightInvoice);
            pageInvoice.style.left = "-9999px";
          }
        }

        let itemsPageIndex = 0;
        while (true) {
          const pageItems = document.getElementById(`print-credit-items-page-${itemsPageIndex}`);
          if (!pageItems) break;
          
          pageItems.style.left = "0";
          const canvasItems = await html2canvas(pageItems, { scale: 2, useCORS: true });
          const imgDataItems = canvasItems.toDataURL("image/png");
          const pdfHeightItems = (canvasItems.height * pdfWidth) / canvasItems.width;
          pdf.addPage();
          pdf.addImage(imgDataItems, "PNG", 0, 0, pdfWidth, pdfHeightItems);
          pageItems.style.left = "-9999px";
          
          itemsPageIndex++;
        }

        pdf.autoPrint();
        window.open(pdf.output("bloburl"), "_blank");
      } catch (error) {
        toast.error("Failed to generate PDF.");
      } finally {
        setIsPrinting(false);
        setSelectedCreditForPrint(null);
      }
    }, 500);
  };

  const generateBulkPDF = async () => {
    if (selectedBulkItems.size === 0) return;
    setIsGeneratingBulkPDF(true);
    
    // Gather all selected credits
    const creditsToPrint = filteredCredits.filter(c => selectedBulkItems.has(c.id));
    setBulkCreditsForPrint(creditsToPrint);
    
    // Give React a moment to render the hidden bulk layout
    setTimeout(async () => {
      try {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        // Render Cover Page
        const coverPage = document.getElementById("pdf-bulk-cover-credits");
        if (coverPage) {
          coverPage.style.left = "0";
          const canvas = await html2canvas(coverPage, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL("image/png");
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
          coverPage.style.left = "-9999px";
        }
        
        // Render each credit
        for (let i = 0; i < creditsToPrint.length; i++) {
          const c = creditsToPrint[i];
          const pageId = `pdf-bulk-credit-${c.id}`;
          const page1 = document.getElementById(pageId);
          if (page1) {
            page1.style.left = "0";
            const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true });
            const imgData1 = canvas1.toDataURL("image/png");
            const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
            pdf.addPage();
            pdf.addImage(imgData1, "PNG", 0, 0, pdfWidth, pdfHeight1);
            page1.style.left = "-9999px";
          }
          
          // Render invoices for this credit
          const invoiceUrls = c.invoiceUrls && c.invoiceUrls.length > 0 ? c.invoiceUrls : (c.invoiceUrl ? [c.invoiceUrl] : []);
          for (let j = 0; j < invoiceUrls.length; j++) {
            const invPage = document.getElementById(`pdf-bulk-credit-${c.id}-invoice-${j}`);
            if (invPage) {
              invPage.style.left = "0";
              const canvasInv = await html2canvas(invPage, { scale: 2, useCORS: true });
              const imgDataInv = canvasInv.toDataURL("image/png");
              const pdfHeightInv = (canvasInv.height * pdfWidth) / canvasInv.width;
              pdf.addPage();
              pdf.addImage(imgDataInv, "PNG", 0, 0, pdfWidth, pdfHeightInv);
              invPage.style.left = "-9999px";
            }
          }
        }
        
        pdf.save(`Bulk_Credits_Report_${new Date().getTime()}.pdf`);
        toast.success("Bulk PDF generated successfully!");
      } catch (err) {
        toast.error("Error generating bulk PDF.");
        console.error(err);
      } finally {
        setIsGeneratingBulkPDF(false);
        setBulkCreditsForPrint([]); // clear
        setSelectedBulkItems(new Set()); // clear selection
      }
    }, 1000); // 1000ms for react to render
  };

  // Derived Stats
  const stats = useMemo(() => {
    let outstanding = 0;
    let pending = 0;
    let partial = 0;
    let collected = 0;
    let overdue = 0;
    let salesOnly = 0;

    let outstandingCount = 0;
    let pendingCount = 0;
    let partialCount = 0;
    let collectedCount = 0;
    let overdueCount = 0;
    let salesOnlyCount = 0;

    credits.forEach(c => {
      const total = c.amountDue + c.tax;
      const remaining = total - c.paidAmount;

      if (c.onSalesOnly) {
        salesOnly += remaining;
        salesOnlyCount++;
        return; // Skip other stats if sales only
      }

      if (c.status === "paid") {
        collected += c.paidAmount;
        collectedCount++;
      } else if (c.status === "partial") {
        partial += remaining;
        partialCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "overdue") {
        overdue += remaining;
        overdueCount++;
        outstanding += remaining;
        outstandingCount++;
      } else if (c.status === "pending") {
        pending += remaining;
        pendingCount++;
      } else {
        outstanding += remaining;
        outstandingCount++;
      }
    });

    return {
      outstanding: { amount: outstanding, count: outstandingCount },
      pending: { amount: pending, count: pendingCount },
      partial: { amount: partial, count: partialCount },
      collected: { amount: collected, count: collectedCount },
      overdue: { amount: overdue, count: overdueCount },
      salesOnly: { amount: salesOnly, count: salesOnlyCount }
    };
  }, [credits]);

  const filteredCredits = credits.filter(c => {
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== "all") {
      if (statusFilter === "salesOnly") matchesStatus = c.onSalesOnly;
      else matchesStatus = c.status === statusFilter && !c.onSalesOnly;
    }

    return matchesSearch && matchesStatus;
  });

  // Derived Dashboard Data
  const dashboardData = useMemo(() => {
    let age0_15 = 0;
    let age16_30 = 0;
    let age30Plus = 0;
    const waterfallMap: Record<string, number> = {};

    const now = new Date();

    credits.forEach(c => {
      if (c.status === "paid" || c.onSalesOnly) return;
      const remaining = (c.amountDue + c.tax) - c.paidAmount;
      if (remaining <= 0) return;

      const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      const diffTime = Math.abs(now.getTime() - created.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 15) age0_15 += remaining;
      else if (diffDays <= 30) age16_30 += remaining;
      else age30Plus += remaining;

      const expectedDate = c.collectionDate ? new Date(c.collectionDate) : new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expectedDateStr = expectedDate.toISOString().split("T")[0];
      if (!waterfallMap[expectedDateStr]) waterfallMap[expectedDateStr] = 0;
      waterfallMap[expectedDateStr] += remaining;
    });

    const agingChartData = [
      { name: "0-15 Days", amount: age0_15, color: "#10b981" },
      { name: "16-30 Days", amount: age16_30, color: "#eab308" },
      { name: "30+ Days", amount: age30Plus, color: "#ef4444" }
    ];

    const waterfallChartData = Object.keys(waterfallMap).sort().slice(0, 30).map(date => {
      return { date, amount: waterfallMap[date] };
    });

    return { agingChartData, waterfallChartData };
  }, [credits]);

  // Smart Simulator Logic
  const simulatorResults = useMemo(() => {
    if (!simulatorCash || isNaN(Number(simulatorCash))) return [];
    let cash = Number(simulatorCash);
    if (cash <= 0) return [];
    
    const openInvoices = credits.filter(c => c.status !== "paid" && !c.onSalesOnly).map(c => {
      const remaining = (c.amountDue + c.tax) - c.paidAmount;
      const created = c.createdAt?.toDate ? c.createdAt.toDate().getTime() : new Date(c.createdAt).getTime();
      return { ...c, remaining, created };
    }).sort((a, b) => a.created - b.created);

    const plan = [];
    for (const inv of openInvoices) {
      if (cash <= 0) break;
      if (cash >= inv.remaining) {
        plan.push({ credit: inv, payAmount: inv.remaining, type: "Full" });
        cash -= inv.remaining;
      } else {
        plan.push({ credit: inv, payAmount: cash, type: "Partial" });
        cash = 0;
      }
    }
    return plan;
  }, [simulatorCash, credits]);

  const selectedSupplierData = useMemo(() => {
    if (!selectedSupplierProfile) return null;
    const supplierCredits = credits.filter(c => c.companyName === selectedSupplierProfile);
    let totalVolume = 0;
    let totalDebt = 0;
    let totalDaysToPay = 0;
    let paidCount = 0;

    supplierCredits.forEach(c => {
      const total = c.amountDue + c.tax;
      totalVolume += total;
      totalDebt += total - c.paidAmount;
      
      if (c.status === 'paid' && c.payments && c.payments.length > 0) {
        const created = c.createdAt?.toDate ? c.createdAt.toDate().getTime() : new Date(c.createdAt).getTime();
        const lastPayment = c.payments[c.payments.length - 1];
        const paidDate = new Date(lastPayment.date).getTime();
        totalDaysToPay += (paidDate - created) / (1000 * 60 * 60 * 24);
        paidCount++;
      }
    });

    const avgDaysToPay = paidCount > 0 ? totalDaysToPay / paidCount : 30;
    const trustScore = Math.max(0, 100 - (avgDaysToPay > 30 ? (avgDaysToPay - 30) * 2 : 0) - (totalDebt > totalVolume * 0.5 ? 20 : 0));

    return {
      name: selectedSupplierProfile,
      totalVolume,
      totalDebt,
      avgDaysToPay: Math.round(avgDaysToPay),
      trustScore: Math.round(trustScore),
      radarData: [
        { subject: 'Speed', A: Math.max(0, 100 - avgDaysToPay), fullMark: 100 },
        { subject: 'Volume', A: Math.min(100, (totalVolume / 100000) * 100), fullMark: 100 },
        { subject: 'Trust', A: trustScore, fullMark: 100 },
        { subject: 'Health', A: 100 - ((totalDebt / (totalVolume || 1)) * 100), fullMark: 100 },
      ]
    };
  }, [selectedSupplierProfile, credits]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const creditId = active.id as string;
    const newStatus = over.id as string;
    
    const credit = credits.find(c => c.id === creditId);
    if (!credit) return;
    
    if (credit.status !== newStatus && ['open', 'pending', 'paid'].includes(newStatus)) {
      setCredits(prev => prev.map(c => c.id === creditId ? { ...c, status: newStatus as any } : c));
      try {
        await updateDoc(doc(db, "credits", creditId), { status: newStatus });
        toast.success(`Invoice moved to ${newStatus}`);
      } catch (e) {
        toast.error("Failed to move invoice");
        fetchCredits();
      }
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans print:hidden">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Header & Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Credits Management</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Track, manage, and collect outstanding corporate credits.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-slate-200/60 text-slate-700 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-white hover:border-slate-300 transition-all">
                <FileDown size={18} /> Export
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all"
              >
                <Plus size={20} /> Add Credit
              </button>
            </div>
          </div>

          {/* ADVANCED DASHBOARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Credit Aging Dashboard */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 p-6 rounded-3xl shadow-sm lg:col-span-1">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                <AlertCircle size={20} className="text-rose-500" />
                Credit Aging
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.agingChartData} margin={{top:10, right:10, left:-20, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="amount" radius={[6,6,6,6]}>
                      {dashboardData.agingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Debt Waterfall */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 p-6 rounded-3xl shadow-sm lg:col-span-1">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                <Calendar size={20} className="text-sky-500" />
                30-Day Debt Waterfall
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.waterfallChartData} margin={{top:10, right:10, left:-20, bottom:0}}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(val) => val.split('-').slice(1).join('/')} tick={{fontSize:12, fill:'#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#64748b'}} tickFormatter={(val) => `£${(val/1000).toFixed(0)}k`} />
                    <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Smart Payment Simulator */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-indigo-100 dark:border-slate-700 p-6 rounded-3xl shadow-sm lg:col-span-1 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Banknote size={100} /></div>
              <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-2 relative z-10">
                <Banknote size={20} /> Smart Settle Simulator
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 relative z-10">Type your available cash. We'll suggest the perfect payment plan.</p>
              
              <div className="relative z-10 flex gap-2 mb-4">
                <input 
                  type="number"
                  placeholder="e.g. 20000"
                  value={simulatorCash}
                  onChange={(e) => setSimulatorCash(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2 relative z-10 max-h-40">
                {simulatorResults.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm mt-8">Awaiting cash input...</div>
                ) : (
                  simulatorResults.map((res, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/50">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white capitalize">{res.credit.companyName}</p>
                        <p className="text-[10px] text-slate-500">{res.type} Payment</p>
                      </div>
                      <p className="text-sm font-black text-indigo-600">EGP {res.payAmount.toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>

          {/* Premium Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-rose-50 to-orange-50 border border-orange-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertCircle size={48} className="text-orange-600" /></div>
              <div className="flex items-center gap-2 text-orange-600 mb-3">
                <AlertCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Outstanding</p>
              </div>
              <div className="flex items-center gap-1 relative z-10">
                <span className="text-xl font-bold text-slate-900 tracking-tight mt-1">EGP</span>
                <AnalogOdometer value={stats.outstanding.amount} />
              </div>
              <p className="text-xs font-semibold text-orange-600/70 mt-1 relative z-10">{stats.outstanding.count} open invoices</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-sky-50 to-blue-50 border border-blue-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={48} className="text-blue-600" /></div>
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <Clock size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Pending</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.pending.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-blue-600/70 mt-1 relative z-10">{stats.pending.count} awaiting clear</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><PieChart size={48} className="text-amber-600" /></div>
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <PieChart size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Partial</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.partial.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-amber-600/70 mt-1 relative z-10">{stats.partial.count} partially paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={48} className="text-emerald-600" /></div>
              <div className="flex items-center gap-2 text-emerald-600 mb-3">
                <CheckCircle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Collected</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.collected.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-emerald-600/70 mt-1 relative z-10">{stats.collected.count} fully paid</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle size={48} className="text-red-600" /></div>
              <div className="flex items-center gap-2 text-red-600 mb-3">
                <AlertTriangle size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Overdue</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.overdue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-red-600/70 mt-1 relative z-10">{stats.overdue.count} past due date</p>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Building size={48} className="text-violet-600" /></div>
              <div className="flex items-center gap-2 text-violet-600 mb-3">
                <Building size={18} className="drop-shadow-sm" />
                <p className="text-sm font-bold tracking-wide uppercase">Sales Only</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight relative z-10">EGP {stats.salesOnly.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs font-semibold text-violet-600/70 mt-1 relative z-10">{stats.salesOnly.count} active accounts</p>
            </motion.div>
          </div>

          {/* Unified Command Bar (Filters) */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2 items-center">
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>List</button>
              <button onClick={() => setViewMode('board')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'board' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Board</button>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search company or invoice..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent focus:bg-white hover:bg-slate-50 transition-colors border-none outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="w-full md:w-64 px-4 py-3 rounded-xl bg-transparent hover:bg-slate-50 focus:bg-white transition-colors border-none outline-none text-slate-700 font-bold cursor-pointer appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">⚡ All Statuses</option>
              <option value="open">Open Credits</option>
              <option value="pending">Pending Payments</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Paid</option>
              <option value="overdue">⚠️ Overdue</option>
              <option value="salesOnly">🏢 Sales Only Accounts</option>
            </select>
          </div>

        {/* Credits Data View */}
        {selectedBulkItems.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 mb-4">
            <div className="flex items-center gap-3 text-blue-700">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold">
                {selectedBulkItems.size}
              </div>
              <span className="font-bold text-sm">Credits Selected</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedBulkItems(new Set())}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Clear
              </button>
              <button 
                onClick={generateBulkPDF}
                disabled={isGeneratingBulkPDF}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {isGeneratingBulkPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer size={16} />}
                {isGeneratingBulkPDF ? 'Generating...' : 'Bulk Print PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Mobile Summary Cards & Status Filters (Strictly md:hidden) */}
        <div className="md:hidden space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-orange-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Outstanding</p>
              <p className="text-sm font-black font-mono text-orange-400 mt-0.5">
                EGP {stats.outstanding.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-amber-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Partial</p>
              <p className="text-sm font-black font-mono text-amber-400 mt-0.5">
                EGP {stats.partial.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B1121] border border-rose-500/30">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase">Overdue</p>
              <p className="text-sm font-black font-mono text-rose-400 mt-0.5">
                EGP {stats.overdue.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Cards Container (Strictly md:hidden) */}
        <div className="md:hidden space-y-3">
          {filteredCredits.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-[#0B1121] border border-[#1E293B]">
              No credit records found.
            </div>
          ) : (
            filteredCredits.map((credit) => {
              const totalDue = credit.amountDue + credit.tax;
              const remaining = totalDue - credit.paidAmount;
              const isPaid = remaining <= 0;

              return (
                <div
                  key={credit.id}
                  className="p-4 rounded-2xl bg-[#0B1121] border border-[#1E293B] shadow-xl space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-sm text-white tracking-tight capitalize truncate">
                        {credit.companyName}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                        Date: {credit.date} {credit.invoiceNumber ? `• Inv: ${credit.invoiceNumber}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full border shrink-0 ${
                      isPaid
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : remaining < totalDue
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    }`}>
                      {isPaid ? "Paid" : remaining < totalDue ? "Partial" : "Open"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#0F172A] p-2.5 rounded-xl border border-[#1E293B]">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invoice</p>
                      <p className="text-sm font-black font-mono text-slate-200 truncate">
                        EGP {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Remaining Debt</p>
                      <p className={`text-sm font-black font-mono truncate ${remaining > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        EGP {remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E293B]">
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {(credit as any).dueDate ? `Due: ${(credit as any).dueDate}` : `Date: ${credit.date}`}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCreditForView(credit);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-black flex items-center gap-1 active:scale-95 transition-transform shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> Statement
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {viewMode === 'list' && (
          <div className="hidden md:flex items-center gap-3 px-2 mb-2">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded text-blue-600 cursor-pointer"
              checked={filteredCredits.length > 0 && selectedBulkItems.size === filteredCredits.length}
              onChange={handleSelectAllBulkItems}
            />
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">
              Select All ({filteredCredits.length})
            </h2>
          </div>
        )}

        {/* Desktop Container (Strictly hidden md:block) */}
        <div className="hidden md:block">
          {viewMode === 'list' ? (
            <div className="space-y-4">
            <AnimatePresence>
              {filteredCredits.map((credit, idx) => {
              const isExpanded = expandedCredits[credit.id];
              const totalDue = credit.amountDue + credit.tax;
              const remaining = totalDue - credit.paidAmount;

              // Generate Company Initials for Avatar
              const initials = credit.companyName.substring(0, 2).toUpperCase();
              const colors = [
                'bg-indigo-100 text-indigo-700 border-indigo-200', 
                'bg-rose-100 text-rose-700 border-rose-200', 
                'bg-emerald-100 text-emerald-700 border-emerald-200',
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-blue-100 text-blue-700 border-blue-200'
              ];
              const avatarColor = colors[credit.companyName.charCodeAt(0) % colors.length];

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  key={credit.id} 
                  className={`bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group ${selectedBulkItems.has(credit.id) ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200/60'}`}
                >
                  {/* Row Summary */}
                  <div className="p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                    
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-4 flex-1">
                      <input 
                        type="checkbox" 
                        checked={selectedBulkItems.has(credit.id)}
                        onChange={() => handleSelectBulkItem(credit.id)}
                        className="w-5 h-5 rounded text-blue-600 cursor-pointer mr-2 flex-shrink-0"
                      />
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-black text-lg tracking-tight flex-shrink-0 ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <button onClick={() => setSelectedSupplierProfile(credit.companyName)} className="text-lg font-bold text-slate-900 capitalize tracking-tight text-left hover:text-indigo-600 transition-colors underline decoration-dotted decoration-indigo-300 underline-offset-4">
                            {credit.companyName}
                          </button>
                          
                          {/* Modern Badges */}
                          {credit.status === 'paid' && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle size={12}/> Paid</span>}
                          {credit.status === 'pending' && <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Clock size={12}/> Pending</span>}
                          {credit.status === 'partial' && <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><PieChart size={12}/> Partial</span>}
                          {credit.status === 'overdue' && <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={12}/> Overdue</span>}
                          {credit.status === 'open' && <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><AlertCircle size={12}/> Open</span>}

                          {credit.onSalesOnly && (
                            <span className="bg-violet-50 text-violet-600 border border-violet-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Building size={12}/> Sales Only</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" /> Inv: {credit.invoiceNumber} 
                          {credit.poNumber && <><span className="text-slate-300">•</span> PO: {credit.poNumber}</>} 
                          <span className="text-slate-300">•</span> Due: {credit.collectionDate}
                        </p>
                      </div>
                    </div>

                    {/* Right: Financials & Actions */}
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                          <span className="text-sm font-medium text-slate-400 mr-1">EGP</span>
                          {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm font-medium text-slate-500 flex items-center justify-end gap-1">
                          Paid: <span className="text-emerald-600 font-bold">{credit.paidAmount.toLocaleString()}</span>
                        </p>
                      </div>
                      
                      {/* Action Dropdown / Buttons */}
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedCreditForView(credit)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                          <Eye size={20} />
                        </button>
                        <button onClick={() => handlePrintPdf(credit)} disabled={isPrinting} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50">
                          <Printer size={20} />
                        </button>
                        {!(typeof window !== "undefined" && localStorage.getItem("circlek_role") === "manager") && (
<button onClick={() => handleDeleteCredit(credit.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 size={20} />
                        </button>
)}
                        <button
                          onClick={() => toggleExpand(credit.id)}
                          className={`p-2.5 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Area */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 bg-slate-50/50"
                      >
                        <div className="p-5 md:p-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                              <p className="font-black text-slate-900">EGP {credit.amountDue.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax</p>
                              <p className="font-black text-slate-900">EGP {credit.tax.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Remaining</p>
                              <p className="font-black text-red-600">EGP {remaining.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                              <p className="font-bold text-slate-900 flex items-center gap-2">
                                {credit.onSalesOnly ? <><Building size={14} className="text-violet-500"/> Sales Only</> : <><CreditCard size={14} className="text-indigo-500"/> Standard</>}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200 pt-6 mb-4">
                            <h4 className="font-bold text-slate-900 flex items-center gap-2">
                              <Banknote className="text-slate-400"/> Payment History
                            </h4>
                            {credit.status !== "paid" && (
                              <button
                                onClick={() => handleOpenPaymentModal(credit)}
                                className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                              >
                                <Plus size={16} /> Record Payment
                              </button>
                            )}
                          </div>
                          
                          {creditHistories[credit.id] && creditHistories[credit.id].length > 0 ? (
                            <div className="space-y-2">
                              {creditHistories[credit.id].map((payment, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                      <CheckCircle size={18} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 font-mono tracking-tight">EGP {Number(payment.amount).toLocaleString()}</p>
                                      <p className="text-xs font-medium text-slate-500 flex items-center gap-1"><Calendar size={12}/> {payment.date} <span className="px-1 text-slate-300">•</span> {payment.method?.toUpperCase()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {payment.bankTransferReceiptUrl && (
                                      <button 
                                        onClick={() => {
                                          const newTab = window.open();
                                          if (newTab) {
                                            newTab.document.write(`<!DOCTYPE html><html><head><title>Bank Transfer Receipt</title></head><body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0f172a;"><img src="${payment.bankTransferReceiptUrl}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" /></body></html>`);
                                            newTab.document.close();
                                          }
                                        }}
                                        className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
                                      >
                                        <FileText size={12}/> Receipt
                                      </button>
                                    )}
                                    <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">Paid</span>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-200">
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Paid</span>
                                <span className="text-lg font-black text-emerald-600 tracking-tight">EGP {credit.paidAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                              <p className="text-sm font-bold text-slate-400">No payments recorded yet</p>
                            </div>
                          )}

                          {/* PO Items & Image Area */}
                          <div className="border-t border-slate-200 pt-6 mt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                <ImageIcon className="text-slate-400"/> Purchase Order Details
                              </h4>
                              {(!credit.items || credit.items.length === 0) && !credit.poImageUrl && (
                                <button
                                  onClick={() => setSelectedCreditForPoUpload(credit)}
                                  className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
                                >
                                  + Add PO
                                </button>
                              )}
                            </div>

                            {credit.items && credit.items.length > 0 && (
                              <div className="overflow-x-auto border border-slate-100 bg-white rounded-2xl mb-6 shadow-sm">
                                <table className="w-full text-sm text-left">
                                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100 uppercase font-bold">
                                    <tr>
                                      <th className="px-4 py-3">Barcode</th>
                                      <th className="px-4 py-3">Description</th>
                                      <th className="px-4 py-3 text-center">Qty</th>
                                      <th className="px-4 py-3 text-right">Unit Price</th>
                                      <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {credit.items.map((item: any, idx: number) => (
                                      <tr key={idx} className="border-b border-slate-50 last:border-0 font-medium">
                                        <td className="px-4 py-3 text-slate-500">{item.barcode || "N/A"}</td>
                                        <td className="px-4 py-3 text-slate-900">{item.description || "N/A"}</td>
                                        <td className="px-4 py-3 text-center text-slate-900">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-900">{Number(item.unitPrice).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {credit.poImageUrl && (
                              <div className="mt-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Scanned PO Image</p>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white flex justify-center p-2 shadow-sm">
                                  { }
                                  <img 
                                    src={credit.poImageUrl} 
                                    alt="PO Document" 
                                    className="max-w-full h-auto object-contain max-h-[600px] rounded-xl"
                                  />
                                </div>
                              </div>
                            )}
                            
                            {(!credit.items || credit.items.length === 0) && !credit.poImageUrl && (
                              <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300">
                                <p className="text-sm font-bold text-slate-400">No PO attached</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredCredits.length === 0 && (
            <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-200 border-dashed">
              <AlertCircle className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-500 font-bold text-lg">No credits found.</p>
              <p className="text-slate-400 text-sm">Try adjusting your search or filters.</p>
            </div>
          )}

        </div>
        ) : (
          /* KANBAN BOARD VIEW */
          <div className="h-[700px] overflow-hidden flex gap-4">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <DroppableColumn 
                id="open" 
                title="Open Invoices" 
                credits={filteredCredits.filter(c => c.status === 'open' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
              <DroppableColumn 
                id="pending" 
                title="Pending Payment" 
                credits={filteredCredits.filter(c => c.status === 'pending' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
              <DroppableColumn 
                id="paid" 
                title="Paid Invoices" 
                credits={filteredCredits.filter(c => c.status === 'paid' && !c.onSalesOnly)} 
                onSelect={(c) => setSelectedSupplierProfile(c.companyName)} 
              />
            </DndContext>
          </div>
        )}
        </div>
      </div>

      {/* ADD CREDIT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[95vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Record New Credit</h2>
                  <p className="text-xs font-bold text-indigo-600/70 mt-1 uppercase tracking-wider">Fill in details or upload PO</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 bg-white/60 hover:bg-white text-indigo-400 hover:text-indigo-600 rounded-full transition-all shadow-sm">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCredit} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <div 
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`mb-6 border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${isProcessingPo ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60'}`}
                >
                  {isProcessingPo ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-indigo-600">
                      <div className="p-3 bg-indigo-100 rounded-full mb-2">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                      <span className="font-black text-lg tracking-tight">Reading Purchase Order...</span>
                      <span className="text-sm font-medium text-indigo-500/80">Extracting details automatically</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-indigo-900/60">
                      <div className="p-4 bg-white shadow-sm rounded-full mb-2 text-indigo-500">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                      <span className="font-black text-lg text-indigo-900 tracking-tight">Paste or Drop PO Image Here</span>
                      <span className="text-sm font-medium">We'll automatically extract the details using AI</span>
                      <button
                        type="button"
                        onClick={handlePastePoImageButtonClick}
                        className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-md text-indigo-700 font-bold rounded-xl transition-all text-sm group"
                      >
                        <ClipboardPaste size={16} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                        Paste from Clipboard
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Invoice # *</label>
                    <input required type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PO #</label>
                    <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Company *</label>
                      <button type="button" onClick={() => setShowAddSupplier(true)} className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                        + New Supplier
                      </button>
                    </div>
                    <select required className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                      <option value="">Select a supplier...</option>
                      {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount Due *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                      <input required type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-black text-slate-900" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tax</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">EGP</span>
                      <input type="number" step="0.01" className="w-full pl-12 pr-4 p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={tax} onChange={(e) => setTax(e.target.value)} />
                    </div>
                  </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Collection Date</label>
                      <input required type="date" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-medium text-slate-900" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[14, 15, 30, 45].map(days => (
                          <button 
                            key={days} 
                            type="button" 
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + days);
                              setCollectionDate(d.toISOString().split('T')[0]);
                            }}
                            className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
                          >
                            +{days} Days
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {poItems && poItems.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-sm font-bold text-slate-700 mb-2">Extracted PO Items</h4>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="p-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Description</th>
                              <th className="p-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-center">Qty</th>
                              <th className="p-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider text-right">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poItems.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/50 transition-colors">
                                <td className="p-3 text-slate-900 font-medium text-xs">{item.description || item.barcode || 'Unknown Item'}</td>
                                <td className="p-3 text-slate-600 font-bold text-xs text-center">{item.quantity || 0}</td>
                                <td className="p-3 text-indigo-600 font-bold text-xs text-right whitespace-nowrap">{item.unitPrice ? `${item.unitPrice} EGP` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-6 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={onSalesOnly} onChange={(e) => setOnSalesOnly(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-300 bg-white peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-700 font-bold group-hover:text-slate-900 transition-colors">On Sales Only</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} className="peer sr-only" />
                      <div className="w-6 h-6 rounded-md border-2 border-slate-300 bg-white peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors"></div>
                      <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-slate-700 font-bold group-hover:text-slate-900 transition-colors">Is Taxable?</span>
                  </label>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Manager Signature *</label>
                    {(managerSignature || hasSigned) && (
                      <button type="button" onClick={() => { sigPadRef.current?.clear(); setHasSigned(false); setManagerSignature(""); }} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold uppercase hover:bg-red-100 transition-colors">
                        Clear Signature
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-200 bg-slate-50 rounded-xl overflow-hidden relative shadow-inner" style={{ height: "150px" }}>
                    {managerSignature && !hasSigned ? (
                      <img src={managerSignature} alt="Saved Signature" className="w-full h-full object-contain p-4" />
                    ) : (
                      <SignaturePad 
                        // @ts-expect-error: dynamic import ref typing mismatch
                        ref={sigPadRef} 
                        canvasProps={{ className: "w-full h-full cursor-crosshair" }} 
                        onBegin={() => setHasSigned(true)}
                        onEnd={() => {
                          if (sigPadRef.current) {
                            setManagerSignature(sigPadRef.current.toDataURL());
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 mt-auto">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    Save Credit
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAKE PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && selectedCreditForPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[95vh] relative"
            >
              {/* Skeuomorphic Overlays */}
              {isCoinDropping && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm">
                  <CoinDropWallet isDropping={isCoinDropping} onComplete={() => setShowPaymentModal(false)} />
                </div>
              )}
              {isReceiptPrinting && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm">
                  <PosReceiptPrinter isPrinting={isReceiptPrinting} />
                </div>
              )}
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Make Payment</h2>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleProcessPayment} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100/50 mb-6 shadow-inner">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Paying For</p>
                  <p className="text-lg text-indigo-900 font-black tracking-tight">{selectedCreditForPayment.companyName}</p>
                  <p className="text-sm font-medium text-indigo-600/80 mb-4 flex items-center gap-1"><FileText size={14}/> Inv: {selectedCreditForPayment.invoiceNumber}</p>
                  
                  <div className="bg-white/60 p-3 rounded-xl border border-indigo-100/50 flex justify-between items-center backdrop-blur-sm">
                    <span className="text-sm font-bold text-indigo-900/60 uppercase tracking-wide">Remaining Balance</span>
                    <span className="text-2xl font-black text-indigo-600 font-mono tracking-tight">EGP {((selectedCreditForPayment.amountDue + selectedCreditForPayment.tax) - selectedCreditForPayment.paidAmount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
                      <input required type="date" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time *</label>
                      <input required type="time" className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method *</label>
                    <select className="w-full p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-bold text-slate-900 appearance-none cursor-pointer" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="cash">💵 Cash / نقدي</option>
                      <option value="bank_transfer">🏦 Bank Transfer / تحويل بنكي</option>
                      <option value="visa">💳 Visa / فيزا</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Amount to Pay *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">EGP</span>
                    </div>
                  </div>

                  {paymentMethod === 'bank_transfer' && (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-8 mt-2">
                      <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Bank Transfer Receipt *</label>
                      <div className="flex flex-col gap-2">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setBankTransferFile(e.target.files[0]);
                            }
                          }}
                          className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                        />
                        {bankTransferFile ? (
                          <p className="text-xs font-medium text-blue-800 break-all bg-blue-100/50 p-2 rounded-lg border border-blue-200 inline-flex items-center gap-1"><CheckCircle2 size={12}/> {bankTransferFile.name}</p>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-blue-500">Or: </span>
                            <button 
                              type="button" 
                              onClick={handlePasteBankReceipt}
                              className="text-[10px] text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-blue-200"
                            >
                              <ClipboardPaste size={10}/> Paste from Clipboard
                            </button>
                            <span className="text-[10px] text-blue-400">(or press Ctrl+V)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                </div>
                <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 mt-auto">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all">
                    {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                    Confirm Payment
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
              className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[95vh] overflow-y-auto custom-scrollbar"
            >
              <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">Add New Supplier</h3>
              <input 
                type="text" 
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="e.g. COCA COLA EG"
                className="w-full border-none bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 text-slate-900 font-medium mb-6 outline-none"
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
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedCreditForPoUpload && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[95vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Add PO to Credit</h2>
                <button 
                  onClick={() => setSelectedCreditForPoUpload(null)} 
                  className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                <p className="text-sm text-slate-500 mb-6 font-medium">
                  Upload, drag-and-drop, or paste a purchase order image. We'll automatically extract the products and sync them with the catalog. This will not overwrite any existing information except the products list and the PO Number/Invoice Number if they are missing.
                </p>

                <div 
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${uploadingPoToOldCredit ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-50/80 dark:bg-slate-800/50 dark:border-slate-700'}`}
                >
                  {uploadingPoToOldCredit ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-indigo-600">
                      <Loader2 className="h-10 w-10 animate-spin" />
                      <span className="font-bold text-lg">Processing Document...</span>
                      <span className="text-sm text-indigo-400">Extracting details and syncing items...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                      <ImageIcon className="h-12 w-12 text-slate-400" />
                      <span className="font-bold text-lg">Paste or Drop PO Image Here</span>
                      <span className="text-sm">Cmd+V / Ctrl+V to paste directly</span>
                      <button
                        type="button"
                        onClick={handlePastePoImageButtonClick}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
                      >
                        <ClipboardPaste size={18} />
                        Paste from Clipboard
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* View Items Modal - Tear-off Digital Receipt */}
    <AnimatePresence>
      {selectedCreditForView && (
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
                ease: "linear", 
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
                    <FileText className="text-blue-500" size={24} /> Credit Receipt
                  </h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    {selectedCreditForView.companyName} • {new Date(selectedCreditForView.createdAt?.toDate ? selectedCreditForView.createdAt.toDate() : selectedCreditForView.createdAt || Date.now()).toLocaleDateString('en-GB')}
                    {selectedCreditForView.poNumber && ` • PO: ${selectedCreditForView.poNumber}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCreditForView.poUrl && (
                    <a 
                      href={selectedCreditForView.poUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mr-2"
                    >
                      <ImageIcon size={14} /> View Image
                    </a>
                  )}
                  <button 
                    onClick={() => setSelectedCreditForView(null)}
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
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.companyName}>{selectedCreditForView.companyName}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{new Date(selectedCreditForView.createdAt?.toDate ? selectedCreditForView.createdAt.toDate() : selectedCreditForView.createdAt || Date.now()).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Collection Date</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedCreditForView.collectionDate || "N/A"}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Taxable</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white capitalize flex items-center gap-2">
                      {selectedCreditForView.isTaxable ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Amount Due</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedCreditForView.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tax Amount</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">EGP {Number(selectedCreditForView.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Number</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.invoiceNumber || "N/A"}>{selectedCreditForView.invoiceNumber || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">PO Number</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white truncate" title={selectedCreditForView.poNumber || "N/A"}>{selectedCreditForView.poNumber || "N/A"}</p>
                  </div>
                </div>

            {(() => {
              const urls = selectedCreditForView.poUrls && selectedCreditForView.poUrls.length > 0 
                ? selectedCreditForView.poUrls 
                : (selectedCreditForView.poUrl ? [selectedCreditForView.poUrl] : []);

              if (urls.length > 0) {
                return (
                  <div className="mb-8">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Supplier Invoice(s) / PO</h3>
                    <div className="flex flex-col gap-4">
                      {urls.map((url: string, index: number) => (
                        <div key={index} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm max-h-64 relative bg-slate-50 dark:bg-slate-900 flex justify-center items-center group">
                          <img 
                            src={url} 
                            alt={`Supplier Invoice Page ${index + 1}`} 
                            className="object-contain max-h-64 w-full"
                          />
                          <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-full text-white text-xs font-bold tracking-wider z-10">
                            PAGE {index + 1}
                          </div>
                          <a 
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2 w-full h-full z-20"
                          >
                            <ImageIcon size={20} /> View Full Page {index + 1}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div className="mb-8 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 text-center">Missing Supplier Invoice / PO</h3>
                  <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
                    <QRCode 
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://anh-zeta.vercel.app'}/cashier/upload-invoice/${selectedCreditForView.id}?type=credit`} 
                      size={140}
                      level="H"
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-500 text-center max-w-xs">
                    Scan this QR code with your phone or <span className="text-indigo-500">paste (Ctrl+V) an image</span> to upload the missing invoice.
                  </p>
                  {isPasting && (
                    <p className="text-xs text-indigo-500 font-bold mt-2 animate-pulse">Uploading pasted image...</p>
                  )}
                </div>
              );
            })()}

                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">Products / Items ({selectedCreditForView.items?.length || 0})</h3>
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
                      {selectedCreditForView.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 font-medium">
                          <td className="px-4 py-3 text-slate-500">{item.barcode || item.code || "N/A"}</td>
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{item.description || item.name || "N/A"}</td>
                          <td className="px-4 py-3 text-center text-slate-900 dark:text-slate-300">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-300">{Number(item.price || item.unitPrice || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-300">{Number(item.total || (item.quantity * (item.price || item.unitPrice || 0))).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
              
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 mt-auto">
                 <button onClick={() => {
                    setSelectedCreditForPrint(selectedCreditForView);
                    setTimeout(() => handlePrintPdf(selectedCreditForView), 100);
                 }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50">
                   {isPrinting ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                   {isPrinting ? "Generating PDF..." : "Print All (Copy)"}
                 </button>
              </div>

            </div>

            {/* Tear-off Bottom Edge */}
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(45deg, transparent 12px, #ffffff 0), linear-gradient(-45deg, transparent 12px, #ffffff 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm block dark:hidden" />
            <div style={{ height: '16px', backgroundSize: '24px 24px', backgroundImage: 'linear-gradient(45deg, transparent 12px, #0f172a 0), linear-gradient(-45deg, transparent 12px, #0f172a 0)' }} className="w-full absolute -bottom-[15px] left-0 right-0 z-10 drop-shadow-sm hidden dark:block" />

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

    {selectedCreditForPrint && (
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div id="print-credit-container" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          
          {/* Header like Shift Report */}
          <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT APPROVAL REPORT</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid #000`, borderRadius: '8px', padding: '6px 10px', minWidth: '60px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Auth</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: 1, whiteSpace: 'nowrap' }}>{selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">تقرير اعتماد فاتورة آجلة</span>
              </div>
            </div>
          </div>

          {/* Intro Text */}
          <div style={{ padding: '30px 30px 15px', textAlign: 'right', direction: 'rtl' }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#000', fontWeight: 'bold' }}>
              تُقر إدارة الفرع بأن الطلب الموضح أدناه قد تم تنفيذه وفق نظام الآجل، وذلك بناءً على الاتفاق المسبق مع المورد. وتفاصيل الطلب كالتالي:
            </p>
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
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>{selectedCreditForPrint.companyName}</div>
                </div>
              </div>
              {/* Row 2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, padding: '12px 15px', borderRight: '1px solid #000', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Invoice #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الفاتورة</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.invoiceNumber || '-'}</div>
                </div>
                <div style={{ flex: 1, padding: '12px 15px', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>PO #</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>رقم الأمر</span>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000', fontFamily: 'monospace' }}>{selectedCreditForPrint.poNumber || '-'}</div>
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
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                    {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Paragraph */}
          <div style={{ padding: '20px 30px', textAlign: 'center', direction: 'rtl', position: 'relative', zIndex: 10 }}>
            <p style={{ margin: '0 auto', fontSize: '13px', lineHeight: '1.8', color: '#000', fontWeight: 'bold', maxWidth: '650px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', border: '1px dashed #000' }}>
              أتعهد أنا مدير الفرع بأن هذه الفاتورة الآجلة تم اعتمادها بناءً على استلام البضائع أو الخدمات كاملة، وتخضع لسياسة التحصيل المتفق عليها مع الإدارة المالية.
            </p>
          </div>

          {/* Financial Section */}
          <div style={{ padding: '10px 30px', position: 'relative', zIndex: 10 }}>
            <div style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f9f9f9', padding: '4px 15px', borderBottom: '1px solid #000', fontWeight: 'bold', color: '#000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Financial Details & Collection Date</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead style={{ backgroundColor: '#fff', borderBottom: '1px solid #000' }}>
                  <tr>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Invoice Value <br/><span style={{ fontSize: '10px' }}>قيمة الفاتورة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Tax <br/><span style={{ fontSize: '10px' }}>الضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Total <br/><span style={{ fontSize: '10px' }}>الإجمالي</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold', borderRight: '1px dotted #ccc' }}>Taxable <br/><span style={{ fontSize: '10px' }}>خاضع للضريبة</span></th>
                    <th style={{ padding: '6px 15px', fontWeight: 'bold' }}>Date of Collection <br/><span style={{ fontSize: '10px' }}>تاريخ التحصيل</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: '#fff' }}>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(selectedCreditForPrint.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>EGP {Number(selectedCreditForPrint.amountDue + (selectedCreditForPrint.tax || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', borderRight: '1px dotted #ccc', textAlign: 'center', fontSize: '12px' }}>{selectedCreditForPrint.isTaxable ? '(Yes) نعم' : '(No) لا'}</td>
                    <td style={{ padding: '8px 15px', borderBottom: '1px dotted #ccc', textAlign: 'center', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>{selectedCreditForPrint.collectionDate || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div style={{ padding: '0 30px', marginTop: '50px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#fff', border: '2px solid #000', borderRadius: '4px', position: 'relative', zIndex: 10, minHeight: '140px' }}>
              <div style={{ width: '40%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.4, fontWeight: 'bold' }}>
                  I officially approve this credit invoice for future payment as per the agreed terms.
                </p>
                <div>
                  <div style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #000', marginBottom: '8px' }}>
                    {selectedCreditForPrint.managerSignature ? (
                      <img src={selectedCreditForPrint.managerSignature} alt="Manager Signature" style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ position: 'absolute', bottom: '4px', left: '0', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        [ SIGNATURE ]
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', textAlign: 'center' }}>Manager Signature / توقيع المدير</p>
                </div>
              </div>

              <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* Payment Approved Stamp (placed in the large empty area at the bottom) */}
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyItems: 'flex-start', paddingLeft: '50px', minHeight: '180px' }}>
            <div style={{ transform: 'rotate(-10deg)', opacity: 0.85 }}>
              <div style={{ border: '5px solid #16a34a', borderRadius: '50%', width: '180px', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#16a34a', backgroundColor: 'transparent', boxShadow: 'inset 0 0 0 2px rgba(22, 163, 74, 0.2), 0 0 0 2px rgba(22, 163, 74, 0.2)' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>APPROVED</span>
                <span style={{ fontSize: '18px', fontWeight: '900', borderBottom: '2px solid #16a34a', paddingBottom: '4px', marginBottom: '6px' }}>معتمد للآجل</span>
                <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>CREDIT INVOICE</span>
                <span style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px' }}>
                  {new Date(selectedCreditForPrint.createdAt?.toDate ? selectedCreditForPrint.createdAt.toDate() : selectedCreditForPrint.createdAt || Date.now()).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
            <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
              CREDIT ID: {selectedCreditForPrint.id} | PRINTED: {new Date().toLocaleString()} | AUTHORIZED: {selectedCreditForPrint.createdBy?.split('@')[0] || "SYS"}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE 1 OF 1</p>
          </div>

        </div>
      </div>
    )}

    {selectedCreditForPrint && (() => {
      const urls = selectedCreditForPrint.poUrls && selectedCreditForPrint.poUrls.length > 0 
        ? selectedCreditForPrint.poUrls 
        : (selectedCreditForPrint.poUrl ? [selectedCreditForPrint.poUrl] : []);

      return urls.map((url: string, index: number) => (
        <div key={`invoice-page-${index}`} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id={`print-credit-invoice-page-${index}`} style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>Supplier Invoice {urls.length > 1 ? `(Page ${index + 1})` : ''}</h1>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>Inv: {selectedCreditForPrint.invoiceNumber || 'N/A'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0 }}>مرفق الفاتورة</h1>
                <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>{selectedCreditForPrint.companyName}</p>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', borderRadius: '12px', padding: '20px', backgroundColor: '#fafafa' }}>
              <img 
                src={url} 
                alt={`Supplier Invoice Full Page ${index + 1}`} 
                style={{ maxHeight: '900px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
              />
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '12px' }}>
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      ));
    })()}

    {selectedCreditForPrint && selectedCreditForPrint.items && selectedCreditForPrint.items.length > 0 && Array.from({ length: Math.ceil(selectedCreditForPrint.items.length / 22) }).map((_, pageIndex) => {
      const itemsChunk = selectedCreditForPrint.items!.slice(pageIndex * 22, (pageIndex + 1) * 22);
      const totalPages = Math.ceil(selectedCreditForPrint.items!.length / 22) + 1; // +1 for the main page
      const currentPageNum = pageIndex + 2;

      return (
        <div key={`items-page-${pageIndex}`} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div id={`print-credit-items-page-${pageIndex}`} style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 30px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT APPROVAL REPORT (ITEMS)</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                  <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">ملحق الأصناف</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 30px', flexGrow: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', textAlign: 'left', fontSize: '11px', fontFamily: 'monospace' }}>
                <thead style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
                  <tr>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '5%' }}>#</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '25%' }}>Barcode</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '40%' }}>Description</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '10%', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #000', width: '10%', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px', width: '10%', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsChunk.map((item: any, idx: number) => {
                    const globalIdx = pageIndex * 22 + idx + 1;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center' }}>{globalIdx}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>{item.barcode || item.code || "-"}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', fontWeight: 'bold' }}>{item.description || item.name || "-"}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'right' }}>{Number(item.price || item.unitPrice || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.total || (item.quantity * (item.price || item.unitPrice || 0))).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '30px', marginRight: '30px', borderTop: '2px solid #000', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '8px', color: '#333', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                CREDIT ID: {selectedCreditForPrint.id} | PRINTED: {new Date().toLocaleString()}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>PAGE {currentPageNum} OF {totalPages}</p>
            </div>
          </div>
        </div>
      );
    })}
    <AnimatePresence>
      {selectedSupplierData && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            onClick={() => setSelectedSupplierProfile(null)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-[70] border-l border-slate-200 dark:border-slate-800 flex flex-col"
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-2">
                <Building className="text-indigo-600" size={24} />
                {selectedSupplierData.name} Profile
              </h2>
              <button onClick={() => setSelectedSupplierProfile(null)} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Trust Score Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-inner ${selectedSupplierData.trustScore >= 80 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : selectedSupplierData.trustScore >= 50 ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-red-500 bg-red-50 text-red-600'}`}>
                  <span className="text-2xl font-black">{selectedSupplierData.trustScore}%</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Trust Score</h3>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedSupplierData.trustScore >= 80 ? 'Excellent Partner' : selectedSupplierData.trustScore >= 50 ? 'Average Partner' : 'High Risk Partner'}
                  </p>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 mb-8 h-64 flex flex-col">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Relationship Metrics</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={selectedSupplierData.radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Supplier" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Volume</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">EGP {selectedSupplierData.totalVolume.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Current Debt</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">EGP {selectedSupplierData.totalDebt.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm col-span-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Average Payment Speed</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{selectedSupplierData.avgDaysToPay} Days</p>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

      {/* Hidden Bulk Print Render Container for Credits */}
      {bulkCreditsForPrint.length > 0 && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          {/* Cover Page */}
          <div id="pdf-bulk-cover-credits" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase' }}>BULK CREDITS EXPORT</h1>
              <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>Generated: {new Date().toLocaleString()}</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', padding: '20px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Credits Included</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{bulkCreditsForPrint.length}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Outstanding Due</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#eab308' }}>
                  EGP {bulkCreditsForPrint.reduce((acc, c) => acc + (c.amountDue + c.tax - c.paidAmount), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Supplier</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Ref (Inv / PO)</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {bulkCreditsForPrint.map((c, idx) => {
                   const total = c.amountDue + c.tax;
                   const remaining = total - c.paidAmount;
                   return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px' }}>{idx + 1}</td>
                    <td style={{ padding: '10px' }}>{c.date}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.companyName}</td>
                    <td style={{ padding: '10px' }}>{c.invoiceNumber || c.poNumber || '-'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase' }}>{c.status}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                      {total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                      {remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Render individual credits & their invoices */}
          {bulkCreditsForPrint.map((c) => {
            const urls = c.invoiceUrls && c.invoiceUrls.length > 0 
              ? c.invoiceUrls 
              : (c.invoiceUrl ? [c.invoiceUrl] : []);

            return (
              <div key={`bulk-cred-${c.id}`}>
                <div id={`pdf-bulk-credit-${c.id}`} style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'absolute', top: '15px', right: '15px', border: '1px solid #ccc', padding: '5px', fontSize: '10px', fontWeight: 'bold', color: '#666', zIndex: 50, backgroundColor: '#fff' }}>
                    BULK PRINT: REF {c.id.substring(0, 8)}
                  </div>
                  {/* Standard Receipt Header */}
                  <div style={{ padding: '20px 30px 10px', display: 'flex', justifyItems: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '50px', height: '50px', border: '2px solid #000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '30px', fontWeight: 'bold', color: '#000', lineHeight: 1 }}>K</span>
                      </div>
                      <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                        <p style={{ fontSize: '12px', color: '#333', margin: '2px 0 0', fontWeight: 'bold' }}>CREDIT INVOICE RECORD</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
                        <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#000' }} dir="rtl">إشعار آجل</span>
                      </div>
                    </div>
                  </div>

                  {/* Body ... we will reuse a simplified version of the receipt layout */}
                  <div style={{ padding: '20px 30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Supplier Name / المورد</p>
                         <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{c.companyName}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Date / التاريخ</p>
                         <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{c.date}</p>
                       </div>
                    </div>
                    
                    <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Invoice Value / القيمة</p>
                         <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>EGP {Number(c.amountDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                       <div>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Tax / الضريبة</p>
                         <p style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>EGP {Number(c.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Total Due / الإجمالي المستحق</p>
                         <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#eab308', fontFamily: 'monospace' }}>EGP {(Number(c.amountDue) + Number(c.tax || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                       </div>
                    </div>
                  </div>
                </div>

                {urls.map((url: string, index: number) => (
                  <div key={`bulk-cred-${c.id}-invoice-${index}`} id={`pdf-bulk-credit-${c.id}-invoice-${index}`} style={{ width: '794px', height: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
                      <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0, textTransform: 'uppercase' }}>Supplier Invoice {urls.length > 1 ? `(Page ${index + 1})` : ''}</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>Inv: {c.invoiceNumber || 'N/A'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', margin: 0 }}>مرفق الفاتورة</h1>
                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0' }}>{c.companyName}</p>
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ccc', borderRadius: '12px', padding: '20px', backgroundColor: '#fafafa' }}>
                      <img 
                        src={url} 
                        alt={`Supplier Invoice Full Page ${index + 1}`} 
                        style={{ maxHeight: '900px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

    </>
  );
}
