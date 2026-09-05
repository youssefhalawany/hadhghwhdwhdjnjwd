"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  collection,
  query,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  where
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  Search,
  Filter,
  Loader2,
  X,
  Users,
  Briefcase,
  Download,
  Printer,
  RefreshCw,
  UserCheck,
  BarChart3,
  CheckCircle,
  Camera,
  Upload,
  FileCheck2,
  FileText,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  Clock,
  UserX,
  ShieldCheck,
  FileBadge2,
  Landmark,
  CreditCard,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Award,
  HeartPulse,
  ChevronDown,
  HandCoins,
  ScrollText,
  BadgeAlert
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { useBranch } from "@/context/BranchContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Employee {
  id: string;
  name: string;
  nationalId: string;
  position: string;
  shiftTime: string;
  status: "active" | "suspended" | "left" | string;
  storeId: string;
  address: string;
  birthDate?: string;
  age: number;
  baseSalary: number;
  fulltime: boolean;
  gender: string;
  insurance: number;
  phone?: string;
  chequeSignedNum?: string;
  photoUrl?: string;
  nationalIdPhotoUrl?: string;
  startDate: string;
  healthCertExpiry?: string;
  nationalIdExpiry?: string;
  criminalRecordDate?: string;
  militaryStatus?: string;
  contractEndDate?: string;
  bankName?: string;
  bankIbanOrAccount?: string;
  instaPayAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  createdAt?: any;
  createdBy?: string;
}

const POSITIONS = ["Barista", "Cashier", "Manager", "Assistant Manager", "Supervisor"];

const MILITARY_STATUS_OPTIONS = [
  "أدى الخدمة العسكرية (قدوة حسنة)",
  "إعفاء نهائي من التجنيد",
  "إعفاء مؤقت من التجنيد",
  "لم يصبه الدور (معفى نهائياً)",
  "مؤجل تجنيده دراسياً",
  "غير مطلوب للتجنيد (إناث)"
];

export default function EmployeesPage() {
  const { currentBranch } = useBranch();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isUploadingID, setIsUploadingID] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Print Mode & Termination Clearance State
  const [printDocumentType, setPrintDocumentType] = useState<"contract" | "termination" | "folder_cover" | "salary_letter" | "experience_cert" | "bank_mandate">("contract");
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [showLettersMenu, setShowLettersMenu] = useState(false);
  const [terminationEmp, setTerminationEmp] = useState<Employee | null>(null);
  const [terminationData, setTerminationData] = useState({
    terminationDate: new Date().toISOString().split("T")[0],
    reason: "استقالة اختيارية برغبة العامل الصريحة",
    settlementAmount: 0,
    leaveCompensation: 0,
    paidInFull: true,
    custodyCleared: true,
    notes: ""
  });

  // Loans & Advances live summary state
  const [empLoans, setEmpLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanAmount, setLoanAmount] = useState<number>(500);
  const [loanNotes, setLoanNotes] = useState<string>("");
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  const contractRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "",
    nationalId: "",
    position: "Barista",
    shiftTime: "Morning",
    status: "active",
    address: "",
    age: 18,
    baseSalary: 0,
    fulltime: true,
    gender: "Male",
    insurance: 0,
    phone: "",
    chequeSignedNum: "",
    photoUrl: "",
    nationalIdPhotoUrl: "",
    startDate: new Date().toISOString().split("T")[0],
    healthCertExpiry: "",
    nationalIdExpiry: "",
    criminalRecordDate: "",
    militaryStatus: "أدى الخدمة العسكرية (قدوة حسنة)",
    contractEndDate: "",
    bankName: "",
    bankIbanOrAccount: "",
    instaPayAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: ""
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("status");
      if (s) {
        setStatusFilter(s.toLowerCase());
      }
    }
    return () => unsub();
  }, []);

  const isManager = useMemo(() => {
    if (typeof window === "undefined") return false;
    const role = localStorage.getItem("circlek_role");
    const email = currentUser?.email?.toLowerCase() || "";
    if (email.includes("halawany") || email.includes("admin") || email.includes("youssef")) return false;
    return role === "manager";
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Use getDocs instead of onSnapshot to save reads
      const q = query(collection(db, "employees"), orderBy("createdAt", "desc"), limit(500));
      const snapshot = await getDocs(q);

      let data: Employee[] = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));

      // Filter by branch
      if (currentBranch && currentBranch !== "all") {
        data = data.filter((item) => {
          const sid = item.storeId?.toLowerCase() || "";
          const itemBranch = sid.includes("ola") || sid.includes("koronfol") ? "ola" : "alamein4";
          return itemBranch === currentBranch;
        });
      }

      setEmployees(data);
    } catch (err) {
      console.error("Failed to load employees:", err);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Accurate age calculation from Date of Birth string (YYYY-MM-DD)
  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 0;
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      calculatedAge--;
    }
    return Math.max(0, calculatedAge);
  };

  const handleBirthDateChange = (dob: string) => {
    const calculatedAge = calculateAge(dob);
    setFormData(prev => ({ ...prev, birthDate: dob, age: calculatedAge }));
  };

  const handleNationalIdChange = (nid: string) => {
    const cleanNid = nid.trim();
    const update: Partial<Employee> = { nationalId: nid };

    // If 14-digit Egyptian National ID, auto-decode birth date, age, and gender
    if (cleanNid.length === 14 && /^\d+$/.test(cleanNid)) {
      const century = cleanNid[0] === '2' ? '19' : cleanNid[0] === '3' ? '20' : '';
      if (century) {
        const yy = cleanNid.slice(1, 3);
        const mm = cleanNid.slice(3, 5);
        const dd = cleanNid.slice(5, 7);
        const dobStr = `${century}${yy}-${mm}-${dd}`;
        const dobObj = new Date(dobStr);
        if (!isNaN(dobObj.getTime())) {
          update.birthDate = dobStr;
          update.age = calculateAge(dobStr);
        }
      }
      // 13th digit: odd = Male, even = Female
      const genderDigit = parseInt(cleanNid[12], 10);
      if (!isNaN(genderDigit)) {
        update.gender = genderDigit % 2 !== 0 ? "Male" : "Female";
      }
    }

    setFormData(prev => ({ ...prev, ...update }));
  };

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      nationalId: "",
      birthDate: "",
      position: "Barista",
      shiftTime: "Morning",
      status: "active",
      address: "",
      age: 0,
      baseSalary: 0,
      fulltime: true,
      gender: "Male",
      insurance: 0,
      phone: "",
      chequeSignedNum: "",
      photoUrl: "",
      nationalIdPhotoUrl: "",
      startDate: new Date().toISOString().split("T")[0],
      healthCertExpiry: "",
      nationalIdExpiry: "",
      criminalRecordDate: "",
      militaryStatus: "أدى الخدمة العسكرية (قدوة حسنة)",
      contractEndDate: "",
      bankName: "",
      bankIbanOrAccount: "",
      instaPayAddress: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: ""
    });
    setSelectedEmployee(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    if (isManager) {
      toast.error("Managers cannot edit employee details. Only administrators have edit access.");
      return;
    }
    setSelectedEmployee(emp);
    let birthDate = emp.birthDate || "";
    if (!birthDate && emp.nationalId && emp.nationalId.length === 14) {
      const nid = emp.nationalId;
      const century = nid[0] === '2' ? '19' : nid[0] === '3' ? '20' : '';
      if (century) {
        birthDate = `${century}${nid.slice(1, 3)}-${nid.slice(3, 5)}-${nid.slice(5, 7)}`;
      }
    }
    const age = emp.age || (birthDate ? calculateAge(birthDate) : 0);
    setFormData({
      ...emp,
      birthDate,
      age,
      healthCertExpiry: emp.healthCertExpiry || "",
      nationalIdExpiry: emp.nationalIdExpiry || "",
      criminalRecordDate: emp.criminalRecordDate || "",
      militaryStatus: emp.militaryStatus || "أدى الخدمة العسكرية (قدوة حسنة)",
      contractEndDate: emp.contractEndDate || "",
      bankName: emp.bankName || "",
      bankIbanOrAccount: emp.bankIbanOrAccount || "",
      instaPayAddress: emp.instaPayAddress || "",
      emergencyContactName: emp.emergencyContactName || "",
      emergencyContactPhone: emp.emergencyContactPhone || "",
      emergencyContactRelation: emp.emergencyContactRelation || ""
    });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    if (selectedEmployee && isManager) {
      toast.error("Managers are not authorized to edit employees. You can only add new employees.");
      return;
    }
    setIsSubmitting(true);
    try {
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4";

      const finalAge = formData.birthDate ? calculateAge(formData.birthDate) : (formData.age || 0);

      const payload = {
        ...formData,
        age: finalAge,
        storeId,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "unknown"
      };

      if (selectedEmployee) {
        await updateDoc(doc(db, "employees", selectedEmployee.id), payload);
        toast.success("Employee updated!");
      } else {
        await addDoc(collection(db, "employees"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.email || "unknown"
        });
        toast.success("Employee added!");
      }

      setShowAddModal(false);
      loadData(); // refresh data
    } catch (err) {
      console.error(err);
      toast.error("Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  // High-performance client-side image compressor:
  // Compresses 10-15MB mobile photos down to ~70KB JPEG in < 150ms!
  const compressImage = (file: File, maxWidth = 1000, quality = 0.7): Promise<{ dataUrl: string; blob: Blob }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ dataUrl, blob });
              } else {
                resolve({ dataUrl, blob: file });
              }
            },
            "image/jpeg",
            quality
          );
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingID(true);
    try {
      // 1. Instant client-side compression (< 150ms)
      const { dataUrl, blob } = await compressImage(file, 1000, 0.7);

      // Instantly show preview & set form data
      setFormData(prev => ({ ...prev, nationalIdPhotoUrl: dataUrl }));

      // 2. Fast background upload with timeout race
      const fileRef = ref(storage, `employee_ids/${Date.now()}_id.jpg`);
      const uploadPromise = uploadBytes(fileRef, blob).then(async (snap) => {
        return await getDownloadURL(snap.ref);
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
      if (downloadURL) {
        setFormData(prev => ({ ...prev, nationalIdPhotoUrl: downloadURL }));
      }
      toast.success("National ID photo attached! ⚡");
    } catch (error) {
      console.error("Fast upload error:", error);
      try {
        const { dataUrl } = await compressImage(file, 800, 0.6);
        setFormData(prev => ({ ...prev, nationalIdPhotoUrl: dataUrl }));
        toast.success("National ID photo saved locally!");
      } catch (innerErr) {
        toast.error("Failed to process ID photo");
      }
    } finally {
      setIsUploadingID(false);
      e.target.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const { dataUrl, blob } = await compressImage(file, 600, 0.75);
      setFormData(prev => ({ ...prev, photoUrl: dataUrl }));

      const fileRef = ref(storage, `employee_photos/${Date.now()}_photo.jpg`);
      const uploadPromise = uploadBytes(fileRef, blob).then(async (snap) => {
        return await getDownloadURL(snap.ref);
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
      if (downloadURL) {
        setFormData(prev => ({ ...prev, photoUrl: downloadURL }));
      }
      toast.success("Employee photo attached! ⚡");
    } catch (error) {
      console.error("Photo upload error:", error);
      try {
        const { dataUrl } = await compressImage(file, 500, 0.65);
        setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        toast.success("Employee photo saved locally!");
      } catch (innerErr) {
        toast.error("Failed to process employee photo");
      }
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (isManager) {
      toast.error("Managers are not authorized to delete employees.");
      return;
    }
    if (!window.confirm("Delete this employee? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      toast.success("Employee deleted");
      loadData(); // refresh data
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleQuickStatusChange = async (employeeId: string, newStatus: "active" | "suspended" | "left") => {
    if (isManager) {
      toast.error("Managers are not authorized to change employee status.");
      return;
    }
    try {
      await updateDoc(doc(db, "employees", employeeId), {
        status: newStatus,
        updatedBy: currentUser?.email || "unknown",
        updatedAt: serverTimestamp()
      });
      setEmployees(prev => prev.map(emp => emp.id === employeeId ? { ...emp, status: newStatus } : emp));
      if (selectedEmployee?.id === employeeId) {
        setSelectedEmployee(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success(
        newStatus === "active"
          ? "Employee marked as Active (بالخدمة)"
          : newStatus === "suspended"
            ? "Employee marked as Suspended (موقوف مؤقتاً)"
            : "Employee marked as Left (ترك العمل / انتهت خدمته)"
      );
    } catch (err) {
      console.error("Failed to update employee status:", err);
      toast.error("Failed to update status");
    }
  };

  // Arabic Number to Words Converter for Egyptian Pounds (Tafqeet)
  const numberToArabicWords = (num: number): string => {
    if (!num || num === 0) return "صفر جنيه مصري";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

    const convertHundreds = (n: number): string => {
      let res = "";
      const h = Math.floor(n / 100);
      const remainder = n % 100;
      if (h > 0) res += hundreds[h];
      if (remainder > 0) {
        if (res) res += " و";
        if (remainder < 20) {
          res += ones[remainder];
        } else {
          const o = remainder % 10;
          const t = Math.floor(remainder / 10);
          if (o > 0) res += ones[o] + " و";
          res += tens[t];
        }
      }
      return res;
    };

    const thousands = Math.floor(num / 1000);
    const remainderAfterThousand = num % 1000;
    let result = "";

    if (thousands > 0) {
      if (thousands === 1) result += "ألف";
      else if (thousands === 2) result += "ألفان";
      else if (thousands >= 3 && thousands <= 10) result += convertHundreds(thousands) + " آلاف";
      else result += convertHundreds(thousands) + " ألف";
    }

    if (remainderAfterThousand > 0) {
      if (result) result += " و";
      result += convertHundreds(remainderAfterThousand);
    }

    return result + " جنيه مصري";
  };

  const getBranchInfo = (emp?: Employee | null, branchId?: string) => {
    const sid = (emp?.storeId || "").toLowerCase();
    const isOla = sid.includes("ola") || sid.includes("koronfol") || sid.includes("anh") || branchId === "ola";

    if (isOla) {
      return {
        companyTitleAr: "ايه ان اتش للتجارة",
        companySubtitleEn: "ANH For Trading",
        companyPartyName: "ايه ان اتش للتجارة (فرع أولا القرنفل - التجمع الخامس)",
        branchTitleAr: "فرع أولا القرنفل - التجمع الخامس",
        branchCityAr: "القاهرة الجديدة",
        taxId: "754-563-844",
        commReg: "216727"
      };
    } else {
      return {
        companyTitleAr: "الشركة المصرية للتجارة والتوكيلات (ش.م.م)",
        companySubtitleEn: "El Masreya for Trade - Circle K Franchise",
        companyPartyName: "الشركة المصرية للتجارة (فرع العلمين 4 - سيركل كي)",
        branchTitleAr: "فرع العلمين 4 - مارينا الساحل الشمالي",
        branchCityAr: "الساحل الشمالي",
        taxId: "123-456-789",
        commReg: "123456"
      };
    }
  };

  const handleOpenTerminationModal = (emp: Employee) => {
    setTerminationEmp(emp);
    setTerminationData({
      terminationDate: new Date().toISOString().split("T")[0],
      reason: "استقالة اختيارية برغبة العامل الصريحة",
      settlementAmount: 0,
      leaveCompensation: 0,
      paidInFull: true,
      custodyCleared: true,
      notes: ""
    });
    setShowTerminationModal(true);
  };

  const handlePrintContract = async (emp: Employee) => {
    setPrintDocumentType("contract");
    setSelectedEmployee(emp);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handlePrintTermination = (emp?: Employee) => {
    const target = emp || terminationEmp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("termination");
    setSelectedEmployee(target);
    setShowTerminationModal(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintFolderCover = (emp?: Employee) => {
    const target = emp || activeEmp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("folder_cover");
    setSelectedEmployee(target);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintSalaryLetter = (emp?: Employee) => {
    const target = emp || activeEmp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("salary_letter");
    setSelectedEmployee(target);
    setShowLettersMenu(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintExperienceCert = (emp?: Employee) => {
    const target = emp || activeEmp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("experience_cert");
    setSelectedEmployee(target);
    setShowLettersMenu(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintBankMandate = (emp?: Employee) => {
    const target = emp || activeEmp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("bank_mandate");
    setSelectedEmployee(target);
    setShowLettersMenu(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const getHealthCertStatus = (expiryDate?: string) => {
    if (!expiryDate) {
      return {
        status: "missing",
        labelAr: "غير مسجلة (مطلوبة لسلامة الغذاء)",
        days: null,
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        labelAr: `منتهية منذ ${Math.abs(diffDays)} يوم (مخالفة لسلامة الغذاء)`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 30) {
      return {
        status: "expiring_soon",
        labelAr: `توشك على الانتهاء خلال ${diffDays} يوم`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `سارية (متبقي ${diffDays} يوم)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getNationalIdExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) {
      return {
        status: "missing",
        labelAr: "سارية (يرجى تسجيل تاريخ التجديد)",
        days: null,
        badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        labelAr: `منتهية منذ ${Math.abs(diffDays)} يوم`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 60) {
      return {
        status: "expiring_soon",
        labelAr: `تجديد مطلوب خلال ${diffDays} يوم`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `سارية (متبقي ${diffDays} يوم)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getCriminalRecordStatus = (recordDate?: string) => {
    if (!recordDate) {
      return {
        status: "missing",
        labelAr: "غير مسجل (مطلوب لملف التعيين)",
        days: null,
        badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
      };
    }
    const issueDate = new Date(recordDate);
    issueDate.setHours(0, 0, 0, 0);
    // In Egypt, criminal records (الفيش والتشبيه) are legally valid for 3 months (90 days) from issue date
    const expiryDate = new Date(issueDate);
    expiryDate.setDate(expiryDate.getDate() + 90);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        labelAr: `منتهي الصلاحية (تجاوز 3 أشهر)`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 15) {
      return {
        status: "expiring_soon",
        labelAr: `ينتهي خلال ${diffDays} يوم`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `ساري ومستوفى (${diffDays} يوم)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getProbationStatus = (startDateStr?: string) => {
    if (!startDateStr) {
      return { stage: "unknown", daysElapsed: 0, daysTotal: 90, daysRemaining: 90, labelAr: "غير محدد تاريخ الاستلام", percent: 0, badge: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10" };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime())) {
      return { stage: "unknown", daysElapsed: 0, daysTotal: 90, daysRemaining: 90, labelAr: "تاريخ غير صالح", percent: 0, badge: "bg-slate-100 text-slate-600" };
    }
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    if (daysElapsed < 75) {
      return {
        stage: "probation",
        daysElapsed,
        daysTotal: 90,
        daysRemaining: 90 - daysElapsed,
        labelAr: `قيد فترة الاختبار (اليوم ${daysElapsed} من 90)`,
        percent: Math.min(100, Math.round((daysElapsed / 90) * 100)),
        badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
        alertText: `الموظف في فترة الاختبار القانونية (المادة 32 - قانون العمل رقم 12 لسنة 2003). متبقي ${90 - daysElapsed} يوم على التثبيت.`
      };
    }
    if (daysElapsed <= 90) {
      return {
        stage: "evaluation_due",
        daysElapsed,
        daysTotal: 90,
        daysRemaining: 90 - daysElapsed,
        labelAr: `مطلوب تقييم نهائي قبل التثبيت (متبقي ${90 - daysElapsed} يوم)`,
        percent: Math.min(100, Math.round((daysElapsed / 90) * 100)),
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
        alertText: `⚠️ أوشكت فترة الاختبار (90 يوماً) على الانتهاء خلال ${90 - daysElapsed} يوم. يلزم اتخاذ قرار التثبيت أو إنهاء التعاقد دون تعويض قبل انقضاء اليوم 90.`
      };
    }
    return {
      stage: "confirmed",
      daysElapsed,
      daysTotal: 90,
      daysRemaining: 0,
      labelAr: `مثبت بالخدمة رسمياً (تجاوز فترة الاختبار - ${daysElapsed} يوم عمل)`,
      percent: 100,
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      alertText: `تم تثبيت الموظف واكتسب كامل الحماية القانونية وفقاً للمادة 32 من قانون العمل رقم 12 لسنة 2003.`
    };
  };

  const getContractRenewalStatus = (startDateStr?: string, contractEndDateStr?: string) => {
    let renewalDate: Date;
    if (contractEndDateStr) {
      renewalDate = new Date(contractEndDateStr);
    } else if (startDateStr) {
      renewalDate = new Date(startDateStr);
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
      return null;
    }
    if (isNaN(renewalDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    renewalDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      renewalDateStr: renewalDate.toISOString().split("T")[0],
      daysRemaining: diffDays,
      isExpiringSoon: diffDays <= 30 && diffDays >= 0,
      isExpired: diffDays < 0,
      badge: diffDays < 0
        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
        : diffDays <= 30
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      labelAr: diffDays < 0
        ? `العقد منتهي منذ ${Math.abs(diffDays)} يوم (يلزم تجديد العقد السنوي)`
        : diffDays <= 30
          ? `موعد تجديد العقد خلال ${diffDays} يوم`
          : `تجديد العقد: ${renewalDate.toISOString().split("T")[0]} (${diffDays} يوم متبقي)`
    };
  };

  // Loans fetcher when activeEmployeeId changes
  useEffect(() => {
    if (!activeEmployeeId) {
      setEmpLoans([]);
      return;
    }
    const fetchLoans = async () => {
      setLoadingLoans(true);
      try {
        const emp = employees.find(e => e.id === activeEmployeeId);
        const lQ = query(collection(db, "loans"), where("employeeId", "==", activeEmployeeId), limit(30));
        const lSnap = await getDocs(lQ);
        let list: any[] = lSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "loans" }));

        // Also check adjustments with type == "loan"
        const adjQ = query(collection(db, "adjustments"), where("employeeId", "==", activeEmployeeId), where("type", "==", "loan"), limit(30));
        const adjSnap = await getDocs(adjQ);
        const adjList = adjSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "adjustments" }));

        // Fallback by name if loans had no employeeId
        if (emp?.name && list.length === 0 && adjList.length === 0) {
          const nameQ = query(collection(db, "loans"), where("employeeName", "==", emp.name), limit(30));
          const nameSnap = await getDocs(nameQ);
          list = nameSnap.docs.map(d => ({ id: d.id, ...d.data(), source: "loans" }));
        }

        const combined = [...list, ...adjList].sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.date || 0).getTime();
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.date || 0).getTime();
          return tB - tA;
        });

        setEmpLoans(combined);
      } catch (err) {
        console.error("Failed to load employee loans:", err);
      } finally {
        setLoadingLoans(false);
      }
    };

    fetchLoans();
  }, [activeEmployeeId, employees]);

  const loanStats = useMemo(() => {
    let totalBorrowed = 0;
    let totalSettled = 0;

    empLoans.forEach(l => {
      const amt = Number(l.amount || l.approved || l.requested || 0);
      totalBorrowed += amt;
      if (l.settled || l.status === "settled" || l.status === "applied") {
        totalSettled += amt;
      }
    });

    const remainingBalance = Math.max(0, totalBorrowed - totalSettled);
    return { totalBorrowed, totalSettled, remainingBalance };
  }, [empLoans]);

  const handleCreateLoan = async (e?: React.FormEvent | Employee) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    if (isManager) {
      toast.error("Managers are not authorized to issue loans.");
      return;
    }
    const targetEmp = (e && 'id' in e && e.id) ? e : employees.find(emp => emp.id === activeEmployeeId) || selectedEmployee;
    if (!targetEmp) return;

    setIsSubmittingLoan(true);
    try {
      const payload = {
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        amount: Number(loanAmount),
        requested: Number(loanAmount),
        approved: Number(loanAmount),
        date: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7),
        storeId: targetEmp.storeId || currentBranch || "alamein4",
        status: "approved",
        notes: loanNotes || "سلفة راتب نقدية معتمدة",
        type: "loan",
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "admin"
      };

      const docRef = await addDoc(collection(db, "loans"), payload);
      toast.success("Salary advance recorded successfully!");
      setShowLoanModal(false);
      setLoanNotes("");
      setEmpLoans(prev => [{ id: docRef.id, ...payload }, ...prev]);
    } catch (err) {
      console.error("Failed to record loan:", err);
      toast.error("Failed to record loan");
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter !== "All Status" && emp.status !== statusFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          emp.name?.toLowerCase().includes(q) ||
          emp.nationalId?.toLowerCase().includes(q) ||
          emp.position?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, statusFilter, searchQuery]);

  const activeCount = employees.filter((i) => i.status === "active").length;
  const suspendedCount = employees.filter((i) => i.status === "suspended").length;
  const leftCount = employees.filter((i) => i.status === "left").length;
  const fullTimeCount = employees.filter((i) => i.fulltime).length;

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP" }).format(n || 0);

  useEffect(() => {
    if (filtered.length > 0 && !activeEmployeeId) {
      setActiveEmployeeId(filtered[0].id);
    } else if (filtered.length === 0) {
      setActiveEmployeeId(null);
    }
  }, [filtered, activeEmployeeId]);

  const activeEmp = employees.find(e => e.id === activeEmployeeId) || null;

  const colorGradients = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-pink-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-rose-400",
    "from-indigo-500 to-violet-500"
  ];
  const getColorGradient = (name: string) => {
    if (!name) return colorGradients[0];
    const colorIdx = (name.charCodeAt(0) + name.length) % colorGradients.length;
    return colorGradients[colorIdx];
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] pb-32 print:hidden relative overflow-hidden">
        {/* Subtle animated background mesh */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[120px]"></div>
        </div>

        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 relative z-10">

          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2 drop-shadow-sm">Command Center</h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Manage workforce, analyze payroll, and handle contracts.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center justify-center p-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md transition-all"
                title="Refresh Data"
              >
                <RefreshCw size={20} className={loading ? "animate-spin text-indigo-500" : ""} />
              </button>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-slate-900/20 dark:shadow-white/10 hover:-translate-y-1 transition-all duration-300"
              >
                <Plus size={20} /> Add Employee
              </button>
            </div>
          </div>

          {/* Metrics Top Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Suspended</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{suspendedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Left</p>
                <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{leftCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <UserX size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Employees</p>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{employees.length}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <BarChart3 size={24} />
              </div>
            </div>
          </div>

          {/* Split Pane Main Area */}
          <div className="flex flex-col lg:flex-row gap-8 lg:h-[800px]">

            {/* LEFT PANE - List View */}
            <div className="w-full lg:w-[400px] flex flex-col gap-4 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[2rem] p-4 shadow-xl shadow-slate-200/50 dark:shadow-black/50 shrink-0 h-[600px] lg:h-full">

              {/* Filter / Search inside Left Pane */}
              <div className="flex flex-col gap-3 p-2 border-b border-slate-200 dark:border-white/10 pb-6 shrink-0">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-black/20 text-slate-900 dark:text-white font-medium p-3 pl-11 rounded-2xl outline-none border border-transparent focus:border-indigo-500/50 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex-1 bg-slate-100 dark:bg-black/20 text-sm font-bold p-3 rounded-2xl outline-none text-slate-700 dark:text-slate-200 border border-transparent focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option>All Status</option>
                    <option value="active">Active (نشط)</option>
                    <option value="suspended">Suspended (موقوف)</option>
                    <option value="left">Left (ترك العمل)</option>
                  </select>
                </div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto px-2 space-y-2 custom-scrollbar pb-4">
                {loading ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={30} /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm font-medium">No employees found.</div>
                ) : (
                  filtered.map(emp => {
                    const isActive = activeEmployeeId === emp.id;
                    const grad = getColorGradient(emp.name);

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setActiveEmployeeId(emp.id)}
                        className={`group cursor-pointer p-3 rounded-2xl flex items-center justify-between transition-all duration-300 ${isActive
                            ? "bg-indigo-50 dark:bg-indigo-500/10 shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                            : "hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className={`font-bold text-[15px] truncate leading-tight ${isActive ? "text-indigo-900 dark:text-indigo-200" : "text-slate-800 dark:text-slate-100"}`}>
                              {emp.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{emp.position}</p>
                          </div>
                        </div>
                        {/* Status Dot and Quick Actions */}
                        <div className="shrink-0 flex items-center gap-1.5 pl-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintFolderCover(emp);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all"
                            title="Print Folder Cover (A4) / طباعة غلاف ملف الموظف"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTerminationModal(emp);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                            title="Termination Clearance / إخلاء طرف ومخالصة"
                          >
                            <FileCheck2 size={16} />
                          </button>
                          <div
                            className={`w-3 h-3 rounded-full shrink-0 ${emp.status === 'active'
                                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                                : emp.status === 'suspended'
                                  ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                                  : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                              }`}
                            title={emp.status === 'active' ? 'Active / نشط' : emp.status === 'suspended' ? 'Suspended / موقوف' : 'Left / ترك العمل'}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANE - Focus View */}
            <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden flex flex-col relative min-h-[600px] lg:h-full">
              {activeEmp ? (
                <>
                  {/* Focus Header (Massive Cover Image effect) */}
                  <div className={`h-48 shrink-0 w-full bg-gradient-to-br ${getColorGradient(activeEmp.name)} relative`}>
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"></div>

                    {/* Action Buttons floating top right */}
                    <div className="absolute top-6 right-6 flex items-center gap-2.5 flex-wrap justify-end">
                      {!isManager && (
                        <button
                          onClick={() => handleOpenEdit(activeEmp)}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-2xl transition-all shadow-sm"
                          title="Edit Details"
                        >
                          <Edit size={18} />
                        </button>
                      )}

                      {/* Corporate HR Letters Dropdown (100% Legal Egyptian Templates) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowLettersMenu(!showLettersMenu)}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-emerald-600/30 active:scale-95 cursor-pointer"
                          title="Official Corporate HR Letters / خطابات ومستندات رسمية"
                        >
                          <FileBadge2 size={16} />
                          <span>HR Letters</span>
                          <span className="text-[11px] bg-emerald-800/80 px-1.5 py-0.5 rounded text-white/90">خطابات رسمية</span>
                          <ChevronDown size={14} className={`transition-transform duration-200 ${showLettersMenu ? "rotate-180" : ""}`} />
                        </button>
                        {showLettersMenu && (
                          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#121216] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-1 text-right">
                              <p className="text-xs font-black text-slate-800 dark:text-white">Official Documents (A4)</p>
                              <p className="text-[10px] text-slate-400">طباعة خطابات معتمدة بخاتم الشركة</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePrintSalaryLetter(activeEmp)}
                              className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group"
                            >
                              <span className="flex items-center gap-2">
                                <Banknote size={15} className="text-emerald-600 group-hover:scale-110 transition" />
                                <span>شهادة مفردات مرتب (Salary Proof)</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintExperienceCert(activeEmp)}
                              className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group"
                            >
                              <span className="flex items-center gap-2">
                                <Award size={15} className="text-indigo-600 group-hover:scale-110 transition" />
                                <span>شهادة خبرة رسمية (مادة 130)</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintBankMandate(activeEmp)}
                              className="w-full text-right px-3 py-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group"
                            >
                              <span className="flex items-center gap-2">
                                <Landmark size={15} className="text-sky-600 group-hover:scale-110 transition" />
                                <span>خطاب فتح حساب بنكي وتحويل راتب</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handlePrintFolderCover(activeEmp)}
                        disabled={isPrinting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-indigo-600/30 active:scale-95 cursor-pointer"
                        title="Print Folder Cover (A4) / طباعة غلاف ملف الموظف"
                      >
                        <Printer size={16} />
                        <span>Folder Cover</span>
                        <span className="text-[11px] bg-indigo-800/80 px-1.5 py-0.5 rounded text-white/90">غلاف الملف</span>
                      </button>
                      <button
                        onClick={() => handleOpenTerminationModal(activeEmp)}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-rose-600/30 active:scale-95"
                        title="Termination & Clearance / مخالصة نهائية وإخلاء طرف"
                      >
                        <FileCheck2 size={16} />
                        <span>Termination Clearance</span>
                        <span className="text-[11px] bg-rose-800/80 px-1.5 py-0.5 rounded text-white/90">مخالصة</span>
                      </button>
                      <button
                        onClick={() => handlePrintContract(activeEmp)}
                        disabled={isPrinting}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-black/50 hover:bg-slate-800 dark:hover:bg-black/80 backdrop-blur-md text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg"
                      >
                        {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                        Print Contract
                      </button>
                    </div>

                    {/* Massive Avatar overlapping the edge */}
                    <div className="absolute -bottom-12 left-10 w-28 h-28 rounded-[2rem] bg-slate-50 dark:bg-[#0A0A0A] shadow-2xl p-2 z-10">
                      <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${getColorGradient(activeEmp.name)} flex items-center justify-center text-white font-black text-5xl`}>
                        {activeEmp.name.charAt(0)}
                      </div>
                    </div>
                  </div>

                  {/* Profile Body */}
                  <div className="pt-16 px-6 sm:px-10 pb-10 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight drop-shadow-sm">{activeEmp.name}</h2>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="text-slate-500 dark:text-slate-400 font-bold text-lg">{activeEmp.position}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 hidden sm:block"></span>

                          {/* Status: Static Badge for Managers, Switcher for Admins */}
                          {isManager ? (
                            <span className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${activeEmp.status === "active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                : activeEmp.status === "suspended"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                              }`}>
                              ● {activeEmp.status === "active" ? "Active" : activeEmp.status === "suspended" ? "Suspended" : "Left"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/60 dark:border-white/10">
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(activeEmp.id, "active")}
                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeEmp.status === "active"
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                title="Mark Active / تعيين كنشط بالخدمة"
                              >
                                ● Active
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(activeEmp.id, "suspended")}
                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeEmp.status === "suspended"
                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                title="Mark Suspended / تعيين كموقوف مؤقتاً"
                              >
                                ● Suspended
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(activeEmp.id, "left")}
                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeEmp.status === "left"
                                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                title="Mark Left / تعيين كمنهي الخدمة أو ترك العمل"
                              >
                                ● Left
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isManager && (
                        <button
                          onClick={() => handleDelete(activeEmp.id)}
                          className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                          title="Delete Employee"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>

                    {/* 1. HEALTH CERTIFICATE & COMPLIANCE TRACKER */}
                    {(() => {
                      const hc = getHealthCertStatus(activeEmp.healthCertExpiry);
                      const nidExp = getNationalIdExpiryStatus(activeEmp.nationalIdExpiry);
                      const cr = getCriminalRecordStatus(activeEmp.criminalRecordDate);

                      return (
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                              <HeartPulse size={16} className="text-rose-500" />
                              <span>Legal Compliance & Health Certificates (الشهادات الصحية والأوراق الرسمية)</span>
                            </h3>
                            {(hc.status === "expired" || hc.status === "missing") && (
                              <span className="text-[11px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/30 flex items-center gap-1">
                                <AlertTriangle size={12} /> تنبيه سلامة الغذاء: شهادة صحية مطلوبة
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {/* Health Certificate */}
                            <div className={`p-4 rounded-2xl border ${hc.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">الشهادة الصحية</span>
                                  <HeartPulse size={16} className={hc.status === "valid" ? "text-emerald-500" : "text-rose-500"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.healthCertExpiry || "غير مسجل"}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{hc.labelAr}</span>
                              </div>
                            </div>

                            {/* National ID Expiry */}
                            <div className={`p-4 rounded-2xl border ${nidExp.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">بطاقة الرقم القومي</span>
                                  <CreditCard size={16} className={nidExp.status === "valid" ? "text-emerald-500" : "text-amber-500"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.nationalIdExpiry || (activeEmp.nationalId ? "14 رقم قومي ساري" : "غير مسجل")}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{nidExp.labelAr}</span>
                              </div>
                            </div>

                            {/* Criminal Record */}
                            <div className={`p-4 rounded-2xl border ${cr.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">الفيش والتشبيه</span>
                                  <ShieldCheck size={16} className={cr.status === "valid" ? "text-emerald-500" : "text-slate-400"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.criminalRecordDate || "مستند بالأرشيف"}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{cr.labelAr}</span>
                              </div>
                            </div>

                            {/* Military Status */}
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-black/20 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">الموقف التجنيدي</span>
                                  <Award size={16} className="text-indigo-500" />
                                </div>
                                <p className="text-xs font-black text-slate-800 dark:text-white line-clamp-2">
                                  {activeEmp.militaryStatus || "أدى الخدمة العسكرية (قدوة حسنة)"}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">● مستند رسمي معتمد</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. 90-DAY PROBATION & CONTRACT RENEWAL TRACKER */}
                    {(() => {
                      const prob = getProbationStatus(activeEmp.startDate);
                      const crt = getContractRenewalStatus(activeEmp.startDate, activeEmp.contractEndDate);

                      return (
                        <div className="mb-8 p-5 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 shadow-sm">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                            <div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
                                <span>Probation Period & Contract Renewal (فترة الاختبار وتجديد العقود)</span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                طبقاً للمادة (32) من قانون العمل المصري رقم 12 لسنة 2003: فترة الاختبار لا تزيد على 3 أشهر.
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border self-start md:self-auto ${prob.badge}`}>
                              {prob.labelAr}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 dark:bg-white/10 h-3 rounded-full overflow-hidden mb-3">
                            <div
                              className={`h-full transition-all duration-500 ${prob.stage === "confirmed"
                                  ? "bg-emerald-500"
                                  : prob.stage === "evaluation_due"
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-indigo-600"
                                }`}
                              style={{ width: `${prob.percent}%` }}
                            ></div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                            <div>
                              <span>تاريخ استلام العمل: <strong className="text-slate-800 dark:text-slate-200 font-mono">{activeEmp.startDate || "-"}</strong></span>
                              <span className="mx-2">•</span>
                              <span>منقضي: <strong className="text-slate-800 dark:text-slate-200">{prob.daysElapsed} يوماً</strong></span>
                            </div>
                            {crt && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">تجديد العقد السنوي:</span>
                                <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${crt.badge}`}>
                                  {crt.labelAr}
                                </span>
                              </div>
                            )}
                          </div>

                          {prob.stage === "evaluation_due" && (
                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
                              <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                              <span>{prob.alertText}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. LOANS & ADVANCES LIVE SUMMARY */}
                    <div className="mb-8 p-5 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <HandCoins size={16} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Loans & Advances Live Summary (سلف الموظف ومستحقاته)</span>
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            سجل السلف النقدية المقيدة على الموظف وخصومات الراتب المستحقة.
                          </p>
                        </div>
                        {!isManager && (
                          <button
                            type="button"
                            onClick={() => setShowLoanModal(true)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                          >
                            <Plus size={15} /> صرف سلفة جديدة
                          </button>
                        )}
                      </div>

                      {/* Stat Tiles */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">إجمالي السلف المنصرفة</p>
                          <p className="text-lg font-black text-slate-800 dark:text-white font-mono">{fmtCurrency(loanStats.totalBorrowed)}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">المسدد والمخصوم</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtCurrency(loanStats.totalSettled)}</p>
                        </div>
                        <div className={`p-3.5 rounded-2xl border ${loanStats.remainingBalance > 0
                            ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30"
                            : "bg-white/80 dark:bg-white/5 border-slate-100 dark:border-white/5"
                          }`}>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">الرصيد المتبقي ذمته</p>
                          <p className={`text-lg font-black font-mono ${loanStats.remainingBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-white"}`}>
                            {fmtCurrency(loanStats.remainingBalance)}
                          </p>
                        </div>
                      </div>

                      {/* Loans History Table */}
                      {loadingLoans ? (
                        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-emerald-600" />
                          <span>جاري تحميل السلف والمستحقات...</span>
                        </div>
                      ) : empLoans.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-medium bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                          لا توجد سلف أو مستحقات مسجلة حالياً على الموظف (الذمة خالصة).
                        </div>
                      ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-bold">
                                <th className="pb-2">التاريخ</th>
                                <th className="pb-2">المبلغ</th>
                                <th className="pb-2">الحالة</th>
                                <th className="pb-2">ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                              {empLoans.slice(0, 5).map((l, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                  <td className="py-2.5 font-mono text-slate-600 dark:text-slate-300">{l.date || "-"}</td>
                                  <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">{fmtCurrency(l.amount || l.approved || 0)}</td>
                                  <td className="py-2.5">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${l.settled || l.status === "settled"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                      }`}>
                                      {l.settled || l.status === "settled" ? "تم السداد / مخصوم" : "ساري / معتمد"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-slate-500 truncate max-w-[160px]">{l.notes || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Data Grid */}
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Financial & Employment Details</h3>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Base Salary</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{fmtCurrency(activeEmp.baseSalary)}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Insurance Deduct</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{fmtCurrency(activeEmp.insurance)}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{activeEmp.startDate || "-"}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Shift Time</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{activeEmp.shiftTime || "-"}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Employment Type</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{activeEmp.fulltime ? "Full-Time" : "Part-Time"}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Age & Gender</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{activeEmp.age}y / {activeEmp.gender}</p>
                      </div>
                    </div>

                    {/* Exit & Legal Clearance Card */}
                    <div className="p-4 sm:p-5 rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-gradient-to-r from-rose-50/70 via-orange-50/40 to-transparent dark:from-rose-950/20 dark:via-orange-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                          <FileCheck2 size={22} />
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                            Employee Exit & Legal Termination Clearance (مخالصة نهائية وإخلاء طرف)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Official Egyptian Labor Law release: certifies that the branch owes the employee nothing, he owes nothing, and custody is fully cleared.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTerminationModal(activeEmp)}
                        className="shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
                      >
                        <FileCheck2 size={15} /> Issue Clearance Paper
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Info</h3>
                    <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4 mb-8">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">National ID</span>
                        <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.nationalId || "-"}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Phone Number</span>
                        <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Address</span>
                        <span className="font-black text-slate-800 dark:text-white text-lg">{activeEmp.address || "-"}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Cheque Signed #</span>
                        <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.chequeSignedNum || "-"}</span>
                      </div>
                    </div>

                    {/* Banking & Emergency Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Banking */}
                      <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Landmark size={14} className="text-indigo-500" />
                          <span>Bank & Payroll Details (بيانات الراتب)</span>
                        </h4>
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">اسم البنك</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.bankName || "غير محدد"}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">الحساب / IBAN</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white truncate max-w-[160px]" title={activeEmp.bankIbanOrAccount}>
                              {activeEmp.bankIbanOrAccount || "غير محدد"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">انستاباي / محفظة</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {activeEmp.instaPayAddress || "غير محدد"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Users size={14} className="text-rose-500" />
                          <span>Emergency Contact (جهة اتصال الطوارئ)</span>
                        </h4>
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">اسم القريب</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.emergencyContactName || "غير مسجل"}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">صلة القرابة</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.emergencyContactRelation || "غير مسجل"}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">رقم الهاتف</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">
                              {activeEmp.emergencyContactPhone || "غير مسجل"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 text-center">
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6">
                    <Users size={40} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 mb-2">No Employee Selected</h3>
                  <p className="text-slate-500 max-w-md">Select an employee from the list to view their complete profile, financials, and contract details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOAN / SALARY ADVANCE MODAL */}
      {showLoanModal && activeEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                  <HandCoins size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    تسجيل سلفة نقدية جديدة
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeEmp.name} (الراتب: {activeEmp.baseSalary?.toLocaleString() || 0} ج.م)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLoanModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  مبلغ السلفة (جنيه مصري) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={loanAmount || ""}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background text-lg font-mono font-black focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ج.م
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  بيان سبب السلفة أو تفاصيل الخصم الشهري
                </label>
                <textarea
                  rows={2}
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  placeholder="مثال: سلفة نقدية تخصم على قسطين من راتب الشهر القادم..."
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition resize-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>
                  سيتم ترحيل السلفة مباشرة إلى سجلات الحسابات والخصومات ومتابعة الرصيد المتبقي ذمة العامل تلقائياً.
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingLoan || !loanAmount || loanAmount <= 0}
                onClick={() => handleCreateLoan(activeEmp)}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingLoan ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />}
                <span>تأكيد صرف السلفة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 overflow-hidden">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed at top) */}
            <div className="flex justify-between items-center px-6 py-4 sm:px-8 sm:py-5 border-b border-border shrink-0 bg-card z-10">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
                  {selectedEmployee ? "Edit Employee" : "Add Employee"}
                </h2>
                {selectedEmployee && <p className="text-xs text-slate-500 mt-0.5">{selectedEmployee.name}</p>}
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder="e.g. احمد محمد عبدالله"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Position</label>
                  <select
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="active">Active (على رأس العمل / نشط)</option>
                    <option value="suspended">Suspended (موقوف مؤقتاً عن العمل)</option>
                    <option value="left">Left (ترك العمل / انتهت خدمته)</option>
                  </select>
                </div>

                {/* Base Salary & Insurance */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Base Salary (EGP)</label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Insurance Deduct (EGP)</label>
                  <input
                    type="number"
                    value={formData.insurance}
                    onChange={e => setFormData({ ...formData, insurance: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* National ID & Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>National ID (الرقم القومي)</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">Auto-decodes DOB</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={e => handleNationalIdChange(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono tracking-wider"
                    placeholder="14 Digits (14 رقم)"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Start Date & Date of Birth */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Start Date (تاريخ استلام العمل)</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Date of Birth (تاريخ الميلاد)
                    </label>
                    {formData.age ? (
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                        {formData.age} سنة (محسوب)
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="date"
                    value={formData.birthDate || ""}
                    onChange={e => handleBirthDateChange(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium"
                  />
                  {formData.age ? (
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      السن المحسوب تلقائياً: <strong className="text-slate-700 dark:text-slate-200">{formData.age} عاماً</strong>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      أدخل تاريخ الميلاد أو الرقم القومي لحساب السن تلقائياً
                    </p>
                  )}
                </div>

                {/* Shift & Fulltime */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shift Time</label>
                  <select
                    value={formData.shiftTime}
                    onChange={e => setFormData({ ...formData, shiftTime: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Employment Type</label>
                  <select
                    value={formData.fulltime ? "Yes" : "No"}
                    onChange={e => setFormData({ ...formData, fulltime: e.target.value === "Yes" })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Yes">Full-Time</option>
                    <option value="No">Part-Time</option>
                  </select>
                </div>

                {/* Gender & Cheque */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Cheque Signed #</label>
                  <input
                    type="text"
                    value={formData.chequeSignedNum}
                    onChange={e => setFormData({ ...formData, chequeSignedNum: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder="Optional"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* --- Section: Retail Compliance & Official Documents --- */}
                <div className="md:col-span-2 pt-4 border-t border-border">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <HeartPulse size={16} className="text-rose-500" />
                    <span>الشهادات الصحية والأوراق الرسمية (Health Certificate & Compliance)</span>
                  </h4>
                </div>

                {/* Health Cert Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Health Cert Expiry (انتهاء الشهادة الصحية)</span>
                    <span className="text-[10px] text-rose-500 font-bold">إلزامية لمحلات الأغذية</span>
                  </label>
                  <input
                    type="date"
                    value={formData.healthCertExpiry || ""}
                    onChange={e => setFormData({ ...formData, healthCertExpiry: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-rose-500 font-medium"
                  />
                </div>

                {/* National ID Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    National ID Expiry (انتهاء بطاقة الرقم القومي)
                  </label>
                  <input
                    type="date"
                    value={formData.nationalIdExpiry || ""}
                    onChange={e => setFormData({ ...formData, nationalIdExpiry: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                {/* Criminal Record Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Criminal Record Date (تاريخ الفيش والتشبيه)</span>
                    <span className="text-[10px] text-slate-400">صلاحية 3 أشهر</span>
                  </label>
                  <input
                    type="date"
                    value={formData.criminalRecordDate || ""}
                    onChange={e => setFormData({ ...formData, criminalRecordDate: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                {/* Military Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Military Status (الموقف من التجنيد)
                  </label>
                  <select
                    value={formData.militaryStatus || MILITARY_STATUS_OPTIONS[0]}
                    onChange={e => setFormData({ ...formData, militaryStatus: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium text-sm"
                  >
                    {MILITARY_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Annual Contract End Date */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Contract End Date (تاريخ انتهاء العقد السنوي)</span>
                    <span className="text-[10px] text-indigo-500 font-bold">تنبيه قبل 30 يوماً من التجديد</span>
                  </label>
                  <input
                    type="date"
                    value={formData.contractEndDate || ""}
                    onChange={e => setFormData({ ...formData, contractEndDate: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                {/* --- Section: Banking & Salary Transfers --- */}
                <div className="md:col-span-2 pt-4 border-t border-border">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Landmark size={16} className="text-indigo-500" />
                    <span>البيانات البنكية وتحويلات الراتب (Bank & Digital Wallets)</span>
                  </h4>
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Bank Name (اسم البنك)
                  </label>
                  <input
                    type="text"
                    value={formData.bankName || ""}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. البنك الأهلي المصري / CIB"
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Bank Account / IBAN */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Account # / IBAN (رقم الحساب / الآيبان)
                  </label>
                  <input
                    type="text"
                    value={formData.bankIbanOrAccount || ""}
                    onChange={e => setFormData({ ...formData, bankIbanOrAccount: e.target.value })}
                    placeholder="EG..."
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* InstaPay / Digital Wallet */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    InstaPay / Mobile Wallet (عنوان انستاباي أو فودافون كاش)
                  </label>
                  <input
                    type="text"
                    value={formData.instaPayAddress || ""}
                    onChange={e => setFormData({ ...formData, instaPayAddress: e.target.value })}
                    placeholder="username@instapay or 010xxxxxxxx"
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* --- Section: Emergency Contact --- */}
                <div className="md:col-span-2 pt-4 border-t border-border">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Users size={16} className="text-rose-500" />
                    <span>جهة الاتصال للطوارئ (Emergency Contact)</span>
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Contact Name (اسم شخص للطوارئ)
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactName || ""}
                    onChange={e => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    placeholder="الاسم صلة قرابة أولى"
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Emergency Phone (هاتف الطوارئ)
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactPhone || ""}
                    onChange={e => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Relationship (صلة القرابة)
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactRelation || ""}
                    onChange={e => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                    placeholder="مثال: الوالد / الزوجة / الأخ"
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Employee Portrait Photo (4x6) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Personal Photo 4×6 (صورة العامل)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">⚡ Instant Compressed</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl hover:bg-indigo-100/50 transition active:scale-[0.99]">
                      {isUploadingPhoto ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <Camera size={18} className="text-indigo-600 dark:text-indigo-400" />}
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                        {isUploadingPhoto ? "Processing..." : formData.photoUrl ? "Change Photo 4×6" : "Upload / Capture 4×6"}
                      </span>
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                    </label>
                    {formData.photoUrl && (
                      <div className="relative h-12 w-12 rounded-xl border border-indigo-300 dark:border-indigo-700 overflow-hidden shrink-0 group">
                        <img src={formData.photoUrl} alt="Portrait" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, photoUrl: "" }))}
                          className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          title="Remove Photo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* National ID Photo */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>National ID Card (صورة البطاقة)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">⚡ Instant Compressed</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/20 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-[0.99]">
                      {isUploadingID ? <Loader2 className="animate-spin text-indigo-500" size={18} /> : <Upload size={18} className="text-slate-600 dark:text-slate-300" />}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {isUploadingID ? "Processing..." : formData.nationalIdPhotoUrl ? "Change Scanned ID" : "Upload / Scan ID"}
                      </span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleIDUpload} disabled={isUploadingID} />
                    </label>
                    {formData.nationalIdPhotoUrl && (
                      <div className="relative h-12 w-12 rounded-xl border border-slate-300 dark:border-white/10 overflow-hidden shrink-0 group">
                        <img src={formData.nationalIdPhotoUrl} alt="ID" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, nationalIdPhotoUrl: "" }))}
                          className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          title="Remove ID Photo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 border border-border rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TERMINATION & CLEARANCE MODAL */}
      {showTerminationModal && terminationEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar my-8">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl">
                  <FileCheck2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    إصدار إقرار مخالصة وإخلاء طرف قانوني
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official Egyptian Labor Law compliant Discharge, Liabilities Release & Job Clearance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTerminationModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Employee Preview Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-base">{terminationEmp.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  ID: {terminationEmp.nationalId || "No National ID"} • {terminationEmp.position} • Branch: {terminationEmp.storeId || currentBranch}
                </p>
              </div>
              <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-lg uppercase">
                Exit Clearance
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    تاريخ ترك العمل (Termination Date)
                  </label>
                  <input
                    type="date"
                    value={terminationData.terminationDate}
                    onChange={e => setTerminationData({ ...terminationData, terminationDate: e.target.value })}
                    className="w-full p-3 bg-slate-100 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl font-bold text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    سبب انتهاء العمل (Exit Reason)
                  </label>
                  <select
                    value={terminationData.reason}
                    onChange={e => setTerminationData({ ...terminationData, reason: e.target.value })}
                    className="w-full p-3 bg-slate-100 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl font-bold text-sm outline-none cursor-pointer"
                  >
                    <option value="استقالة اختيارية برغبة العامل الصريحة">استقالة اختيارية برغبة العامل (Resignation)</option>
                    <option value="انتهاء مدة عقد العمل المحدد دون تجديد">انتهاء مدة العقد المحدد (Contract Expiry)</option>
                    <option value="إنهاء علاقة العمل بالتراضي والاتفاق المشترك">إنهاء بالتراضي والاتفاق (Mutual Agreement)</option>
                    <option value="ترك العمل بناءً على طلبه لظروف خاصة">ترك العمل لظروف خاصة (Personal Reasons)</option>
                    <option value="عدم اجتياز فترة الاختبار بنجاح">فسخ خلال فترة الاختبار (Probation Period)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    صافي مبلغ التصفية المالية المستلم (EGP)
                  </label>
                  <input
                    type="number"
                    value={terminationData.settlementAmount}
                    onChange={e => setTerminationData({ ...terminationData, settlementAmount: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full p-3 bg-slate-100 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl font-bold text-sm outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {terminationData.settlementAmount > 0
                      ? numberToArabicWords(terminationData.settlementAmount)
                      : "تم استلام كافة المستحقات بالكامل حتى تاريخه"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    مقابل رصيد الإجازات المستحقة (EGP)
                  </label>
                  <input
                    type="number"
                    value={terminationData.leaveCompensation}
                    onChange={e => setTerminationData({ ...terminationData, leaveCompensation: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full p-3 bg-slate-100 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl font-bold text-sm outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {terminationData.leaveCompensation > 0
                      ? numberToArabicWords(terminationData.leaveCompensation)
                      : "تم استنفاد الإجازات بالكامل أو متضمنة بالتصفية"}
                  </p>
                </div>
              </div>

              {/* Custody & Clearances Verification Box */}
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle size={16} /> شروط المخالصة وإبراء الذمة القانونية (Egyptian Labor Law)
                </div>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={terminationData.paidInFull}
                      onChange={e => setTerminationData({ ...terminationData, paidInFull: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>إقرار العامل باستلام كامل الأجور والبدلات والإضافي ومكافأة نهاية الخدمة (لا يطلب الفرع بأي شيء)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={terminationData.custodyCleared}
                      onChange={e => setTerminationData({ ...terminationData, custodyCleared: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>تسليم كافة العهد: عهدة نقدية، مفاتيح الفرع والخزينة، الزي الرسمي، وبطاقات التشغيل (الفرع لا يطلبه بأي شيء)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowTerminationModal(false)}
                className="flex-1 py-3.5 border border-border rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-sm"
              >
                إلغاء (Cancel)
              </button>
              <button
                type="button"
                onClick={() => handlePrintTermination(terminationEmp)}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-600/20"
              >
                <Printer size={18} />
                طباعة وثيقة المخالصة الرسمية (Print Clearance)
              </button>
            </div>
          </div>
        </div>
      )}



      {/* HIDDEN CONTRACT PRINT CONTAINER */}
      <div
        ref={contractRef}
        className="hidden print:block bg-white text-black print-contract"
        style={{ width: "100%", padding: 0, boxSizing: "border-box", direction: "rtl", fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif" }}
      >
        <style type="text/css" media="print">
          {`
            @page { 
              size: A4 portrait; 
              margin: ${printDocumentType === 'termination' ? '8mm 12mm 8mm 12mm !important' : printDocumentType === 'folder_cover' ? '8mm 10mm 8mm 10mm !important' : (printDocumentType === 'salary_letter' || printDocumentType === 'experience_cert' || printDocumentType === 'bank_mandate') ? '10mm 14mm 10mm 14mm !important' : '15mm'}; 
            }
            .content-wrapper { padding: 0; margin: 0 auto; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            ${printDocumentType === 'termination' || printDocumentType === 'folder_cover' || printDocumentType === 'salary_letter' || printDocumentType === 'experience_cert' || printDocumentType === 'bank_mandate' ? `
              html, body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
              }
              .print-contract {
                padding: 0 !important;
                margin: 0 !important;
                height: 100% !important;
              }
              .termination-page, .folder-cover-page, .salary-letter-page, .experience-cert-page, .bank-mandate-page {
                height: 277mm !important;
                max-height: 277mm !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                box-sizing: border-box !important;
              }
            ` : ''}
          `}
        </style>

        {selectedEmployee && (() => {
          const branchInfo = getBranchInfo(selectedEmployee, currentBranch);
          const companyTitleAr = branchInfo.companyTitleAr;
          const companySubtitleEn = branchInfo.companySubtitleEn;
          const companyPartyName = branchInfo.companyPartyName;
          const branchTitleAr = branchInfo.branchTitleAr;

          // IF PRINTING TERMINATION CLEARANCE (EGYPTIAN LABOR LAW 100% LEGAL)
          if (printDocumentType === 'termination') {
            const dateObj = new Date(terminationData.terminationDate || Date.now());
            const dateFormattedAr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const dayNameAr = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });

            return (
              <div
                className="content-wrapper termination-page"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "277mm",
                  maxHeight: "277mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  margin: "0 auto",
                  color: "#000",
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                  fontSize: "10.5px",
                  lineHeight: "1.42",
                  boxSizing: "border-box"
                }}
              >

                {/* 1. Official Letterhead Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "6px" }}>
                  <div style={{ textAlign: "right", flex: 1.3 }}>
                    <h1 style={{ fontSize: "17.5px", fontWeight: "900", margin: 0, color: "#0f172a", letterSpacing: "0.2px" }}>{companyTitleAr}</h1>
                    <h2 style={{ fontSize: "12px", margin: "2px 0 0 0", color: "#334155", fontWeight: "bold" }}>{branchTitleAr}</h2>
                    <p style={{ margin: "3px 0 0 0", fontSize: "9.5px", color: "#64748b" }}>
                      سجل تجاري (س.ت): <strong style={{ color: "#1e293b" }}>{branchInfo.commReg}</strong> | بطاقة ضريبية (ب.ض): <strong style={{ color: "#1e293b" }}>{branchInfo.taxId}</strong>
                    </p>
                  </div>

                  <div style={{ textAlign: "center", flex: 1, padding: "0 8px" }}>
                    <div style={{ border: "1.5px solid #0f172a", borderRadius: "6px", padding: "5px 8px", backgroundColor: "#f8fafc" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: "900", color: "#0f172a", display: "block" }}>جمهورية مصر العربية</span>
                      <span style={{ fontSize: "10px", color: "#475569", fontWeight: "bold", display: "block", marginTop: "1px" }}>قطاع علاقات العمل والتشغيل</span>
                      <span style={{ fontSize: "9px", color: "#64748b", display: "block" }}>إدارة الموارد البشرية والشؤون القانونية</span>
                    </div>
                  </div>

                  <div style={{ textAlign: "left", flex: 1.1, fontSize: "10px", lineHeight: "1.5" }}>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "5px 8px", backgroundColor: "#f8fafc" }}>
                      <div><span style={{ color: "#64748b", fontWeight: "bold" }}>التاريخ:</span> <strong style={{ color: "#0f172a" }}>{dateFormattedAr}</strong></div>
                      <div><span style={{ color: "#64748b", fontWeight: "bold" }}>الموافق:</span> <strong style={{ color: "#0f172a" }}>{dayNameAr}</strong></div>
                      <div><span style={{ color: "#64748b", fontWeight: "bold" }}>كود الوثيقة:</span> <strong style={{ fontFamily: "monospace", letterSpacing: "0.5px", color: "#0f172a" }}>TRM-{(selectedEmployee.id || "000").slice(-6).toUpperCase()}</strong></div>
                    </div>
                  </div>
                </div>

                {/* 2. Formal Title Banner */}
                <div style={{ textAlign: "center", borderTop: "2px solid #0f172a", borderBottom: "2px solid #0f172a", padding: "6px 8px", backgroundColor: "#f8fafc" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: "900", margin: "0 0 2px 0", color: "#0f172a", letterSpacing: "0.3px" }}>
                    إقرار مخالصة نهائية تامة وإبراء ذمة شامل واستلام كافة المستحقات وخلو طرف
                  </h2>
                  <h3 style={{ fontSize: "10px", margin: "1px 0 0 0", fontWeight: "bold", color: "#334155", letterSpacing: "0.5px" }}>
                    FULL & FINAL SETTLEMENT, DISCHARGE OF LIABILITIES & MUTUAL JOB CLEARANCE
                  </h3>
                  <p style={{ fontSize: "9px", margin: "2px 0 0 0", color: "#64748b", fontWeight: "600" }}>
                    صادر ومحرر سنداً لأحكام قانون العمل المصري رقم 12 لسنة 2003 وتعديلاته وأحكام القانون المدني المصري
                  </p>
                </div>

                {/* 3. Parties Table */}
                <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", border: "1.5px solid #0f172a" }}>
                  <tbody>
                    <tr style={{ backgroundColor: "#f1f5f9" }}>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", width: "18%", border: "1px solid #cbd5e1", color: "#1e293b" }}>صاحب العمل (المنشأة):</td>
                      <td style={{ padding: "4.5px 8px", width: "32%", border: "1px solid #cbd5e1", fontWeight: "600" }}>{companyPartyName}</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", width: "18%", border: "1px solid #cbd5e1", color: "#1e293b" }}>الفرع ومقر العمل:</td>
                      <td style={{ padding: "4.5px 8px", width: "32%", border: "1px solid #cbd5e1", fontWeight: "600" }}>{branchTitleAr}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>الطرف الثاني (العامل المُقر):</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "900", fontSize: "11.5px", border: "1px solid #cbd5e1", color: "#0f172a" }}>{selectedEmployee.name}</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>الرقم القومي (14 رقماً):</td>
                      <td style={{ padding: "4.5px 8px", fontFamily: "monospace", letterSpacing: "1px", fontWeight: "900", fontSize: "11.5px", border: "1px solid #cbd5e1", color: "#0f172a" }}>
                        {selectedEmployee.nationalId || "----------------"}
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>المسمى الوظيفي:</td>
                      <td style={{ padding: "4.5px 8px", border: "1px solid #cbd5e1", fontWeight: "600" }}>{selectedEmployee.position}</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>تاريخ بدء العمل:</td>
                      <td style={{ padding: "4.5px 8px", border: "1px solid #cbd5e1", fontWeight: "600" }}>{selectedEmployee.startDate || "---"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>تاريخ انتهاء الخدمة:</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "900", color: "#b91c1c", border: "1px solid #cbd5e1", fontSize: "11px" }}>{terminationData.terminationDate}</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "800", border: "1px solid #cbd5e1", color: "#1e293b" }}>سبب انتهاء علاقة العمل:</td>
                      <td style={{ padding: "4.5px 8px", fontWeight: "700", border: "1px solid #cbd5e1", color: "#0f172a" }}>{terminationData.reason}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. Legal Provisions */}
                <div style={{ fontSize: "10px", lineHeight: "1.42", textAlign: "justify" }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: "bold", color: "#0f172a", fontSize: "10.5px" }}>
                    أقر أنا العامل الموقع أدناه، بكامل أهليتي القانونية والشرعية المعتبرة للتصرف، وبإرادتي الحرة الواعية الخالية من أي إكراه أو غلط أو تدليس، بالآتي:
                  </p>

                  <div style={{ marginBottom: "5px", paddingRight: "8px", borderRight: "2.5px solid #0f172a" }}>
                    <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>أولاً: المخالصة المالية التامة واستلام كافة المستحقات العمالية:</strong>
                    <div style={{ marginTop: "1px" }}>
                      أقر بأنني تسلمت من إدارة الشركة والفرع المذكور كامل كافة مستحقاتي المالية والعمالية عن كامل مدة خدمتي وحتى تاريخ ترك العمل الموضح أعلاه، وتشمل الأجور والرواتب الأساسية والمتغيرة، ومقابل ساعات العمل الإضافية، والبدلات بكافة مسمياتها، والمكافآت، والحوافز، ومقابل رصيد الإجازات السنوية المستحقة قانوناً وغير المستنفذة، ومكافأة نهاية الخدمة، وأية حقوق أو مستحقات أخرى مقررة بموجب عقد العمل أو لوائح المنشأة أو قانون العمل المصري رقم 12 لسنة 2003 وتعديلاته، وأنه لم يعد لي في ذمة الشركة أو فروعها أو إدارتها أو ملاكها أي حق أو مستحق مالي أو عيني أو تعويضي كائناً ما كان سببه أو مسماه.
                    </div>
                    {terminationData.settlementAmount > 0 ? (
                      <div style={{ margin: "3px 0", padding: "3px 8px", backgroundColor: "#f1f5f9", border: "1px dashed #64748b", borderRadius: "4px", fontWeight: "bold", fontSize: "10px" }}>
                        صافي المبلغ المستلم عند التصفية: <span style={{ color: "#059669" }}>{terminationData.settlementAmount.toLocaleString()} جنيه مصري</span> (فقط {numberToArabicWords(terminationData.settlementAmount)} لا غير).
                      </div>
                    ) : (
                      <div style={{ margin: "3px 0", padding: "3px 8px", backgroundColor: "#f1f5f9", border: "1px dashed #64748b", borderRadius: "4px", fontWeight: "bold", fontSize: "10px" }}>
                        تم استلام وتسوية كافة المستحقات المالية والرواتب بالكامل حتى تاريخ ترك العمل دون أي تأخير أو متبقي.
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: "5px", paddingRight: "8px", borderRight: "2.5px solid #0f172a" }}>
                    <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>ثانياً: براءة ذمة الشركة وإدارتها إبراءً عاماً شاملاً مانعاً وباتاً والتنازل عن الدعاوى:</strong>
                    <div style={{ marginTop: "1px" }}>
                      بناءً على استلامي لكامل حقوقي، تعتبر ذمة الشركة والفرع وممثليهما القانونيين وملاكها بريئة تماماً براءة تامة ونهائية وشاملة ومانعة من أي التزام أو دين أو مطالبة ناشئة عن علاقة العمل أو إنهائها. وأقر بالتنازل الصريح والبات غير المشروط عن أية شكاوى أو دعاوى عمالية أو مدنية أو قضائية رُفعت أو قد تُرفع مستقبلاً أمام مكاتب العمل أو المحاكم العمالية أو المدنية أو الجنائية، ويعد هذا الإقرار مخالصة نهائية باتة وسنداً قاطعاً مانعاً لأي نزاع.
                    </div>
                  </div>

                  <div style={{ marginBottom: "5px", paddingRight: "8px", borderRight: "2.5px solid #0f172a" }}>
                    <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>ثالثاً: تسليم العهد وخلو الطرف العيني والمالي المتبادل (Zero Liabilities):</strong>
                    <div style={{ marginTop: "1px" }}>
                      أقر بأنني قمت بتسليم كافة العهد والأمانات التي كانت في حيازتي أو تحت مسؤوليتي الوظيفية كاملة وسليمة دون أي نقص أو تلف، وتشمل: (العهد النقدية وفروق الخزينة ونقاط البيع، مفاتيح الفرع والأبواب والخزائن، بطاقات التشغيل وكروت POS وID Badge، ماكينات وأجهزة التشغيل، الزي الرسمي Uniform، وأية سجلات أو وثائق خاصة بالمنشأة)، وأنه لا توجد في ذمتي أية مبالغ أو قروض أو سلفيات مستحقة للشركة. وبالمقابل، تقر إدارة الفرع والشركة بخلو طرف العامل المذكور تماماً وإبراء ذمته العينية والمالية دون أي قيد أو شرط، وأنه لا يدين للمنشأة بأي شيء.
                    </div>
                  </div>

                  <div style={{ marginBottom: "0", paddingRight: "8px", borderRight: "2.5px solid #0f172a" }}>
                    <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>رابعاً: التعهد بالسرية التامة وعدم الإضرار بمصالح المنشأة:</strong>
                    <div style={{ marginTop: "1px" }}>
                      أتعهد بالالتزام المستمر بالمحافظة التامة على سرية كافة البيانات والمعلومات التجارية والتشغيلية وأسرار العمل والعملاء الخاصة بالشركة وعدم إفشائها أو استخدامها بما يضر بمصالح المنشأة، تحت طائلة المساءلة القانونية الجنائية والمدنية طبقاً لنص المادة 310 من قانون العقوبات المصري.
                    </div>
                  </div>
                </div>

                {/* 5. Bottom Block: Official Signatures, Fingerprint, Seal & Legal Footer */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ border: "1.5px solid #0f172a", borderRadius: "6px", padding: "6px 8px", backgroundColor: "#fff", pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: "8px" }}>

                      {/* Employee Signature Box */}
                      <div style={{ flex: 1.3, border: "1px solid #cbd5e1", borderRadius: "5px", padding: "6px 8px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: "900", fontSize: "11px", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", display: "flex", justifyContent: "space-between", color: "#0f172a" }}>
                            <span>المُقر بما فيه (العامل / الموظف)</span>
                            <span style={{ fontSize: "9px", color: "#64748b" }}>Receipt & Release</span>
                          </div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
                            <div><strong>الاسم:</strong> {selectedEmployee.name}</div>
                            <div><strong>الرقم القومي:</strong> <span style={{ fontFamily: "monospace", letterSpacing: "0.5px", fontWeight: "bold" }}>{selectedEmployee.nationalId || "----------------"}</span></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "8px" }}>
                            <strong style={{ width: "48px", fontSize: "10px" }}>التوقيع:</strong>
                            <div style={{ flex: 1, borderBottom: "1.5px dotted #0f172a", height: "18px" }}></div>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "6px" }}>
                            <strong style={{ width: "48px", fontSize: "10px" }}>التاريخ:</strong>
                            <div style={{ flex: 1, borderBottom: "1.5px dotted #0f172a", height: "16px" }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Official Right Thumbprint Box */}
                      <div style={{ width: "110px", textAlign: "center", border: "1.5px solid #0f172a", borderRadius: "5px", padding: "5px 4px", backgroundColor: "#fafafa", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ fontSize: "9.5px", fontWeight: "900", color: "#0f172a" }}>
                          بصمة إبهام اليد اليمنى
                        </div>
                        <div style={{ width: "75px", height: "74px", border: "1.5px dashed #475569", margin: "3px auto", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "9px", backgroundColor: "#fff" }}>
                          (محل البصمة)
                        </div>
                        <div style={{ fontSize: "8.5px", color: "#64748b", fontWeight: "bold" }}>
                          Right Thumbprint
                        </div>
                      </div>

                      {/* Store Manager Signoff */}
                      <div style={{ flex: 1.1, border: "1px solid #cbd5e1", borderRadius: "5px", padding: "6px 8px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: "900", fontSize: "11px", borderBottom: "1.5px solid #0f172a", paddingBottom: "2px", marginBottom: "4px", display: "flex", justifyContent: "space-between", color: "#0f172a" }}>
                            <span>مدير الفرع (المستلم والمصفي)</span>
                            <span style={{ fontSize: "9px", color: "#64748b" }}>Store Manager</span>
                          </div>
                          <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
                            <div><strong>الصفة:</strong> مدير فرع {branchTitleAr}</div>
                            <div><strong>حالة العهد:</strong> <span style={{ color: "#059669", fontWeight: "bold" }}>تم تسليم كافة العهد بالكامل</span></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "8px" }}>
                            <strong style={{ width: "45px", fontSize: "10px" }}>التوقيع:</strong>
                            <div style={{ flex: 1, borderBottom: "1.5px dotted #0f172a", height: "18px" }}></div>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", marginTop: "6px" }}>
                            <strong style={{ width: "45px", fontSize: "10px" }}>التاريخ:</strong>
                            <div style={{ flex: 1, borderBottom: "1.5px dotted #0f172a", height: "16px" }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Company Seal Box */}
                      <div style={{ width: "110px", textAlign: "center", border: "1px solid #cbd5e1", borderRadius: "5px", padding: "5px 4px", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ fontSize: "9.5px", fontWeight: "900", color: "#0f172a" }}>
                          اعتماد وخاتم الشركة
                        </div>
                        <div style={{ width: "72px", height: "72px", border: "1.5px dashed #94a3b8", borderRadius: "50%", margin: "3px auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "9px", backgroundColor: "#fff" }}>
                          خاتم المنشأة الرسمي
                        </div>
                        <div style={{ fontSize: "8.5px", color: "#64748b", fontWeight: "bold" }}>
                          Official Stamp
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Official Legal Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #cbd5e1", paddingTop: "4px", fontSize: "9px", color: "#64748b", fontWeight: "bold" }}>
                    <span>وثيقة قانونية رسمية معتمدة وفقاً للمادتين (6) و (125) من قانون العمل المصري رقم 12 لسنة 2003</span>
                    <span>(نسخة أصلية موثقة لملف خدمة العامل بالفرع)</span>
                  </div>
                </div>

              </div>
            );
          }

          // IF PRINTING EMPLOYEE DOSSIER FOLDER COVER (A4 OFFICIAL CORPORATE FILE COVER)
          if (printDocumentType === 'folder_cover') {
            const nid = (selectedEmployee.nationalId || "").trim();
            const nidDigits = nid.padEnd(14, " ").slice(0, 14).split("");
            let birthDateStr = "";
            let govName = "";
            if (nid.length === 14 && /^\d+$/.test(nid)) {
              const century = nid[0] === '2' ? '19' : nid[0] === '3' ? '20' : '';
              const yy = nid.slice(1, 3);
              const mm = nid.slice(3, 5);
              const dd = nid.slice(5, 7);
              if (century) {
                birthDateStr = `${century}${yy}/${mm}/${dd}`;
              }
              const govCode = nid.slice(7, 9);
              const govs: Record<string, string> = {
                "01": "القاهرة", "02": "الإسكندرية", "03": "بورسعيد", "04": "السويس",
                "11": "دمياط", "12": "الدقهلية", "13": "الشرقية", "14": "القليوبية",
                "15": "كفر الشيخ", "16": "الغربية", "17": "المنوفية", "18": "البحيرة",
                "19": "الإسماعيلية", "21": "الجيزة", "22": "بني سويف", "23": "الفيوم",
                "24": "المنيا", "25": "أسيوط", "26": "سوهاج", "27": "قنا",
                "28": "أسوان", "29": "الأقصر", "31": "البحر الأحمر", "32": "الوادي الجديد",
                "33": "مطروح", "34": "شمال سيناء", "35": "جنوب سيناء"
              };
              govName = govs[govCode] || "جمهورية مصر العربية";
            }

            const dossierRef = `CK-DOS-${(selectedEmployee.id || 'EMP').slice(-6).toUpperCase()}`;

            return (
              <div
                className="content-wrapper folder-cover-page"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "277mm",
                  maxHeight: "277mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: "#0f172a",
                  fontFamily: "'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif",
                  boxSizing: "border-box",
                  padding: "8mm 10mm",
                  border: "3.5px double #0f172a",
                  background: "#ffffff",
                  overflow: "hidden",
                  lineHeight: "1.25"
                }}
              >
                {/* 1. TOP HEADER & CORPORATE BRANDING */}
                <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>

                    {/* Right: Circle K & Legal Entity Title */}
                    <div style={{ textAlign: "right", flex: 1.2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                        <span style={{
                          background: "#da291c",
                          color: "#ffffff",
                          fontWeight: "900",
                          fontSize: "12px",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          letterSpacing: "0.5px"
                        }}>
                          CIRCLE K
                        </span>
                        <span style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a" }}>
                          سيركل كي مصر - امتياز رسمي
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: "800", color: "#1e293b" }}>
                        {companyTitleAr}
                      </div>
                      <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>
                        {companySubtitleEn}
                      </div>
                      <div style={{ fontSize: "9px", color: "#475569", marginTop: "2px" }}>
                        مقر الإدارة العامة والموارد البشرية | قطاع التجزئة والتشغيل
                      </div>
                    </div>

                    {/* Center: Dossier Title Banner */}
                    <div style={{ textAlign: "center", flex: 1.6, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        padding: "5px 18px",
                        borderRadius: "6px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        width: "100%",
                        maxWidth: "280px"
                      }}>
                        <h1 style={{ fontSize: "15px", fontWeight: "900", margin: 0, letterSpacing: "0.3px" }}>
                          ملف خدمة وسجل بيانات عامل
                        </h1>
                        <p style={{ fontSize: "8.5px", margin: "2px 0 0 0", letterSpacing: "1px", opacity: 0.9, textTransform: "uppercase" }}>
                          OFFICIAL PERSONNEL DOSSIER COVER
                        </p>
                      </div>
                      <div style={{ fontSize: "8.5px", color: "#64748b", marginTop: "4px", fontWeight: "700" }}>
                        سجل معتمد وفقاً للمادة (77) من قانون العمل المصري رقم 12 لسنة 2003
                      </div>
                    </div>

                    {/* Left: Archive Metadata & Legal Reg */}
                    <div style={{ textAlign: "left", flex: 1.1, fontSize: "9.5px", color: "#1e293b", lineHeight: "1.4" }}>
                      <div style={{
                        display: "inline-block",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontWeight: "900",
                        color: "#0f172a",
                        marginBottom: "3px"
                      }}>
                        {dossierRef}
                      </div>
                      <div><strong style={{ color: "#475569" }}>الفرع:</strong> {branchTitleAr}</div>
                      <div><strong style={{ color: "#475569" }}>س.ت:</strong> {branchInfo.commReg || "114882"} | <strong style={{ color: "#475569" }}>ب.ض:</strong> {branchInfo.taxId || "482-901-332"}</div>
                      <div><strong style={{ color: "#475569" }}>تاريخ القيد:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                    </div>

                  </div>
                </div>

                {/* 2. EMPLOYEE IDENTITY CARD & PHOTO FRAME */}
                <div style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "stretch",
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "7px 10px",
                  marginTop: "4px"
                }}>

                  {/* Photo Frame (4x6 cm Official Portrait) */}
                  <div style={{
                    width: "68px",
                    height: "88px",
                    border: "1.5px solid #94a3b8",
                    borderRadius: "4px",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                    textAlign: "center"
                  }}>
                    {selectedEmployee.photoUrl ? (
                      <img
                        src={selectedEmployee.photoUrl}
                        alt={selectedEmployee.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ padding: "4px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", margin: "0 auto 3px auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "900", color: "#64748b" }}>
                          {selectedEmployee.name.charAt(0)}
                        </div>
                        <span style={{ fontSize: "7.5px", color: "#64748b", fontWeight: "bold", display: "block", lineHeight: "1.1" }}>
                          صورة حديثة<br />4 × 6
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Identity Key Fields & 14-Digit NID Box Grid */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed #cbd5e1", paddingBottom: "4px" }}>
                      <div>
                        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold" }}>الاسم الرباعي للعامل: </span>
                        <span style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a" }}>{selectedEmployee.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{
                          fontSize: "9.5px",
                          fontWeight: "800",
                          background: selectedEmployee.status === 'active' ? '#dcfce7' : selectedEmployee.status === 'suspended' ? '#fef3c7' : '#fee2e2',
                          color: selectedEmployee.status === 'active' ? '#166534' : selectedEmployee.status === 'suspended' ? '#92400e' : '#991b1b',
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: `1px solid ${selectedEmployee.status === 'active' ? '#86efac' : selectedEmployee.status === 'suspended' ? '#fcd34d' : '#fca5a5'}`
                        }}>
                          {selectedEmployee.status === 'active' ? '● بالخدمة (Active)' : selectedEmployee.status === 'suspended' ? '● موقوف مؤقتاً (Suspended)' : '● انتهت خدمته / ترك العمل (Left)'}
                        </span>
                        <span style={{
                          fontSize: "9.5px",
                          fontWeight: "800",
                          background: "#e0e7ff",
                          color: "#3730a3",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          border: "1px solid #c7d2fe"
                        }}>
                          {selectedEmployee.position}
                        </span>
                      </div>
                    </div>

                    {/* 14-Digit National ID Display Box */}
                    <div style={{ margin: "4px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span style={{ fontSize: "9px", fontWeight: "800", color: "#334155" }}>
                          الرقم القومي المصري (14 رقماً مسجلاً رسمياً):
                        </span>
                        {govName && (
                          <span style={{ fontSize: "8.5px", color: "#64748b", fontWeight: "700" }}>
                            محافظة القيد: {govName} {birthDateStr ? `| ميلاد: ${birthDateStr}` : ''}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "3px", direction: "ltr", justifyContent: "flex-end" }}>
                        {nidDigits.map((digit, idx) => (
                          <div
                            key={idx}
                            style={{
                              width: "18px",
                              height: "22px",
                              border: "1.5px solid #0f172a",
                              borderRadius: "3px",
                              background: digit !== " " ? "#ffffff" : "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: "900",
                              color: "#0f172a"
                            }}
                          >
                            {digit !== " " ? digit : "-"}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Specs summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", fontSize: "9px", color: "#334155" }}>
                      <div><strong>تاريخ استلام العمل:</strong> {selectedEmployee.startDate ? new Date(selectedEmployee.startDate).toLocaleDateString('ar-EG') : 'غير محدد'}</div>
                      <div><strong>الهاتف:</strong> {selectedEmployee.phone || 'غير مسجل'}</div>
                      <div><strong>كود الموظف:</strong> {selectedEmployee.id ? selectedEmployee.id.slice(0, 10) : '---'}</div>
                    </div>

                  </div>

                </div>

                {/* 3. STRUCTURED DATA SECTIONS */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>

                  {/* Section A: Personal & Identification */}
                  <div>
                    <div style={{
                      background: "#1e293b",
                      color: "#ffffff",
                      fontSize: "9.5px",
                      fontWeight: "900",
                      padding: "2.5px 8px",
                      borderRadius: "3px",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>أولاً: البيانات الشخصية والتعريفية للعامل</span>
                      <span style={{ fontSize: "8px", opacity: 0.8, letterSpacing: "0.5px" }}>PERSONAL & CIVIL STATUS DATA</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", marginTop: "2px" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>الاسم بالكامل:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%", fontWeight: "800" }}>{selectedEmployee.name}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>الرقم القومي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%", fontFamily: "monospace", fontSize: "10px", fontWeight: "bold" }}>{selectedEmployee.nationalId || "---"}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>السن وتاريخ الميلاد:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>{selectedEmployee.age ? `${selectedEmployee.age} سنة` : "مستوفى"} {birthDateStr ? `(${birthDateStr})` : ""}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>النوع ومحل الميلاد:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>{selectedEmployee.gender === "female" ? "أنثى" : "ذكر"} | {govName || "جمهورية مصر العربية"}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>محل الإقامة الفعلي:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>{selectedEmployee.address || "العنوان المعتمد ببطاقة الرقم القومي"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section B: Placement & Work Terms */}
                  <div>
                    <div style={{
                      background: "#1e293b",
                      color: "#ffffff",
                      fontSize: "9.5px",
                      fontWeight: "900",
                      padding: "2.5px 8px",
                      borderRadius: "3px",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثانياً: بيانات التعيين والتعاقد ونظام العمل بالفرع</span>
                      <span style={{ fontSize: "8px", opacity: 0.8, letterSpacing: "0.5px" }}>EMPLOYMENT & CONTRACT DETAILS</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", marginTop: "2px" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>المسمى الوظيفي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%", fontWeight: "800", color: "#0f172a" }}>{selectedEmployee.position}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>الفرع ومقر العمل:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%", fontWeight: "700" }}>{branchTitleAr} ({selectedEmployee.storeId || "Main"})</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>نظام التعاقد:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>{selectedEmployee.fulltime ? "دوام كامل (Full-Time - 8 ساعات)" : "دوام جزئي (Part-Time)"}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>مواعيد الوردية:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>{selectedEmployee.shiftTime || "وردية تشغيل معتمدة بجدول الفرع"}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>تاريخ مباشرة العمل:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", fontWeight: "bold" }}>{selectedEmployee.startDate ? new Date(selectedEmployee.startDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : "تاريخ التعيين الرسمي"}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>فترة الاختبار القانونية:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>ثلاثة أشهر تبدأ من تاريخ استلام العمل الفعلي</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section C: Financial, Insurance & Legal Custody Guarantees */}
                  <div>
                    <div style={{
                      background: "#1e293b",
                      color: "#ffffff",
                      fontSize: "9.5px",
                      fontWeight: "900",
                      padding: "2.5px 8px",
                      borderRadius: "3px",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثالثاً: البيانات المالية والتأمينات الاجتماعية والأمانات القانونية</span>
                      <span style={{ fontSize: "8px", opacity: 0.8, letterSpacing: "0.5px" }}>FINANCIAL, SOCIAL INSURANCE & GUARANTEE</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", marginTop: "2px" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>الراتب الأساسي الشهري:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%", fontWeight: "900", color: "#047857" }}>
                            {selectedEmployee.baseSalary ? `${selectedEmployee.baseSalary.toLocaleString()} جنيه مصري` : "محدد بعقد العمل المبرم"}
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold", width: "18%" }}>الاشتراك التأميني:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", width: "32%" }}>
                            {selectedEmployee.insurance ? `${selectedEmployee.insurance.toLocaleString()} ج.م (تأمين اجتماعي)` : "خاضع للاشتراك التأميني س 1"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>إيصال أمانة العهدة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", fontWeight: "800", color: "#b91c1c" }}>
                            {selectedEmployee.chequeSignedNum ? `إيصال مسجل برقم (${selectedEmployee.chequeSignedNum})` : "إيصال أمانة ضامن مودع بالخزينة"}
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px", background: "#f8fafc", fontWeight: "bold" }}>الالتزام المالي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3px 6px" }}>مسؤولية كاملة عن النقدية وبضائع وعهد الفرع</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section D: Statutory Labor Law Dossier Checklist */}
                  <div>
                    <div style={{
                      background: "#1e293b",
                      color: "#ffffff",
                      fontSize: "9.5px",
                      fontWeight: "900",
                      padding: "2.5px 8px",
                      borderRadius: "3px",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>رابعاً: بيان مسوغات التعيين المودعة بالملف (قانون العمل رقم 12 لسنة 2003)</span>
                      <span style={{ fontSize: "8px", opacity: 0.8, letterSpacing: "0.5px" }}>STATUTORY DOSSIER DOCUMENT CHECKLIST</span>
                    </div>
                    <div style={{
                      border: "1px solid #cbd5e1",
                      borderTop: "none",
                      padding: "5px 8px",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "3.5px 14px",
                      fontSize: "8.5px",
                      background: "#ffffff"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>أصل شهادة الميلاد المميكنة (حديثة برقم قومي)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>أصل الموقف التجنيدي / إنهاء الخدمة العسكرية والوطنية</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>صحيفة الحالة الجنائية سارية موجهة باسم الشركة</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>أصل المؤهل الدراسي / الدبلوم معتمد وموثق</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>صورة واضحة لبطاقة الرقم القومي سارية المفعول (وجهين)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>كعب العمل (شهادة قيد) معتمد من مكتب القوى العاملة المختص</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>الشهادة الصحية سارية للعاملين بمجال الأغذية والمشروبات</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>أصل عقد العمل محدد المدة موقع بالبصمة والإمضاء (3 نسخ)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>إيصال الأمانة الضامن للعهدة وإقرار استلام توصيف الوظيفة</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: "#16a34a", fontWeight: "900", fontSize: "10px" }}>[ ✔ ]</span>
                        <span>عدد (4) صور شخصية حديثة مقاس 4×6 خلفية بيضاء</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 4. OFFICIAL SIGNATURES & STAMP BOX */}
                <div style={{ marginTop: "4px" }}>
                  <div style={{
                    border: "1.5px solid #0f172a",
                    borderRadius: "5px",
                    padding: "6px 10px",
                    background: "#f8fafc"
                  }}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                      gap: "10px",
                      textAlign: "center"
                    }}>

                      {/* Employee Acknowledgment & Thumbprint */}
                      <div style={{ borderLeft: "1px dashed #cbd5e1", paddingLeft: "8px", textAlign: "right" }}>
                        <div style={{ fontSize: "9px", fontWeight: "900", color: "#0f172a", marginBottom: "2px" }}>
                          إقرار وتوقيع العامل:
                        </div>
                        <div style={{ fontSize: "7.5px", color: "#64748b", lineHeight: "1.2", marginBottom: "4px" }}>
                          أقر بصحة كافة البيانات والمستندات المودعة بالملف والالتزام بلائحة الشركة.
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "4px" }}>
                          <div style={{ fontSize: "8.5px", color: "#334155" }}>
                            التوقيع: .....................
                          </div>
                          <div style={{
                            width: "38px",
                            height: "44px",
                            border: "1px dashed #64748b",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "7.5px",
                            color: "#94a3b8"
                          }}>
                            البصمة
                          </div>
                        </div>
                      </div>

                      {/* Dossier Archiver / HR Officer */}
                      <div style={{ borderLeft: "1px dashed #cbd5e1", paddingLeft: "8px" }}>
                        <div style={{ fontSize: "9px", fontWeight: "900", color: "#0f172a", marginBottom: "2px" }}>
                          مسؤول حفظ الملفات (HR):
                        </div>
                        <div style={{ fontSize: "8px", color: "#64748b", marginBottom: "14px" }}>
                          تمت المراجعة والاستيفاء
                        </div>
                        <div style={{ fontSize: "8.5px", color: "#334155" }}>
                          التوقيع: ..........................
                        </div>
                      </div>

                      {/* HR Director */}
                      <div style={{ borderLeft: "1px dashed #cbd5e1", paddingLeft: "8px" }}>
                        <div style={{ fontSize: "9px", fontWeight: "900", color: "#0f172a", marginBottom: "2px" }}>
                          مدير الموارد البشرية:
                        </div>
                        <div style={{ fontSize: "8px", color: "#64748b", marginBottom: "14px" }}>
                          يعتمد ويقيد بالسجلات
                        </div>
                        <div style={{ fontSize: "8.5px", color: "#334155" }}>
                          الاعتماد: ..........................
                        </div>
                      </div>

                      {/* Company Seal Stamp Box */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <div style={{
                          width: "80px",
                          height: "56px",
                          border: "1.5px dashed #0f172a",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "8px",
                          fontWeight: "800",
                          color: "#94a3b8",
                          textAlign: "center"
                        }}>
                          خاتم الشركة المعتمد<br />(SEAL / STAMP)
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* 5. LEGAL ARCHIVE FOOTER */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1.5px solid #0f172a",
                  paddingTop: "3px",
                  fontSize: "8px",
                  color: "#475569",
                  fontWeight: "bold"
                }}>
                  <span>ملف خدمة وسجل رسمي خاضع لأحكام قانون العمل المصري رقم 12 لسنة 2003 ولائحته التنفيذية وقانون حماية البيانات رقم 151 لسنة 2020</span>
                  <span>(يحفظ بأرشيف شؤون العاملين بالإدارة العامة للشركة)</span>
                </div>

              </div>
            );
          }

          // IF PRINTING SALARY PROOF LETTER (HR LETTER / شهادة مفردات مرتب معتمدة)
          if (printDocumentType === 'salary_letter') {
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const base = selectedEmployee.baseSalary || 0;
            const allowance = Math.round(base * 0.15); // بدل انتقال ومظهر وانتظام
            const gross = base + allowance;
            const insurance = selectedEmployee.insurance || Math.round(base * 0.11);
            const net = Math.max(0, gross - insurance);
            const netWords = numberToArabicWords(net);
            const refCode = `HR-SAL-${(selectedEmployee.id || 'EMP').slice(-6).toUpperCase()}-${new Date().getFullYear()}`;

            return (
              <div
                className="content-wrapper salary-letter-page"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "277mm",
                  maxHeight: "277mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: "#0f172a",
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                  padding: "6mm 8mm",
                  boxSizing: "border-box"
                }}
              >
                {/* 1. OFFICIAL LETTERHEAD */}
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "3px solid #0f172a",
                    paddingBottom: "8px",
                    marginBottom: "12px"
                  }}>
                    <div style={{ textAlign: "right" }}>
                      <h1 style={{ fontSize: "20px", fontWeight: "900", margin: 0, color: "#0f172a" }}>
                        {companyTitleAr}
                      </h1>
                      <div style={{ fontSize: "12px", fontWeight: "800", color: "#334155", letterSpacing: "0.5px", textTransform: "uppercase", marginTop: "1px" }}>
                        {companySubtitleEn}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", marginTop: "2px" }}>
                        {branchTitleAr}
                      </div>
                    </div>

                    <div style={{
                      textAlign: "left",
                      fontSize: "10px",
                      lineHeight: "1.6",
                      color: "#334155",
                      fontFamily: "monospace"
                    }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>التاريخ:</strong> {todayFormatted}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم القيد:</strong> {refCode}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>س.ت:</strong> {branchInfo.commReg}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>ب.ض:</strong> {branchInfo.taxId}</div>
                    </div>
                  </div>

                  {/* 2. DOCUMENT TITLE BADGE */}
                  <div style={{ textAlign: "center", margin: "16px 0 14px 0" }}>
                    <div style={{
                      display: "inline-block",
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "6px 28px",
                      borderRadius: "6px",
                      textAlign: "center"
                    }}>
                      <h2 style={{ fontSize: "16px", fontWeight: "900", margin: 0, letterSpacing: "0.5px" }}>
                        شهادة مفردات وتحديد دخل شهري معتمدة
                      </h2>
                      <div style={{ fontSize: "9px", fontWeight: "bold", opacity: 0.9, letterSpacing: "1px", textTransform: "uppercase", marginTop: "2px" }}>
                        OFFICIAL SALARY & INCOME CERTIFICATE
                      </div>
                    </div>
                  </div>

                  {/* 3. ADDRESSED TO */}
                  <div style={{ marginBottom: "12px", fontSize: "12px", fontWeight: "bold", color: "#1e293b" }}>
                    <div style={{ fontSize: "13px", fontWeight: "900", marginBottom: "4px" }}>
                      السيد الأستاذ / مدير عام الجهة المختصة الموقر
                    </div>
                    <div style={{ color: "#475569" }}>تحية طيبة واحتراماً وبعد ،،،</div>
                    <div style={{ color: "#0f172a", fontWeight: "900", marginTop: "4px", textDecoration: "underline", textUnderlineOffset: "4px" }}>
                      إلى من يهمه الأمر (To Whom It May Concern):
                    </div>
                  </div>

                  {/* 4. CERTIFICATION NARRATIVE */}
                  <div style={{
                    fontSize: "11.5px",
                    lineHeight: "1.9",
                    textAlign: "justify",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    marginBottom: "14px"
                  }}>
                    تشهد شركة <strong>{companyTitleAr} ({companySubtitleEn})</strong> بأن السيد / <strong style={{ fontSize: "13px", color: "#0f172a" }}>{selectedEmployee.name}</strong>، مصري الجنسية، ويحمل بطاقة الرقم القومي رقم (<span style={{ fontFamily: "monospace", fontWeight: "900", letterSpacing: "1px" }}>{selectedEmployee.nationalId || "----------------"}</span>)، يعمل لدى الشركة بوظيفة (<strong style={{ color: "#0f172a" }}>{selectedEmployee.position}</strong>) بـ{branchTitleAr}، وذلك اعتباراً من تاريخ استلامه العمل في <strong>{selectedEmployee.startDate || "محدد بالعقد"}</strong> وحتى تاريخه، وما زال مستمراً في أداء واجباته الوظيفية بالشركة حتى الآن ومقيداً بسجلات شؤون العاملين، ويتقاضى دخلاً شهرياً وفقاً للتفصيل المعتمد أدناه:
                  </div>

                  {/* 5. STRUCTURED SALARY BREAKDOWN TABLE */}
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
                    marginBottom: "10px"
                  }}>
                    <thead>
                      <tr style={{ background: "#0f172a", color: "#ffffff" }}>
                        <th style={{ border: "1px solid #0f172a", padding: "6px 10px", textAlign: "right", width: "40%" }}>بند الاستحقاق / الاستقطاع الشهري</th>
                        <th style={{ border: "1px solid #0f172a", padding: "6px 10px", textAlign: "center", width: "25%" }}>المبلغ بالجنيه المصري (EGP)</th>
                        <th style={{ border: "1px solid #0f172a", padding: "6px 10px", textAlign: "right", width: "35%" }}>البيان والتوصيف القانوني</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f8fafc" }}>الراتب الأساسي التعاقدي (Basic Salary):</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12px" }}>
                          {base.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", color: "#475569" }}>الأجر الأساسي المنصوص عليه بعقد العمل</td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f8fafc" }}>بدل انتقال ومظهر وبدل طبيعة عمل:</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12px" }}>
                          {allowance.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", color: "#475569" }}>بدلات شهرية ثابتة مرتبطة بالوظيفة</td>
                      </tr>
                      <tr style={{ background: "#f1f5f9" }}>
                        <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", fontWeight: "900", color: "#0f172a" }}>إجمالي الدخل الشهري الشامل (Gross Salary):</td>
                        <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>
                          {gross.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", fontWeight: "bold", color: "#0f172a" }}>إجمالي الاستحقاقات قبل الاستقطاعات</td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", color: "#b91c1c", background: "#fef2f2" }}>استقطاع التأمينات الاجتماعية (س1):</td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12px", color: "#b91c1c" }}>
                          ({insurance.toLocaleString()}) ج.م
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", color: "#b91c1c" }}>حصة العامل في التأمين الاجتماعي المصري</td>
                      </tr>
                      <tr style={{ background: "#ecfdf5" }}>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", fontWeight: "900", fontSize: "12px", color: "#047857" }}>صافي الراتب الشهري المنصرف (Net Salary):</td>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "14px", color: "#047857" }}>
                          {net.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", fontWeight: "bold", color: "#047857" }}>صافي ما يتقاضاه العامل شهرياً</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* 6. TAFQEET CALLOUT */}
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: "900",
                    color: "#166534",
                    marginBottom: "12px"
                  }}>
                    <span>فقط وقدره: </span>
                    <span style={{ textDecoration: "underline" }}>{netWords}</span>
                    <span> لا غير، يتم صرفها بانتظام بنهاية كل شهر ميلادي.</span>
                  </div>

                  {/* 7. LEGAL DISCLAIMER */}
                  <div style={{
                    fontSize: "9.5px",
                    color: "#475569",
                    lineHeight: "1.6",
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "4px",
                    padding: "6px 10px"
                  }}>
                    <strong>إقرار وإخلاء مسؤولية:</strong> أُعطيت هذه الشهادة للموظف المذكور بناءً على طلبه الصريح لتقديمها لمن يهمه الأمر دون أي مسؤولية أو التزام مالي أو كفالة تضامنية على الشركة تجاه الغير، ولا تُعد هذه الشهادة ضماناً شخصياً أو كفالة لقروض أو تسهيلات بنكية ما لم يرفق بها خطاب تحويل راتب رسمي صادر من الإدارة المالية للشركة.
                  </div>
                </div>

                {/* 8. SIGNATURES & OFFICIAL CORPORATE STAMP */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 150px",
                    gap: "12px",
                    alignItems: "end",
                    borderTop: "1.5px solid #0f172a",
                    paddingTop: "10px",
                    marginBottom: "6px"
                  }}>
                    {/* Payroll Officer */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: "900", color: "#0f172a" }}>مسؤول قسم الرواتب:</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 24px 0" }}>مراجع الحسابات والرواتب</div>
                      <div style={{ fontSize: "9.5px", color: "#334155" }}>التوقيع: ................................</div>
                    </div>

                    {/* HR Director */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: "900", color: "#0f172a" }}>مدير عام الموارد البشرية:</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 24px 0" }}>يعتمد ويختم بخاتم الشركة</div>
                      <div style={{ fontSize: "9.5px", color: "#334155" }}>الاعتماد: ................................</div>
                    </div>

                    {/* OFFICIAL STAMP BOX - MATCHING OLA / ANH STAMP EXACTLY */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <div style={{
                        width: "135px",
                        height: "82px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "4px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        boxShadow: "inset 0 0 0 1px #1e3a8a"
                      }}>
                        <div style={{ fontSize: "11px", fontWeight: "900", lineHeight: "1.2" }}>
                          {companyTitleAr}
                        </div>
                        <div style={{ fontSize: "8.5px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          {companySubtitleEn}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace", marginTop: "3px" }}>
                          س.ت : {branchInfo.commReg}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace" }}>
                          ب.ض : {branchInfo.taxId}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legal Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "3px",
                    fontSize: "8px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>{companyTitleAr} - الإدارة العامة وشؤون العاملين</span>
                    <span>سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId}</span>
                  </div>
                </div>
              </div>
            );
          }

          // IF PRINTING EXPERIENCE CERTIFICATE (ARTICLE 130 EGYPTIAN LABOR LAW)
          if (printDocumentType === 'experience_cert') {
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const refCode = `HR-EXP-${(selectedEmployee.id || 'EMP').slice(-6).toUpperCase()}-${new Date().getFullYear()}`;

            return (
              <div
                className="content-wrapper experience-cert-page"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "277mm",
                  maxHeight: "277mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: "#0f172a",
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                  padding: "8mm 10mm",
                  boxSizing: "border-box"
                }}
              >
                {/* 1. OFFICIAL LETTERHEAD */}
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "3px solid #0f172a",
                    paddingBottom: "8px",
                    marginBottom: "16px"
                  }}>
                    <div style={{ textAlign: "right" }}>
                      <h1 style={{ fontSize: "20px", fontWeight: "900", margin: 0, color: "#0f172a" }}>
                        {companyTitleAr}
                      </h1>
                      <div style={{ fontSize: "12px", fontWeight: "800", color: "#334155", letterSpacing: "0.5px", textTransform: "uppercase", marginTop: "1px" }}>
                        {companySubtitleEn}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", marginTop: "2px" }}>
                        {branchTitleAr}
                      </div>
                    </div>

                    <div style={{
                      textAlign: "left",
                      fontSize: "10px",
                      lineHeight: "1.6",
                      color: "#334155",
                      fontFamily: "monospace"
                    }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>التاريخ:</strong> {todayFormatted}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم الوثيقة:</strong> {refCode}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>س.ت:</strong> {branchInfo.commReg}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>ب.ض:</strong> {branchInfo.taxId}</div>
                    </div>
                  </div>

                  {/* 2. STATUTORY LEGAL TITLE */}
                  <div style={{ textAlign: "center", margin: "20px 0 16px 0" }}>
                    <div style={{
                      display: "inline-block",
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "8px 36px",
                      borderRadius: "6px",
                      textAlign: "center"
                    }}>
                      <h2 style={{ fontSize: "18px", fontWeight: "900", margin: 0, letterSpacing: "0.5px" }}>
                        شهادة خبرة وإفادة خدمة رسمية
                      </h2>
                      <div style={{ fontSize: "10px", fontWeight: "bold", opacity: 0.9, letterSpacing: "1px", textTransform: "uppercase", marginTop: "3px" }}>
                        OFFICIAL CERTIFICATE OF SERVICE & EXPERIENCE
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", marginTop: "8px" }}>
                      صادرة إعمالاً لأحكام المادة (130) من قانون العمل المصري الصادر بالقانون رقم 12 لسنة 2003
                    </div>
                  </div>

                  {/* 3. CERTIFICATION TEXT */}
                  <div style={{
                    fontSize: "12px",
                    lineHeight: "2.1",
                    textAlign: "justify",
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "16px 20px",
                    marginBottom: "16px"
                  }}>
                    <p style={{ margin: "0 0 12px 0" }}>
                      تشهد إدارة شركة <strong>{companyTitleAr} ({companySubtitleEn})</strong> بأن السيد / <strong style={{ fontSize: "14px", color: "#0f172a" }}>{selectedEmployee.name}</strong>، مصري الجنسية، ويحمل بطاقة الرقم القومي رقم (<span style={{ fontFamily: "monospace", fontWeight: "900", fontSize: "13px", letterSpacing: "1px" }}>{selectedEmployee.nationalId || "----------------"}</span>)، قد التحق بالعمل لدى شركتنا بفرع ({branchTitleAr}) وشغل وظيفة:
                    </p>

                    <div style={{
                      background: "#ffffff",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "10px 16px",
                      margin: "10px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold" }}>المسمى الوظيفي: </span>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{selectedEmployee.position}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold" }}>مدة الخدمة: </span>
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                          من {selectedEmployee.startDate || "تاريخ التعيين"} وحتى {todayFormatted}
                        </strong>
                      </div>
                    </div>

                    <p style={{ margin: "12px 0 0 0" }}>
                      وطوال فترة خدمته وعمله لدى الشركة، كان مثالاً للموظف الكفء المتفاني والمخلص في أداء مهام وواجبات وظيفته، مشهوداً له بحسن السير والسلوك، والأمانة التامة، والالتزام بكافة اللوائح والتعليمات الداخلية المنظمة للعمل وأنظمة الشركة.
                    </p>

                    <p style={{ margin: "12px 0 0 0" }}>
                      كما تقر إدارة الشركة بأنه قد <strong>أخلى طرفه بالكامل</strong> من كافة العهد النقدية والعينية والبضائع المسندة إليه، وسدد ما بذمته للشركة، وليس للشركة أي مطالبات مالية أو قانونية تجاهه حتى تاريخ إخلاء الطرف.
                    </p>
                  </div>

                  {/* 4. LEGAL DISCLAIMER */}
                  <div style={{
                    fontSize: "10px",
                    color: "#475569",
                    lineHeight: "1.7",
                    background: "#f1f5f9",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "6px",
                    padding: "8px 14px"
                  }}>
                    مُنحت له هذه الشهادة الرسمية بناءً على طلبه الصريح لتقديمها لمن يهمه الأمر دون أدنى مسؤولية أو التزام على الشركة تجاه الغير، وتتمنى له إدارة الشركة دوام التوفيق والنجاح في مسيرته المهنية المستقبلية.
                  </div>
                </div>

                {/* 5. SIGNATURES & OFFICIAL CORPORATE STAMP */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 150px",
                    gap: "14px",
                    alignItems: "end",
                    borderTop: "1.5px solid #0f172a",
                    paddingTop: "12px",
                    marginBottom: "8px"
                  }}>
                    {/* HR Officer */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10.5px", fontWeight: "900", color: "#0f172a" }}>مسؤول شؤون العاملين:</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 28px 0" }}>تمت مراجعة واستيفاء السجلات</div>
                      <div style={{ fontSize: "10px", color: "#334155" }}>التوقيع: ................................</div>
                    </div>

                    {/* General Manager */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10.5px", fontWeight: "900", color: "#0f172a" }}>المدير العام / العضو المنتدب:</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 28px 0" }}>يعتمد رسمياً</div>
                      <div style={{ fontSize: "10px", color: "#334155" }}>الاعتماد: ................................</div>
                    </div>

                    {/* OFFICIAL STAMP BOX - MATCHING OLA / ANH STAMP EXACTLY */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <div style={{
                        width: "138px",
                        height: "85px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "5px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        boxShadow: "inset 0 0 0 1px #1e3a8a"
                      }}>
                        <div style={{ fontSize: "11px", fontWeight: "900", lineHeight: "1.2" }}>
                          {companyTitleAr}
                        </div>
                        <div style={{ fontSize: "8.5px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          {companySubtitleEn}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace", marginTop: "3px" }}>
                          س.ت : {branchInfo.commReg}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace" }}>
                          ب.ض : {branchInfo.taxId}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legal Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "3px",
                    fontSize: "8.5px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>{companyTitleAr} - إدارة الموارد البشرية وشؤون العاملين</span>
                    <span>سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId}</span>
                  </div>
                </div>
              </div>
            );
          }

          // IF PRINTING BANK ACCOUNT OPENING MANDATE (خطاب فتح حساب بنكي وتحويل راتب)
          if (printDocumentType === 'bank_mandate') {
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const refCode = `HR-BNK-${(selectedEmployee.id || 'EMP').slice(-6).toUpperCase()}-${new Date().getFullYear()}`;
            const targetBank = selectedEmployee.bankName || "البنك الأهلي المصري / بنك مصر / CIB";

            return (
              <div
                className="content-wrapper bank-mandate-page"
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  height: "277mm",
                  maxHeight: "277mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  color: "#0f172a",
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                  padding: "8mm 10mm",
                  boxSizing: "border-box"
                }}
              >
                {/* 1. OFFICIAL LETTERHEAD */}
                <div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "3px solid #0f172a",
                    paddingBottom: "8px",
                    marginBottom: "16px"
                  }}>
                    <div style={{ textAlign: "right" }}>
                      <h1 style={{ fontSize: "20px", fontWeight: "900", margin: 0, color: "#0f172a" }}>
                        {companyTitleAr}
                      </h1>
                      <div style={{ fontSize: "12px", fontWeight: "800", color: "#334155", letterSpacing: "0.5px", textTransform: "uppercase", marginTop: "1px" }}>
                        {companySubtitleEn}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", marginTop: "2px" }}>
                        {branchTitleAr}
                      </div>
                    </div>

                    <div style={{
                      textAlign: "left",
                      fontSize: "10px",
                      lineHeight: "1.6",
                      color: "#334155",
                      fontFamily: "monospace"
                    }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>التاريخ:</strong> {todayFormatted}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم الخطاب:</strong> {refCode}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>س.ت:</strong> {branchInfo.commReg}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>ب.ض:</strong> {branchInfo.taxId}</div>
                    </div>
                  </div>

                  {/* 2. ADDRESSED TO BANK */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                      السيد الأستاذ / مدير فرع ({targetBank}) المحترم
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", marginTop: "2px" }}>
                      عناية السيد / رئيس قسم خدمة العملاء والرواتب (Payroll Services Dept.)
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#334155", marginTop: "4px" }}>
                      تحية طيبة واحتراماً وبعد ،،،
                    </div>
                  </div>

                  {/* 3. SUBJECT BADGE */}
                  <div style={{ textAlign: "center", margin: "14px 0 16px 0" }}>
                    <div style={{
                      display: "inline-block",
                      background: "#0f172a",
                      color: "#ffffff",
                      padding: "8px 30px",
                      borderRadius: "6px",
                      textAlign: "center"
                    }}>
                      <h2 style={{ fontSize: "15px", fontWeight: "900", margin: 0, letterSpacing: "0.5px" }}>
                        طلب فتح حساب بنكي وتحويل راتب شهري
                      </h2>
                      <div style={{ fontSize: "9.5px", fontWeight: "bold", opacity: 0.9, letterSpacing: "1px", textTransform: "uppercase", marginTop: "2px" }}>
                        CORPORATE PAYROLL ACCOUNT MANDATE
                      </div>
                    </div>
                  </div>

                  {/* 4. INTRODUCTORY BODY */}
                  <div style={{
                    fontSize: "11.5px",
                    lineHeight: "1.9",
                    textAlign: "justify",
                    marginBottom: "12px",
                    color: "#1e293b"
                  }}>
                    تهديكم شركة <strong>{companyTitleAr} ({companySubtitleEn})</strong> أطيب تحياتها وخالص تمنياتها لمصرفكم الموقر بدوام التقدم والازدهار.
                    <br />
                    في إطار خطة الشركة لتعزيز منظومة الشمول المالي وتحويل رواتب العاملين إلكترونياً، يرجى التكرم بالموافقة على <strong>فتح حساب جاري / حساب مرتبات (Payroll Account)</strong> للموظف التابع لشركتنا والموضحة بياناته أدناه:
                  </div>

                  {/* 5. EMPLOYEE PROFILE CARD TABLE */}
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
                    marginBottom: "14px",
                    background: "#f8fafc"
                  }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", width: "20%", background: "#f1f5f9" }}>اسم الموظف رباعياً:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", width: "40%", fontWeight: "900", fontSize: "12px", color: "#0f172a" }}>
                          {selectedEmployee.name}
                        </td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", width: "18%", background: "#f1f5f9" }}>الرقم القومي:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", width: "22%", fontFamily: "monospace", fontWeight: "900", fontSize: "12px" }}>
                          {selectedEmployee.nationalId || "----------------"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f1f5f9" }}>الوظيفة / المسمى:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", color: "#0f172a" }}>
                          {selectedEmployee.position}
                        </td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f1f5f9" }}>تاريخ التعيين:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px" }}>
                          {selectedEmployee.startDate || "محدد بالعقد"}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f1f5f9" }}>فرع العمل التابع له:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold" }}>
                          {branchTitleAr}
                        </td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f1f5f9" }}>صافي الراتب الشهري:</td>
                        <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontFamily: "monospace", fontWeight: "900", color: "#047857" }}>
                          {(selectedEmployee.baseSalary || 0).toLocaleString()} ج.م
                        </td>
                      </tr>
                      {selectedEmployee.bankIbanOrAccount && (
                        <tr>
                          <td style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", background: "#f1f5f9" }}>رقم الحساب / IBAN:</td>
                          <td colSpan={3} style={{ border: "1.5px solid #cbd5e1", padding: "6px 10px", fontFamily: "monospace", fontWeight: "900" }}>
                            {selectedEmployee.bankIbanOrAccount}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* 6. CORPORATE UNDERTAKING & COMMITMENT */}
                  <div style={{
                    fontSize: "11px",
                    lineHeight: "1.8",
                    background: "#ecfdf5",
                    border: "1.5px solid #a7f3d0",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    color: "#065f46"
                  }}>
                    <strong>تعهد الشركة بتحويل الراتب:</strong>
                    <br />
                    تتعهد شركة <strong>{companyTitleAr}</strong> بتحويل الراتب الشهري المستحق للموظف المذكور إلى حسابه المفتوح طرفكم بانتظام شهرياً طوال فترة سريان عقد عمله بالشركة، كما تتعهد الشركة بإخطار مصرفكم الموقر فوراً وبكتاب رسمي في حالة انتهاء خدمة الموظف أو استقالته أو تركه العمل لأي سبب من الأسباب.
                  </div>

                  <div style={{ fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>
                    * مرفق بهذا الخطاب صورة ضوئية واضحة من بطاقة الرقم القومي للموظف سارية المفعول بعد مطابقتها بالأصل.
                  </div>
                </div>

                {/* 7. SIGNATURES & OFFICIAL CORPORATE STAMP */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 150px",
                    gap: "12px",
                    alignItems: "end",
                    borderTop: "1.5px solid #0f172a",
                    paddingTop: "12px",
                    marginBottom: "8px"
                  }}>
                    {/* Finance Director */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10.5px", fontWeight: "900", color: "#0f172a" }}>المدير المالي (Finance):</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 28px 0" }}>مسؤول صرف وتحويل الرواتب</div>
                      <div style={{ fontSize: "10px", color: "#334155" }}>التوقيع: ................................</div>
                    </div>

                    {/* Managing Director */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10.5px", fontWeight: "900", color: "#0f172a" }}>المدير العام (Managing Director):</div>
                      <div style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 28px 0" }}>المفوض بالتوقيع والاعتماد</div>
                      <div style={{ fontSize: "10px", color: "#334155" }}>الاعتماد: ................................</div>
                    </div>

                    {/* OFFICIAL STAMP BOX - MATCHING OLA / ANH STAMP EXACTLY */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <div style={{
                        width: "138px",
                        height: "85px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "5px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        boxShadow: "inset 0 0 0 1px #1e3a8a"
                      }}>
                        <div style={{ fontSize: "11px", fontWeight: "900", lineHeight: "1.2" }}>
                          {companyTitleAr}
                        </div>
                        <div style={{ fontSize: "8.5px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          {companySubtitleEn}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace", marginTop: "3px" }}>
                          س.ت : {branchInfo.commReg}
                        </div>
                        <div style={{ fontSize: "8px", fontWeight: "900", fontFamily: "monospace" }}>
                          ب.ض : {branchInfo.taxId}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legal Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "3px",
                    fontSize: "8.5px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>{companyTitleAr} - إدارة الرواتب والشؤون الإدارية والمالية</span>
                    <span>سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId}</span>
                  </div>
                </div>
              </div>
            );
          }

          // DEFAULT: PRINT CONTRACT
          return (
            <div className="content-wrapper" style={{ maxWidth: "800px", margin: "0 auto", color: "#000", fontFamily: "'Cairo', 'Tajawal', system-ui, sans-serif" }}>

              {/* Header / Letterhead */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #000", paddingBottom: "10px", marginBottom: "20px" }}>
                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "22px", fontWeight: "900", margin: 0, color: "#000" }}>{companyTitleAr}</h1>
                  <h2 style={{ fontSize: "14px", margin: "3px 0 0 0", color: "#333", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>{companySubtitleEn}</h2>
                </div>
                <div style={{ textAlign: "left", fontSize: "13px", lineHeight: "1.4" }}>
                  <div><span style={{ fontWeight: "bold" }}>التاريخ:</span> {new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString('ar-EG')}</div>
                  <div><span style={{ fontWeight: "bold" }}>الموافق:</span> {new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString('ar-EG', { weekday: 'long' })}</div>
                </div>
              </div>

              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "900", margin: 0, textDecoration: "underline", textUnderlineOffset: "6px" }}>عقد عمل محدد المدة</h2>
                <p style={{ fontSize: "14px", margin: "8px 0 0 0", color: "#222", fontWeight: "bold" }}>يخضع لأحكام قانون العمل المصري رقم 12 لسنة 2003</p>
              </div>

              <p style={{ textAlign: "justify", marginBottom: "20px", fontSize: "15px", lineHeight: "1.6" }}>
                إنه في يوم <span style={{ fontWeight: "bold", borderBottom: "1px dotted #000" }}>{new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString('ar-EG', { weekday: 'long' })}</span> الموافق <span style={{ fontWeight: "bold", borderBottom: "1px dotted #000" }}>{new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString('ar-EG')}</span>، تم الاتفاق والتراضي بين كل من:
              </p>

              {/* Parties */}
              <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "25px" }}>

                <div style={{ padding: "12px", border: "1px solid #000", borderRadius: "4px", backgroundColor: "#fff", pageBreakInside: "avoid" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 10px 0", color: "#000", borderBottom: "1px solid #000", paddingBottom: "5px", display: "inline-block" }}>الطرف الأول (صاحب العمل):</h3>
                  <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0", width: "120px", verticalAlign: "top" }}>اسم الشركة:</td>
                        <td style={{ padding: "4px 0" }}>{companyPartyName}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0", verticalAlign: "top" }}>المقر الرئيسي:</td>
                        <td style={{ padding: "4px 0" }}>[عنوان الشركة الرئيسي]</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0", verticalAlign: "top" }}>يمثلها قانوناً:</td>
                        <td style={{ padding: "4px 0" }}>السيد/ مدير الموارد البشرية (بصفته)</td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>ويشار إليه فيما بعد في هذا العقد بـ <strong>"الطرف الأول"</strong> أو <strong>"الشركة"</strong>.</p>
                </div>

                <div style={{ padding: "12px", border: "1px solid #000", borderRadius: "4px", backgroundColor: "#fff", pageBreakInside: "avoid" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 10px 0", color: "#000", borderBottom: "1px solid #000", paddingBottom: "5px", display: "inline-block" }}>الطرف الثاني (العامل):</h3>
                  <table style={{ width: "100%", fontSize: "14px", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0", width: "110px" }}>الاسم رباعياً:</td>
                        <td style={{ padding: "4px 0" }}>{selectedEmployee.name}</td>
                        <td style={{ fontWeight: "bold", padding: "4px 0", width: "90px" }}>الرقم القومي:</td>
                        <td style={{ padding: "4px 0" }}>{selectedEmployee.nationalId || "------------------"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0" }}>الوظيفة/المسمى:</td>
                        <td style={{ padding: "4px 0" }}>{selectedEmployee.position}</td>
                        <td style={{ fontWeight: "bold", padding: "4px 0" }}>تاريخ الاستلام:</td>
                        <td style={{ padding: "4px 0" }}>{selectedEmployee.startDate}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0" }}>رقم الهاتف:</td>
                        <td style={{ padding: "4px 0" }}><span dir="ltr">{selectedEmployee.phone || "------------------"}</span></td>
                        <td style={{ fontWeight: "bold", padding: "4px 0" }}>النوع:</td>
                        <td style={{ padding: "4px 0" }}>{selectedEmployee.gender === 'Male' ? 'ذكر' : selectedEmployee.gender === 'Female' ? 'أنثى' : (selectedEmployee.gender || "------------------")}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: "bold", padding: "4px 0", verticalAlign: "top" }}>العنوان التفصيلي:</td>
                        <td colSpan={3} style={{ padding: "4px 0" }}>{selectedEmployee.address || "--------------------------------------------------------"}</td>
                      </tr>
                      {selectedEmployee.chequeSignedNum && (
                        <tr>
                          <td style={{ fontWeight: "bold", padding: "4px 0", verticalAlign: "top" }}>رقم إيصال أمانة:</td>
                          <td colSpan={3} style={{ padding: "4px 0" }}>{selectedEmployee.chequeSignedNum}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>ويشار إليه فيما بعد في هذا العقد بـ <strong>"الطرف الثاني"</strong> أو <strong>"العامل"</strong>.</p>
                </div>

              </div>

              <p style={{ textAlign: "justify", marginBottom: "20px", fontSize: "15px", fontWeight: "bold", lineHeight: "1.6" }}>
                بعد أن أقر الطرفان بأهليتهما القانونية والفعلية للتعاقد والتصرف، اتفقا على إبرام هذا العقد وفقاً للشروط والبنود التالية:
              </p>

              {/* Clauses */}
              <div style={{ textAlign: "justify", fontSize: "14px", lineHeight: "1.6" }}>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الأول: طبيعة العمل ومقره</h4>
                  <p style={{ margin: 0 }}>
                    يعمل الطرف الثاني لدى الطرف الأول وتحت إدارته وإشرافه بوظيفة <span style={{ fontWeight: "bold" }}>({selectedEmployee.position})</span>. ويكون مقر عمله الأساسي في أي من فروع الشركة أو المواقع التي تحددها الشركة داخل جمهورية مصر العربية، ولا يعتبر نقل العامل من مكان لآخر تعديلاً في شروط العقد طالما لم يمس الحقوق المالية للعامل وفقاً لقانون العمل.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الثاني: مدة العقد وفترة الاختبار</h4>
                  <p style={{ margin: 0 }}>
                    أ) مدة هذا العقد <span style={{ fontWeight: "bold" }}>سنة ميلادية واحدة</span> تبدأ من تاريخ استلام العمل الفعلي في {selectedEmployee.startDate}، وتتجدد تلقائياً لمدد مماثلة ما لم يخطر أحد الطرفين الآخر برغبته في عدم التجديد كتابياً قبل انتهاء المدة بشهر على الأقل.<br />
                    ب) يخضع الطرف الثاني لفترة اختبار مدتها <span style={{ fontWeight: "bold" }}>ثلاثة أشهر</span> متصلة تبدأ من تاريخ استلام العمل. يحق للطرف الأول خلالها أو بنهايتها إنهاء هذا العقد بعد توجيه إنذار كتابي مسبق للطرف الثاني، ودون الحاجة إلى تعويض إذا ثبت عدم صلاحية الطرف الثاني للعمل.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الثالث: الأجر والبدلات</h4>
                  <p style={{ margin: 0 }}>
                    يستحق الطرف الثاني نظير قيامه بالعمل أجراً أساسياً وشاملاً قدره <span style={{ fontWeight: "bold" }}>{fmtCurrency(selectedEmployee.baseSalary)}</span> (فقط {selectedEmployee.baseSalary} جنيه مصري لا غير) شهرياً. يشمل هذا الأجر كافة البدلات (غلاء معيشة، انتقال، وجبة، إلخ). ويصرف الأجر في نهاية كل شهر ميلادي أو خلال الأيام الخمسة الأولى من الشهر التالي، وذلك بعد استقطاع الضرائب المستحقة وحصة العامل في التأمينات الاجتماعية وأية استقطاعات قانونية أخرى.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الرابع: ساعات العمل والإجازات</h4>
                  <p style={{ margin: 0 }}>
                    أ) <span style={{ fontWeight: "bold" }}>ساعات العمل:</span> يلتزم الطرف الثاني بالعمل لمدة 8 ساعات يومياً (أو 48 ساعة أسبوعياً كحد أقصى) تتخللها فترة راحة، وفقاً لجداول التشغيل التي تقررها إدارة الشركة.<br />
                    ب) <span style={{ fontWeight: "bold" }}>الإجازات:</span> يستحق الطرف الثاني إجازة سنوية مدفوعة الأجر مدتها 21 يوماً بعد إمضاء ستة أشهر متصلة في الخدمة، وتزاد إلى 30 يوماً لمن أمضى عشر سنوات فأكثر، بالإضافة إلى الإجازات الرسمية والمرضية المقررة بقانون العمل المصري.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الخامس: الالتزامات والسرية والمنافسة</h4>
                  <p style={{ margin: 0 }}>
                    يلتزم الطرف الثاني بأداء عمله بأمانة وشرف، وتنفيذ تعليمات الرؤساء، والمحافظة على ممتلكات الشركة وأموالها. كما يلتزم التزاماً تاماً بالمحافظة على أسرار العمل وعدم إفشاء أية معلومات تجارية أو فنية أو مالية تخص الشركة أو عملائها سواء أثناء سريان العقد أو بعد انتهائه. ويحظر عليه العمل لدى الغير (بأجر أو بدون أجر) طوال مدة سريان هذا العقد.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند السادس: الجزاءات وفسخ العقد</h4>
                  <p style={{ margin: 0 }}>
                    يحق للطرف الأول توقيع الجزاءات التأديبية المنصوص عليها بلائحة الشركة وقانون العمل في حال مخالفة الطرف الثاني لواجباته. كما يحق للطرف الأول فسخ العقد فوراً ودون إنذار أو تعويض في الحالات المنصوص عليها في المادة (69) من قانون العمل رقم 12 لسنة 2003 (مثل: انتحال شخصية مزورة، إفشاء أسرار الشركة، ارتكاب خطأ جسيم نشأ عنه ضرر مادي بالغ، الغياب بدون إذن لأكثر من 20 يوماً متقطعة أو 10 أيام متصلة، إلخ).
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند السابع: الاستقالة وإخطار ترك العمل</h4>
                  <p style={{ margin: 0 }}>
                    في حال رغبة الطرف الثاني في إنهاء العقد والاستقالة من العمل قبل انتهاء مدته، يلتزم بتقديم إخطار كتابي (إنذار) للطرف الأول قبل موعد ترك العمل بمدة لا تقل عن <span style={{ fontWeight: "bold" }}>عشرين (20) يوماً</span>. ولا يعتد بترك العمل إلا بعد تسوية كافة العهد والأمور المالية الخاصة بالشركة. وفي حال إخلاله بهذا الشرط، يحق للشركة خصم أو المطالبة بالتعويض المناسب نظير فترة الإخطار وفقاً لأحكام قانون العمل.
                  </p>
                </div>

                <div style={{ marginBottom: "15px", paddingRight: "10px", borderRight: "3px solid #000", pageBreakInside: "avoid" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند الثامن: أحكام عامة ونسخ العقد</h4>
                  <p style={{ margin: 0 }}>
                    أ) يعتبر العنوان المذكور بصدر هذا العقد هو الموطن القانوني المختار للطرف الثاني، وتعتبر كافة المراسلات والإعلانات المرسلة إليه على هذا العنوان صحيحة ومنتجة لآثارها القانونية.<br />
                    ب) كل ما لم يرد بشأنه نص خاص في هذا العقد يخضع لأحكام قانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات الاجتماعية رقم 148 لسنة 2019.<br />
                    ج) حرر هذا العقد من ثلاث نسخ أصلية، تسلم الطرف الثاني نسخة منها للعمل بموجبها، وتحتفظ الشركة بنسخة بملف خدمة العامل، وتودع النسخة الثالثة بمكتب التأمينات الاجتماعية المختص.
                  </p>
                </div>
              </div>

              {/* Advanced Signature Page */}
              <div style={{ pageBreakBefore: "always", paddingTop: "10px" }}>
                <div style={{ padding: "10px", backgroundColor: "#fff", display: "block" }}>
                  <div style={{ textAlign: "center", borderBottom: "3px double #000", paddingBottom: "15px", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "22px", fontWeight: "900", margin: "0 0 5px 0" }}>ملحق التصديق والمصادقة النهائية</h2>
                    <p style={{ fontSize: "14px", margin: 0, color: "#444", fontWeight: "bold" }}>تعتبر هذه الوثيقة جزءاً لا يتجزأ من عقد العمل المحرر بتاريخ {new Date(selectedEmployee.startDate || Date.now()).toLocaleDateString('ar-EG')}</p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px" }}>
                    {/* Party A */}
                    <div style={{ width: "46%", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fafafa" }}>
                      <h4 style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 20px 0", color: "#000", borderBottom: "2px solid #000", display: "inline-block", paddingBottom: "5px" }}>الطرف الأول (صاحب العمل)</h4>
                      <div style={{ display: "flex", marginBottom: "15px", fontSize: "15px" }}>
                        <span style={{ fontWeight: "bold", width: "70px" }}>الاسم:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", fontWeight: "bold" }}>{companyTitleAr}</div>
                      </div>
                      <div style={{ display: "flex", marginBottom: "15px", fontSize: "15px" }}>
                        <span style={{ fontWeight: "bold", width: "70px" }}>الصفة:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000" }}>مدير الموارد البشرية</div>
                      </div>
                      <div style={{ display: "flex", marginBottom: "20px", fontSize: "15px", alignItems: "flex-end" }}>
                        <span style={{ fontWeight: "bold", width: "70px" }}>التوقيع:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", height: "30px" }}></div>
                      </div>
                      <div style={{ textAlign: "center", marginTop: "30px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "13px", color: "#555" }}>خاتم الشركة (الختم الرسمي)</span>
                        <div style={{ height: "90px", width: "90px", border: "2px dashed #999", borderRadius: "50%", margin: "10px auto 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "12px" }}>
                          مكان الختم
                        </div>
                      </div>
                    </div>

                    {/* Party B */}
                    <div style={{ width: "46%", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#fafafa" }}>
                      <h4 style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 20px 0", color: "#000", borderBottom: "2px solid #000", display: "inline-block", paddingBottom: "5px" }}>الطرف الثاني (العامل)</h4>
                      <div style={{ display: "flex", marginBottom: "15px", fontSize: "15px" }}>
                        <span style={{ fontWeight: "bold", width: "100px" }}>الاسم:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", fontWeight: "bold" }}>{selectedEmployee.name}</div>
                      </div>
                      <div style={{ display: "flex", marginBottom: "15px", fontSize: "15px" }}>
                        <span style={{ fontWeight: "bold", width: "100px" }}>الرقم القومي:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", letterSpacing: "2px" }}>{selectedEmployee.nationalId || ""}</div>
                      </div>
                      <div style={{ display: "flex", marginBottom: "20px", fontSize: "15px", alignItems: "flex-end" }}>
                        <span style={{ fontWeight: "bold", width: "100px" }}>التوقيع:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", height: "30px" }}></div>
                      </div>
                      <div style={{ textAlign: "center", marginTop: "30px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "13px", color: "#555" }}>بصمة الإبهام (اليسرى)</span>
                        <div style={{ height: "90px", width: "70px", border: "2px solid #000", margin: "10px auto 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: "12px", borderRadius: "8px" }}>
                          البصمة
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Declaration */}
                  <div style={{ padding: "15px", border: "1px solid #000", borderRadius: "8px", backgroundColor: "#f9f9f9", marginBottom: "15px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "bold", color: "#000" }}>إقرار استلام وموافقة</h4>
                    <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.8", textAlign: "justify" }}>
                      أقر أنا الموقع أعلاه (الطرف الثاني) بأنني قد اطلعت على كافة بنود هذا العقد وفهمتها فهماً نافياً للجهالة، وبأنني تسلمت نسخة أصلية من هذا العقد موقعة ومختومة من الطرف الأول للعمل بموجبها والاحتفاظ بها، وأتعهد بالالتزام التام بكل ما ورد فيها من أحكام وشروط ولوائح الشركة الداخلية.
                    </p>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "15px", alignItems: "flex-end" }}>
                      <span style={{ fontWeight: "bold", fontSize: "14px", marginLeft: "15px" }}>توقيع الاستلام:</span>
                      <div style={{ width: "200px", borderBottom: "2px dotted #000" }}></div>
                    </div>
                  </div>

                  {/* HR Only Box */}
                  <div style={{ border: "2px dashed #777", padding: "12px", borderRadius: "8px", backgroundColor: "#fff", marginTop: "5px" }}>
                    <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "bold", color: "#555" }}>خاص بإدارة الموارد البشرية (HR Use Only)</h4>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <div style={{ display: "flex", flex: 1, alignItems: "flex-end" }}>
                        <span style={{ fontWeight: "bold", marginLeft: "10px" }}>تمت المراجعة بواسطة:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", marginRight: "10px" }}></div>
                      </div>
                      <div style={{ display: "flex", flex: 1, alignItems: "flex-end", margin: "0 20px" }}>
                        <span style={{ fontWeight: "bold", marginLeft: "10px" }}>تاريخ الإدراج في النظام:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", marginRight: "10px" }}></div>
                      </div>
                      <div style={{ display: "flex", flex: 1, alignItems: "flex-end" }}>
                        <span style={{ fontWeight: "bold", marginLeft: "10px" }}>رقم ملف العامل:</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted #000", marginRight: "10px" }}></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", marginTop: "15px", fontSize: "14px", fontWeight: "bold", color: "#666" }}>
                    --- نهاية وثيقة العقد ---
                  </div>
                </div>
              </div>

              {/* National ID Attachment */}
              {selectedEmployee.nationalIdPhotoUrl && (
                <div style={{ pageBreakBefore: "always", paddingTop: "20px", textAlign: "center" }}>
                  <h3 style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "15px", borderBottom: "2px solid #000", paddingBottom: "5px", display: "inline-block" }}>
                    مرفق: صورة بطاقة الرقم القومي
                  </h3>
                  <div style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "5px", display: "inline-block", backgroundColor: "#fff", width: "100%" }}>
                    <img
                      src={selectedEmployee.nationalIdPhotoUrl}
                      alt="National ID"
                      style={{ maxWidth: "100%", maxHeight: "600px", objectFit: "contain", display: "block", margin: "0 auto" }}
                    />
                  </div>
                </div>
              )}

            </div>
          );
        })()}
      </div>
    </>
  );
}
