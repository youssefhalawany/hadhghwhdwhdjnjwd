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
  BadgeAlert,
  Gift,
  Cake,
  ArrowRightLeft,
  TrendingUp,
  MessageCircle,
  MapPin,
  Share2,
  ChevronRight,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged } from "firebase/auth";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface CareerEvent {
  id: string;
  date: string;
  type: "transfer" | "promotion" | "salary_change" | "hire";
  title: string;
  fromBranch?: string;
  toBranch?: string;
  fromPosition?: string;
  toPosition?: string;
  fromSalary?: number;
  toSalary?: number;
  notes?: string;
  createdBy?: string;
}

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
  socialInsuranceNumber?: string;
  governorateOfBirth?: string;
  careerHistory?: CareerEvent[];
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

const POSITIONS = ["Barista", "Cashier", "Manager", "Assistant Manager", "Supervisor"];

const POSITION_AR_MAP: Record<string, string> = {
  "Barista": "باريستا (Barista)",
  "Cashier": "كاشير (Cashier)",
  "Manager": "مدير فرع (Manager)",
  "Assistant Manager": "مساعد مدير (Assistant Manager)",
  "Supervisor": "مشرف وردية (Supervisor)"
};

const MILITARY_STATUS_OPTIONS = [
  "أدى الخدمة العسكرية (قدوة حسنة)",
  "إعفاء نهائي من التجنيد",
  "إعفاء مؤقت من التجنيد",
  "لم يصبه الدور (معفى نهائياً)",
  "مؤجل تجنيده دراسياً",
  "غير مطلوب للتجنيد (إناث)"
];

const MILITARY_STATUS_EN_MAP: Record<string, string> = {
  "أدى الخدمة العسكرية (قدوة حسنة)": "Completed Military Service",
  "إعفاء نهائي من التجنيد": "Final Exemption",
  "إعفاء مؤقت من التجنيد": "Temporary Exemption",
  "لم يصبه الدور (معفى نهائياً)": "Turn Not Called (Exempt)",
  "مؤجل تجنيده دراسياً": "Postponed for Studies",
  "غير مطلوب للتجنيد (إناث)": "Not Required (Female)"
};

export const EGYPT_GOVERNORATES: Record<string, { ar: string; en: string }> = {
  "01": { ar: "القاهرة", en: "Cairo" },
  "02": { ar: "الإسكندرية", en: "Alexandria" },
  "03": { ar: "بورسعيد", en: "Port Said" },
  "04": { ar: "السويس", en: "Suez" },
  "11": { ar: "دمياط", en: "Damietta" },
  "12": { ar: "الدقهلية", en: "Dakahlia" },
  "13": { ar: "الشرقية", en: "Sharkia" },
  "14": { ar: "القليوبية", en: "Qalyubia" },
  "15": { ar: "كفر الشيخ", en: "Kafr El-Sheikh" },
  "16": { ar: "الغربية", en: "Gharbia" },
  "17": { ar: "المنوفية", en: "Menoufia" },
  "18": { ar: "البحيرة", en: "Beheira" },
  "19": { ar: "الإسماعيلية", en: "Ismailia" },
  "21": { ar: "الجيزة", en: "Giza" },
  "22": { ar: "بني سويف", en: "Beni Suef" },
  "23": { ar: "الفيوم", en: "Faiyum" },
  "24": { ar: "المنيا", en: "Minya" },
  "25": { ar: "أسيوط", en: "Asyut" },
  "26": { ar: "سوهاج", en: "Sohag" },
  "27": { ar: "قنا", en: "Qena" },
  "28": { ar: "أسوان", en: "Aswan" },
  "29": { ar: "الأقصر", en: "Luxor" },
  "31": { ar: "البحر الأحمر", en: "Red Sea" },
  "32": { ar: "الوادي الجديد", en: "New Valley" },
  "33": { ar: "مطروح", en: "Matrouh" },
  "34": { ar: "شمال سيناء", en: "North Sinai" },
  "35": { ar: "جنوب سيناء", en: "South Sinai" },
  "88": { ar: "مواليد الخارج (قنصليات)", en: "Born Abroad" }
};

export interface DecodedNationalId {
  isValid: boolean;
  cleanNid: string;
  birthDate?: string;
  age?: number;
  gender?: "Male" | "Female";
  genderAr?: string;
  governorateCode?: string;
  governorateAr?: string;
  governorateEn?: string;
  laborStatus: "prohibited" | "minor" | "legal" | "unknown";
  laborStatusAr: string;
  laborStatusEn?: string;
  laborBadge: string;
  militaryStatus: "exempt_female" | "draft_eligible" | "draft_exempt_age" | "under_draft_age" | "unknown";
  militaryStatusAr: string;
  militaryStatusEn?: string;
  militaryBadge: string;
  retirementYear?: number;
  retirementAge?: number;
  retirementDateStr?: string;
  yearsToRetirement?: number;
  checksumValid: boolean;
  errorMessage?: string;
}

export const decodeEgyptianNationalId = (rawNid?: string): DecodedNationalId => {
  const cleanNid = (rawNid || "").trim();
  const result: DecodedNationalId = {
    isValid: false,
    cleanNid,
    laborStatus: "unknown",
    laborStatusAr: "غير محدد",
    laborStatusEn: "Unknown",
    laborBadge: "bg-slate-100 text-slate-600",
    militaryStatus: "unknown",
    militaryStatusAr: "غير محدد",
    militaryStatusEn: "Unknown",
    militaryBadge: "bg-slate-100 text-slate-600",
    checksumValid: false
  };

  if (cleanNid.length !== 14 || !/^\d{14}$/.test(cleanNid)) {
    result.errorMessage = cleanNid.length > 0 && cleanNid.length < 14
      ? `الرقم القومي غير مكتمل (متبقي ${14 - cleanNid.length} أرقام)`
      : "الرقم القومي يجب أن يتكون من 14 رقماً";
    return result;
  }

  // 1. Century & Date of Birth
  const centuryDigit = cleanNid[0];
  if (centuryDigit !== '2' && centuryDigit !== '3') {
    result.errorMessage = "خانة القرن الأولى غير صحيحة (يجب أن تبدأ بـ 2 أو 3)";
    return result;
  }
  const century = centuryDigit === '2' ? '19' : '20';
  const yy = cleanNid.slice(1, 3);
  const mm = cleanNid.slice(3, 5);
  const dd = cleanNid.slice(5, 7);

  const monthNum = parseInt(mm, 10);
  const dayNum = parseInt(dd, 10);
  const yearNum = parseInt(`${century}${yy}`, 10);

  if (monthNum < 1 || monthNum > 12) {
    result.errorMessage = `شهر الميلاد غير صالح في الرقم القومي (${mm})`;
    return result;
  }

  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  if (dayNum < 1 || dayNum > daysInMonth) {
    result.errorMessage = `يوم الميلاد غير صالح في الرقم القومي (${dd}) لهذا الشهر`;
    return result;
  }

  const dobStr = `${yearNum}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  result.birthDate = dobStr;

  // Calculate exact age
  const today = new Date();
  let age = today.getFullYear() - yearNum;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  if (currentMonth < monthNum || (currentMonth === monthNum && currentDay < dayNum)) {
    age--;
  }
  result.age = Math.max(0, age);

  // 2. Gender (13th digit)
  const genderDigit = parseInt(cleanNid[12], 10);
  const isMale = genderDigit % 2 !== 0;
  result.gender = isMale ? "Male" : "Female";
  result.genderAr = isMale ? "ذكر" : "أنثى";

  // 3. Governorate of Birth (Digits 8 & 9)
  const govCode = cleanNid.slice(7, 9);
  result.governorateCode = govCode;
  if (EGYPT_GOVERNORATES[govCode]) {
    result.governorateAr = EGYPT_GOVERNORATES[govCode].ar;
    result.governorateEn = EGYPT_GOVERNORATES[govCode].en;
  } else {
    result.governorateAr = "محافظة غير مسجلة";
    result.governorateEn = "Unknown";
  }

  // 4. Labor Law Age Classification (Egyptian Labor Law 12 of 2003)
  if (age < 15) {
    result.laborStatus = "prohibited";
    result.laborStatusAr = "⛔ حظر تشغيل أطفال: أقل من 15 سنة (مخالفة جسيمة للمادة 99 من قانون العمل)";
    result.laborStatusEn = "⛔ Child Labor Prohibited: Under 15 (Violation of Labor Law Art. 99)";
    result.laborBadge = "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  } else if (age < 18) {
    result.laborStatus = "minor";
    result.laborStatusAr = "⚠️ قاصر متدرج (15-18 سنة): يشترط موافقة ولي الأمر ومحظور تشغيله نوبات ليلية أو ساعات إضافية (المواد 98-103)";
    result.laborStatusEn = "⚠️ Minor Apprentice (15-18): Guardian consent required, night shifts prohibited (Arts. 98-103)";
    result.laborBadge = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  } else {
    result.laborStatus = "legal";
    result.laborStatusAr = "🟢 سن العمل القانوني مكتمل (أهلية تعاقد كاملة 18+ سنة)";
    result.laborStatusEn = "🟢 Statutory Working Age (Full Legal Capacity 18+)";
    result.laborBadge = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }

  // 5. Military Service Eligibility (Egyptian Military Law 127 of 1980)
  if (!isMale) {
    result.militaryStatus = "exempt_female";
    result.militaryStatusAr = "معفاة نهائياً (إناث - غير خاضعة لقانون الخدمة العسكرية والوطنية رقم 127 لسنة 1980)";
    result.militaryStatusEn = "Permanently Exempt (Female - Law 127/1980)";
    result.militaryBadge = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  } else if (age < 18) {
    result.militaryStatus = "under_draft_age";
    result.militaryStatusAr = "لم يبلغ سن التكليف العسكري بعد (أقل من 18 سنة)";
    result.militaryStatusEn = "Under Conscription Age (< 18 yrs)";
    result.militaryBadge = "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
  } else if (age <= 30) {
    result.militaryStatus = "draft_eligible";
    result.militaryStatusAr = "⚠️ في سن التكليف العسكري (مطلوب شهادة تأدية الخدمة أو الإعفاء النهائي/المؤقت)";
    result.militaryStatusEn = "⚠️ Conscription Eligible (Service / Exemption certificate required)";
    result.militaryBadge = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  } else {
    result.militaryStatus = "draft_exempt_age";
    result.militaryStatusAr = "✅ تجاوز سن الامتناع العسكري القانوني (30 سنة - مادة 49 قانون 127 لسنة 1980)";
    result.militaryStatusEn = "✅ Past Statutory Conscription Age (30+ yrs - Law 127/1980 Art. 49)";
    result.militaryBadge = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }

  // 6. Statutory Retirement (Egyptian Social Insurance Law 148 of 2019)
  let retAge = 60;
  let retYear = yearNum + 60;
  if (retYear >= 2040) {
    retAge = 65;
    retYear = yearNum + 65;
  } else if (retYear >= 2038) {
    retAge = 64;
    retYear = yearNum + 64;
  } else if (retYear >= 2036) {
    retAge = 63;
    retYear = yearNum + 63;
  } else if (retYear >= 2034) {
    retAge = 62;
    retYear = yearNum + 62;
  } else if (retYear >= 2032) {
    retAge = 61;
    retYear = yearNum + 61;
  }

  result.retirementAge = retAge;
  result.retirementYear = retYear;
  result.retirementDateStr = `${retYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  result.yearsToRetirement = Math.max(0, retYear - today.getFullYear());

  // 7. Checksum validation (Egyptian civil registry modulo-11)
  const weights = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanNid[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const expectedCheckDigit = (11 - remainder) % 11;
  const actualCheckDigit = parseInt(cleanNid[13], 10);
  result.checksumValid = expectedCheckDigit === actualCheckDigit || (expectedCheckDigit === 10 && (actualCheckDigit === 0 || actualCheckDigit === 1));

  result.isValid = true;
  return result;
};

export default function EmployeesPage() {
  const { currentBranch } = useBranch();
  const { language: lang } = useLanguage();
  const isAr = lang === "ar";
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
  const [printDocumentType, setPrintDocumentType] = useState<"contract" | "termination" | "folder_cover" | "salary_letter" | "experience_cert" | "bank_mandate" | "social_insurance_1" | "social_insurance_6" | "loan_contract" | "loan_receipt">("contract");
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
  const [loanAmount, setLoanAmount] = useState<number>(1000);
  const [loanInstallmentMonths, setLoanInstallmentMonths] = useState<number>(1);
  const [loanCategory, setLoanCategory] = useState<"medical" | "education" | "family" | "seasonal" | "living" | "other">("living");
  const [loanNotes, setLoanNotes] = useState<string>("");
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  // Early Cash Payoff state
  const [showEarlyPayoffModal, setShowEarlyPayoffModal] = useState(false);
  const [activeLoanForPayoff, setActiveLoanForPayoff] = useState<any | null>(null);
  const [payoffAmount, setPayoffAmount] = useState<number>(0);
  const [payoffNotes, setPayoffNotes] = useState<string>("");
  const [isSubmittingPayoff, setIsSubmittingPayoff] = useState(false);

  // Selected loan for print & filter
  const [selectedLoanForPrint, setSelectedLoanForPrint] = useState<any | null>(null);
  const [loanFilter, setLoanFilter] = useState<"all" | "active" | "settled">("all");
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Career Transfers & Promotions state
  const [showCareerModal, setShowCareerModal] = useState(false);
  const [careerMode, setCareerMode] = useState<"transfer" | "promotion">("transfer");
  const [careerTargetBranch, setCareerTargetBranch] = useState<string>("ola");
  const [careerTargetPosition, setCareerTargetPosition] = useState<string>("Cashier");
  const [careerTargetSalary, setCareerTargetSalary] = useState<number>(0);
  const [careerEffectiveDate, setCareerEffectiveDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [careerNotes, setCareerNotes] = useState<string>("");
  const [isSubmittingCareer, setIsSubmittingCareer] = useState(false);

  // Milestone Celebration Bonus state
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAmount, setBonusAmount] = useState<number>(500);
  const [bonusReason, setBonusReason] = useState<string>("مكافأة تميز وسنوية عمل");
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);

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
      toast.error(isAr ? "فشل تحميل بيانات الموظفين" : "Failed to load employees");
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
    const decoded = decodeEgyptianNationalId(cleanNid);

    if (decoded.isValid) {
      if (decoded.birthDate) {
        update.birthDate = decoded.birthDate;
      }
      if (typeof decoded.age === 'number') {
        update.age = decoded.age;
      }
      if (decoded.gender) {
        update.gender = decoded.gender;
      }
      if (decoded.governorateAr) {
        update.governorateOfBirth = decoded.governorateAr;
        if (!formData.address) {
          update.address = `محافظة ${decoded.governorateAr}`;
        }
      }
      // Military status intelligent default suggestion
      if (decoded.gender === "Female") {
        update.militaryStatus = "غير مطلوب للتجنيد (إناث)";
      } else if (decoded.militaryStatus === "draft_exempt_age" && (!formData.militaryStatus || formData.militaryStatus === "غير مطلوب للتجنيد (إناث)")) {
        update.militaryStatus = "إعفاء نهائي من التجنيد";
      } else if (decoded.militaryStatus === "draft_eligible" && formData.militaryStatus === "غير مطلوب للتجنيد (إناث)") {
        update.militaryStatus = "أدى الخدمة العسكرية (قدوة حسنة)";
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
      toast.error(
        isAr
          ? "المديرون غير مخولين بتعديل بيانات الموظفين. فقط الإدارة تمتلك صلاحية التعديل."
          : "Managers cannot edit employee details. Only administrators have edit access."
      );
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
      toast.error(isAr ? "الاسم الكامل مطلوب" : "Name is required");
      return;
    }
    if (selectedEmployee && isManager) {
      toast.error(
        isAr
          ? "المديرون غير مخولين بتعديل بيانات الموظفين. يمكنك فقط إضافة موظفين جدد."
          : "Managers are not authorized to edit employees. You can only add new employees."
      );
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
        toast.success(isAr ? "تم تحديث بيانات الموظف بنجاح!" : "Employee updated!");
      } else {
        await addDoc(collection(db, "employees"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.email || "unknown"
        });
        toast.success(isAr ? "تم إضافة الموظف الجديد بنجاح!" : "Employee added!");
      }

      setShowAddModal(false);
      loadData(); // refresh data
    } catch (err) {
      console.error(err);
      toast.error(isAr ? "فشل حفظ بيانات الموظف" : "Failed to save employee");
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
      toast.success(isAr ? "تم إرفاق صورة البطاقة بنجاح! ⚡" : "National ID photo attached! ⚡");
    } catch (error) {
      console.error("Fast upload error:", error);
      try {
        const { dataUrl } = await compressImage(file, 800, 0.6);
        setFormData(prev => ({ ...prev, nationalIdPhotoUrl: dataUrl }));
        toast.success(isAr ? "تم حفظ صورة البطاقة محلياً!" : "National ID photo saved locally!");
      } catch (innerErr) {
        toast.error(isAr ? "فشل معالجة صورة البطاقة" : "Failed to process ID photo");
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
      toast.success(isAr ? "تم إرفاق صورة الموظف بنجاح! ⚡" : "Employee photo attached! ⚡");
    } catch (error) {
      console.error("Photo upload error:", error);
      try {
        const { dataUrl } = await compressImage(file, 500, 0.65);
        setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        toast.success(isAr ? "تم حفظ صورة الموظف محلياً!" : "Employee photo saved locally!");
      } catch (innerErr) {
        toast.error(isAr ? "فشل معالجة صورة الموظف" : "Failed to process employee photo");
      }
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بحذف الموظفين." : "Managers are not authorized to delete employees.");
      return;
    }
    if (!window.confirm(isAr ? "هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this employee? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      toast.success(isAr ? "تم حذف الموظف بنجاح" : "Employee deleted");
      loadData(); // refresh data
    } catch (err) {
      toast.error(isAr ? "فشل حذف الموظف" : "Failed to delete");
    }
  };

  const handleQuickStatusChange = async (employeeId: string, newStatus: "active" | "suspended" | "left") => {
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بتغيير حالة الموظف." : "Managers are not authorized to change employee status.");
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
          ? (isAr ? "تم تعيين الموظف: على رأس العمل (نشط)" : "Employee marked as Active")
          : newStatus === "suspended"
            ? (isAr ? "تم تعيين الموظف: موقوف مؤقتاً عن العمل" : "Employee marked as Suspended")
            : (isAr ? "تم تعيين الموظف: ترك العمل / منتهي الخدمة" : "Employee marked as Left")
      );
    } catch (err) {
      console.error("Failed to update employee status:", err);
      toast.error(isAr ? "فشل تحديث حالة الموظف" : "Failed to update status");
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
        storeAddress: "شارع التسعين الشمالي، كمبوند القرنفل، التجمع الخامس، القاهرة الجديدة",
        taxId: "756-563-844",
        commReg: "216727",
        companyInsuranceNumber: "7565638",
        socialInsuranceOffice: "مكتب تأمينات القاهرة الجديدة (التجمع الخامس)"
      };
    } else {
      return {
        companyTitleAr: "الشركة المصرية للتجارة والتوكيلات (ش.م.م)",
        companySubtitleEn: "El Masreya for Trade - Circle K Franchise",
        companyPartyName: "الشركة المصرية للتجارة (فرع العلمين 4 - سيركل كي)",
        branchTitleAr: "فرع العلمين 4 - مارينا الساحل الشمالي",
        branchCityAr: "الساحل الشمالي",
        storeAddress: "طريق الإسكندرية - مطروح الساحلي، أمام بوابة مارينا 4، العلمين",
        taxId: "123-456-789",
        commReg: "123456",
        companyInsuranceNumber: "1234567",
        socialInsuranceOffice: "مكتب تأمينات مطروح والساحل الشمالي"
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

  const handlePrintSocialInsurance1 = (emp?: Employee) => {
    const target = emp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("social_insurance_1");
    setSelectedEmployee(target);
    setShowLettersMenu(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintSocialInsurance6 = (emp?: Employee) => {
    const target = emp || selectedEmployee;
    if (!target) return;
    setPrintDocumentType("social_insurance_6");
    setSelectedEmployee(target);
    setShowLettersMenu(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const loanCategoryLabels: Record<string, { label: string; labelEn: string; icon: string }> = {
    medical: { label: "حالات طبية وعلاجية طارئة", labelEn: "Medical Emergency", icon: "🏥" },
    education: { label: "مصاريف مدرسية وجامعية", labelEn: "Education & Tuition", icon: "🎓" },
    family: { label: "مناسبات عائلية وزواج", labelEn: "Family & Marriage", icon: "💍" },
    seasonal: { label: "سلفة أعياد ومواسم", labelEn: "Seasons & Holidays", icon: "🌙" },
    living: { label: "التزامات معيشية وسكنية", labelEn: "Living & Housing Costs", icon: "🏠" },
    other: { label: "أسباب وظروف أخرى", labelEn: "General / Other", icon: "📝" }
  };

  const handlePrintLoanContract = (loan: any, emp?: Employee) => {
    const target = emp || employees.find(e => e.id === activeEmployeeId) || selectedEmployee;
    if (!target) return;
    setSelectedLoanForPrint(loan);
    setPrintDocumentType("loan_contract");
    setSelectedEmployee(target);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handlePrintLoanReceipt = (loan: any, emp?: Employee) => {
    const target = emp || employees.find(e => e.id === activeEmployeeId) || selectedEmployee;
    if (!target) return;
    setSelectedLoanForPrint(loan);
    setPrintDocumentType("loan_receipt");
    setSelectedEmployee(target);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const sendWhatsAppLoanStatement = (loan: any, emp?: Employee) => {
    const target = emp || employees.find(e => e.id === activeEmployeeId) || selectedEmployee;
    if (!target) return;
    const originalAmt = Number(loan.amount || loan.approved || 0);
    const settled = Number(loan.settledAmount !== undefined ? loan.settledAmount : (loan.settled ? originalAmt : 0));
    const remaining = Number(loan.remainingBalance !== undefined ? loan.remainingBalance : Math.max(0, originalAmt - settled));
    const monthly = Number(loan.monthlyInstallment || originalAmt);
    const empPhone = target.phone || "";
    const cleanPhone = empPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? "2" + cleanPhone : cleanPhone;

    const branchName = target.storeId === 'ola' ? 'فرع أولا القرنفل' : 'فرع العلمين 4';
    const reasonText = loan.categoryLabel || loan.reason || "سلفة راتب";

    const msg = `📋 *إشعار سلفة معتمدة - شركة ايه ان اتش للتجارة*
الموظف: *${target.name}*
الرقم القومي: ${target.nationalId || "-"}
مكان العمل: ${branchName}
━━━━━━━━━━━━━━━━━━━━
💰 *بيانات السلفة وجدول الاستقطاع:*
• إجمالي مبلغ السلفة: *${originalAmt.toLocaleString()} ج.م* (فقط ${numberToArabicWords(originalAmt)} لا غير)
• نظام التقسيط: *${loan.installmentCount || 1} شهر/أشهر* (${monthly.toLocaleString()} ج.م / شهر)
• تاريخ صرف السلفة: *${loan.date || "-"}*
• بيان السلفة: *${reasonText}*
━━━━━━━━━━━━━━━━━━━━
📊 *الموقف المالي الفعلي:*
• المسدد حتى تاريخه: *${settled.toLocaleString()} ج.م* ✅
• الرصيد المتبقي ذمتكم: *${remaining.toLocaleString()} ج.م* ⏳
• الحالة: *${remaining <= 0 ? "مسددة بالكامل (خالصة)" : "سارية وقيد الاستقطاع"}*
━━━━━━━━━━━━━━━━━━━━
_وفقاً لأحكام المادة (34) من قانون العمل رقم 12 لسنة 2003_
*شركة إيه إن اتش للتجارة - إدارة الموارد البشرية*`;

    window.open(`https://wa.me/${formattedPhone ? formattedPhone : ""}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const getHealthCertStatus = (expiryDate?: string) => {
    if (!expiryDate) {
      return {
        status: "missing",
        labelAr: "غير مسجلة (مطلوبة لسلامة الغذاء)",
        labelEn: "Not registered (Required for food safety)",
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
        labelEn: `Expired ${Math.abs(diffDays)}d ago (Food safety violation)`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 30) {
      return {
        status: "expiring_soon",
        labelAr: `توشك على الانتهاء خلال ${diffDays} يوم`,
        labelEn: `Expiring in ${diffDays} days`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `سارية (متبقي ${diffDays} يوم)`,
      labelEn: `Valid (${diffDays} days remaining)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getNationalIdExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) {
      return {
        status: "missing",
        labelAr: "سارية (يرجى تسجيل تاريخ التجديد)",
        labelEn: "Valid (Please record renewal date)",
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
        labelEn: `Expired ${Math.abs(diffDays)}d ago`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 60) {
      return {
        status: "expiring_soon",
        labelAr: `تجديد مطلوب خلال ${diffDays} يوم`,
        labelEn: `Renewal due in ${diffDays} days`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `سارية (متبقي ${diffDays} يوم)`,
      labelEn: `Valid (${diffDays} days remaining)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getCriminalRecordStatus = (recordDate?: string) => {
    if (!recordDate) {
      return {
        status: "missing",
        labelAr: "غير مسجل (مطلوب لملف التعيين)",
        labelEn: "Not registered (Required for hiring file)",
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
        labelEn: `Expired (Exceeded 3 months)`,
        days: diffDays,
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
      };
    }
    if (diffDays <= 15) {
      return {
        status: "expiring_soon",
        labelAr: `ينتهي خلال ${diffDays} يوم`,
        labelEn: `Expires in ${diffDays} days`,
        days: diffDays,
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      };
    }
    return {
      status: "valid",
      labelAr: `ساري ومستوفى (${diffDays} يوم)`,
      labelEn: `Valid & Fulfilled (${diffDays} days remaining)`,
      days: diffDays,
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    };
  };

  const getProbationStatus = (startDateStr?: string) => {
    if (!startDateStr) {
      return { stage: "unknown", daysElapsed: 0, daysTotal: 90, daysRemaining: 90, labelAr: "غير محدد تاريخ الاستلام", labelEn: "Hire date not specified", percent: 0, badge: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10" };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime())) {
      return { stage: "unknown", daysElapsed: 0, daysTotal: 90, daysRemaining: 90, labelAr: "تاريخ غير صالح", labelEn: "Invalid date", percent: 0, badge: "bg-slate-100 text-slate-600" };
    }
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    if (daysElapsed < 75) {
      return {
        stage: "probation",
        daysElapsed,
        daysTotal: 90,
        daysRemaining: 90 - daysElapsed,
        labelAr: `قيد فترة الاختبار (اليوم ${daysElapsed} من 90)`,
        labelEn: `Under probation (Day ${daysElapsed} of 90)`,
        percent: Math.min(100, Math.round((daysElapsed / 90) * 100)),
        badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
        alertText: `الموظف في فترة الاختبار القانونية (المادة 32 - قانون العمل رقم 12 لسنة 2003). متبقي ${90 - daysElapsed} يوم على التثبيت.`,
        alertTextEn: `Employee is in statutory probation period (Labor Law 12/2003, Art. 32). ${90 - daysElapsed} days remaining until confirmation.`
      };
    }
    if (daysElapsed <= 90) {
      return {
        stage: "evaluation_due",
        daysElapsed,
        daysTotal: 90,
        daysRemaining: 90 - daysElapsed,
        labelAr: `مطلوب تقييم نهائي قبل التثبيت (متبقي ${90 - daysElapsed} يوم)`,
        labelEn: `Final evaluation required (${90 - daysElapsed} days remaining)`,
        percent: Math.min(100, Math.round((daysElapsed / 90) * 100)),
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
        alertText: `⚠️ أوشكت فترة الاختبار (90 يوماً) على الانتهاء خلال ${90 - daysElapsed} يوم. يلزم اتخاذ قرار التثبيت أو إنهاء التعاقد دون تعويض قبل انقضاء اليوم 90.`,
        alertTextEn: `⚠️ Statutory probation (90 days) ending in ${90 - daysElapsed} days. Decision on confirmation or separation must be taken before day 90.`
      };
    }
    return {
      stage: "confirmed",
      daysElapsed,
      daysTotal: 90,
      daysRemaining: 0,
      labelAr: `مثبت بالخدمة رسمياً (تجاوز فترة الاختبار - ${daysElapsed} يوم عمل)`,
      labelEn: `Officially confirmed (Probation passed - ${daysElapsed} work days)`,
      percent: 100,
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      alertText: `تم تثبيت الموظف واكتسب كامل الحماية القانونية وفقاً للمادة 32 من قانون العمل رقم 12 لسنة 2003.`,
      alertTextEn: `Employee is officially confirmed with full statutory protection under Labor Law 12/2003, Art. 32.`
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
          : `تجديد العقد: ${renewalDate.toISOString().split("T")[0]} (${diffDays} يوم متبقي)`,
      labelEn: diffDays < 0
        ? `Contract expired ${Math.abs(diffDays)}d ago (Annual renewal required)`
        : diffDays <= 30
          ? `Contract renewal due in ${diffDays} days`
          : `Renewal: ${renewalDate.toISOString().split("T")[0]} (${diffDays}d remaining)`
    };
  };

  const getMilestoneCelebrationStatus = (emp?: Employee | null) => {
    if (!emp) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Birthday Milestone
    let birthDateObj: Date | null = null;
    if (emp.birthDate) {
      birthDateObj = new Date(emp.birthDate);
    } else if (emp.nationalId && emp.nationalId.length === 14 && /^\d+$/.test(emp.nationalId)) {
      const nid = emp.nationalId;
      const century = nid[0] === '2' ? '19' : nid[0] === '3' ? '20' : '';
      if (century) {
        const dobStr = `${century}${nid.slice(1, 3)}-${nid.slice(3, 5)}-${nid.slice(5, 7)}`;
        const parsed = new Date(dobStr);
        if (!isNaN(parsed.getTime())) birthDateObj = parsed;
      }
    }

    let birthdayInfo = null;
    if (birthDateObj && !isNaN(birthDateObj.getTime())) {
      const thisYearBirthday = new Date(today.getFullYear(), birthDateObj.getMonth(), birthDateObj.getDate());
      thisYearBirthday.setHours(0, 0, 0, 0);
      let nextBirthday = thisYearBirthday;
      if (thisYearBirthday.getTime() < today.getTime()) {
        nextBirthday = new Date(today.getFullYear() + 1, birthDateObj.getMonth(), birthDateObj.getDate());
        nextBirthday.setHours(0, 0, 0, 0);
      }
      const daysToBirthday = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const turningAge = today.getFullYear() - birthDateObj.getFullYear() + (thisYearBirthday.getTime() < today.getTime() ? 1 : 0);

      birthdayInfo = {
        dateStr: birthDateObj.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' }),
        turningAge,
        daysToBirthday,
        isToday: daysToBirthday === 0,
        isUpcoming: daysToBirthday > 0 && daysToBirthday <= 7
      };
    }

    // 2. Work Anniversary Milestone
    let anniversaryInfo = null;
    if (emp.startDate) {
      const startObj = new Date(emp.startDate);
      if (!isNaN(startObj.getTime())) {
        startObj.setHours(0, 0, 0, 0);
        const yearsCompleted = today.getFullYear() - startObj.getFullYear();
        const thisYearAnniversary = new Date(today.getFullYear(), startObj.getMonth(), startObj.getDate());
        thisYearAnniversary.setHours(0, 0, 0, 0);
        let nextAnniversary = thisYearAnniversary;
        if (thisYearAnniversary.getTime() < today.getTime()) {
          nextAnniversary = new Date(today.getFullYear() + 1, startObj.getMonth(), startObj.getDate());
          nextAnniversary.setHours(0, 0, 0, 0);
        }
        const daysToAnniversary = Math.ceil((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const milestoneYears = yearsCompleted + (thisYearAnniversary.getTime() < today.getTime() ? 1 : 0);

        if (startObj.getTime() <= today.getTime()) {
          anniversaryInfo = {
            startDateStr: startObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            milestoneYears,
            daysToAnniversary,
            isToday: daysToAnniversary === 0 && milestoneYears > 0,
            isUpcoming: daysToAnniversary > 0 && daysToAnniversary <= 7 && milestoneYears > 0
          };
        }
      }
    }

    return { birthdayInfo, anniversaryInfo };
  };

  const handleSendWhatsAppGreeting = (emp: Employee, type: "birthday" | "anniversary", customMsg?: string) => {
    const rawPhone = (emp.phone || "").replace(/\D/g, "");
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith("01")) {
      cleanPhone = "2" + cleanPhone; // Egypt country code +20
    }
    const branchInfo = getBranchInfo(emp, currentBranch);
    const company = branchInfo.companyTitleAr || "ايه ان اتش للتجارة";

    let text = "";
    if (type === "birthday") {
      text = `كل عام وأنت بألف خير يا ${emp.name} بمناسبة عيد ميلادك السعيد! 🎂✨\nتتمنى لك إدارة شركة ${company} عاماً مليئاً بالصحة والنجاح والتوفيق الدائم معنا. 🎉💐`;
    } else {
      text = `ألف مبروك يا ${emp.name} بمناسبة ذكرى التحاقك بالعمل في ${company}! 🏅👏\nنشكرك على إخلاصك وتفانيك المستمر في أداء واجباتك ونتمنى لك دوام التقدم والازدهار في مسيرتك المهنية معنا. 🌟`;
    }

    if (customMsg) text = customMsg;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
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
    let totalRemaining = 0;
    let activeLoansCount = 0;
    let nextMonthInstallmentDue = 0;

    const now = new Date();
    const nextMonthOffset = now.getDate() > 20 ? 1 : 0;
    const nm = new Date(now.getFullYear(), now.getMonth() + nextMonthOffset, 1);
    const nextMonthStr = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}`;

    empLoans.forEach(l => {
      const amt = Number(l.amount || l.approved || l.requested || 0);
      totalBorrowed += amt;
      const isSettled = l.settled === true || l.status === "settled";
      const settled = Number(l.settledAmount !== undefined ? l.settledAmount : (isSettled ? amt : 0));
      totalSettled += settled;

      const remaining = Number(l.remainingBalance !== undefined ? l.remainingBalance : Math.max(0, amt - settled));
      if (remaining > 0 && !isSettled) {
        totalRemaining += remaining;
        activeLoansCount++;

        if (Array.isArray(l.installments) && l.installments.length > 0) {
          const inst = l.installments.find((i: any) => i.status === "pending");
          if (inst) nextMonthInstallmentDue += Number(inst.amount) || 0;
        } else if (l.monthlyInstallment) {
          nextMonthInstallmentDue += Math.min(Number(l.monthlyInstallment), remaining);
        } else {
          nextMonthInstallmentDue += remaining;
        }
      }
    });

    const remainingBalance = totalRemaining;
    const progressPercent = totalBorrowed > 0 ? Math.min(100, Math.round((totalSettled / totalBorrowed) * 100)) : 100;

    return { totalBorrowed, totalSettled, remainingBalance, activeLoansCount, nextMonthInstallmentDue, progressPercent, nextMonthStr };
  }, [empLoans]);

  const handleCreateLoan = async (e?: React.FormEvent | Employee) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين باعتماد وصرف السلف." : "Managers are not authorized to issue loans.");
      return;
    }
    const targetEmp = (e && 'id' in e && e.id) ? e : employees.find(emp => emp.id === activeEmployeeId) || selectedEmployee;
    if (!targetEmp) return;

    const amt = Number(loanAmount);
    if (!amt || amt <= 0) {
      toast.error(isAr ? "يرجى إدخال مبلغ سلفة صحيح" : "Please enter a valid loan amount");
      return;
    }

    const months = Number(loanInstallmentMonths) || 1;
    const monthlyInst = Math.round(amt / months);
    const startD = new Date();
    const firstMonthOffset = startD.getDate() > 20 ? 1 : 0;
    const schedule: any[] = [];
    for (let i = 0; i < months; i++) {
      const mDate = new Date(startD.getFullYear(), startD.getMonth() + firstMonthOffset + i, 1);
      const mStr = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
      const isLast = i === months - 1;
      const instAmt = isLast 
        ? (amt - (monthlyInst * (months - 1)))
        : monthlyInst;
      schedule.push({
        month: mStr,
        installmentNumber: i + 1,
        amount: instAmt,
        status: "pending"
      });
    }

    setIsSubmittingLoan(true);
    try {
      const targetBranchId = targetEmp.storeId || currentBranch || "alamein4";
      const payload = {
        employeeId: targetEmp.id,
        employeeName: targetEmp.name,
        employeeNationalId: targetEmp.nationalId || "",
        employeePosition: targetEmp.position || "",
        amount: amt,
        requested: amt,
        approved: amt,
        installmentCount: months,
        monthlyInstallment: monthlyInst,
        remainingBalance: amt,
        settledAmount: 0,
        settled: false,
        status: "approved",
        category: loanCategory,
        categoryLabel: loanCategoryLabels[loanCategory]?.label || "سلفة نقدية",
        reason: (loanCategoryLabels[loanCategory]?.label || "سلفة نقدية") + (loanNotes ? ` - ${loanNotes}` : ""),
        notes: loanNotes || "سلفة راتب نقدية معتمدة",
        date: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7),
        firstInstallmentMonth: schedule[0]?.month || new Date().toISOString().slice(0, 7),
        storeId: targetBranchId,
        disbursedFrom: "خزينة الفرع (Safe)",
        installments: schedule,
        repayments: [],
        type: "loan",
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "admin"
      };

      const docRef = await addDoc(collection(db, "loans"), payload);
      toast.success(isAr ? "تم اعتماد وصرف السلفة وتخصيص الأقساط الشهرية بنجاح!" : "Loan issued and monthly installments scheduled successfully!");
      setShowLoanModal(false);
      setLoanNotes("");
      const newDoc = { id: docRef.id, ...payload };
      setEmpLoans(prev => [newDoc, ...prev]);

      // Pre-select for print
      setSelectedLoanForPrint(newDoc);
    } catch (err) {
      console.error("Failed to record loan:", err);
      toast.error(isAr ? "فشل تسجيل السلفة" : "Failed to record loan");
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const handleEarlyPayoff = async () => {
    if (!activeLoanForPayoff || !activeEmp) return;
    const payAmt = Number(payoffAmount);
    const maxPayable = Number(activeLoanForPayoff.remainingBalance !== undefined ? activeLoanForPayoff.remainingBalance : activeLoanForPayoff.amount);
    if (payAmt <= 0) {
      toast.error(isAr ? "يرجى إدخال مبلغ سداد صحيح" : "Please enter a valid payoff amount");
      return;
    }
    if (payAmt > maxPayable) {
      toast.error(isAr ? `المبلغ المطلوب سداده أكبر من الرصيد المتبقي (${maxPayable} ج.م)` : `Payment exceeds remaining balance (${maxPayable} EGP)`);
      return;
    }

    setIsSubmittingPayoff(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const targetBranchId = activeEmp.storeId || currentBranch || "alamein4";

      // 1. Record cash deposit back into safe (Direct Safe recovery)
      await addDoc(collection(db, "deposits"), {
        amount: payAmt,
        date: todayStr,
        from: `سداد سلفة نقدي - ${activeEmp.name}`,
        to: "safe",
        note: `سداد نقدي معجل لسلفة (${activeLoanForPayoff.id}) - ${payoffNotes || "توريد بالخزينة"}`,
        storeId: targetBranchId,
        ownerName: activeEmp.name,
        type: "loan_repayment",
        loanId: activeLoanForPayoff.id,
        employeeId: activeEmp.id,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "admin"
      });

      // 2. Compute updated balances
      const curRem = Number(activeLoanForPayoff.remainingBalance !== undefined ? activeLoanForPayoff.remainingBalance : (activeLoanForPayoff.approved || activeLoanForPayoff.amount || 0));
      const curSettled = Number(activeLoanForPayoff.settledAmount || 0);
      const nextRem = Math.max(0, curRem - payAmt);
      const nextSettled = curSettled + payAmt;
      const isFullySettled = nextRem <= 0;

      const repayments = Array.isArray(activeLoanForPayoff.repayments) ? [...activeLoanForPayoff.repayments] : [];
      repayments.push({
        date: todayStr,
        amount: payAmt,
        notes: payoffNotes || "سداد نقدي معجل للخزينة",
        receivedBy: currentUser?.email || "admin"
      });

      // 3. Update installments array
      let remainingPaymentToDistribute = payAmt;
      let updatedInstallments = activeLoanForPayoff.installments;
      if (Array.isArray(activeLoanForPayoff.installments)) {
        updatedInstallments = activeLoanForPayoff.installments.map((inst: any) => {
          if (inst.status === "pending" && remainingPaymentToDistribute > 0) {
            if (remainingPaymentToDistribute >= inst.amount) {
              remainingPaymentToDistribute -= inst.amount;
              return { ...inst, status: "paid", paidAt: new Date().toISOString(), paymentMethod: "early_cash" };
            } else {
              const remInstAmt = inst.amount - remainingPaymentToDistribute;
              remainingPaymentToDistribute = 0;
              return { ...inst, amount: remInstAmt, originalAmount: inst.amount, note: `تم سداد ${payAmt} ج.م نقداً` };
            }
          }
          return inst;
        });
      }

      await updateDoc(doc(db, "loans", activeLoanForPayoff.id), {
        remainingBalance: nextRem,
        settledAmount: nextSettled,
        settled: isFullySettled,
        status: isFullySettled ? "settled" : "approved",
        repayments,
        installments: updatedInstallments || [],
        lastEarlyPayoffDate: todayStr,
        ...(isFullySettled && { settledAt: serverTimestamp() })
      });

      // 4. Update local state
      const updatedLoan = {
        ...activeLoanForPayoff,
        remainingBalance: nextRem,
        settledAmount: nextSettled,
        settled: isFullySettled,
        status: isFullySettled ? "settled" : "approved",
        repayments,
        installments: updatedInstallments
      };

      setEmpLoans(prev => prev.map(l => l.id === activeLoanForPayoff.id ? updatedLoan : l));

      toast.success(isAr ? "تم توريد المبلغ للخزينة وتحديث رصيد السلفة بنجاح!" : "Amount deposited into safe and loan balance updated!");
      setShowEarlyPayoffModal(false);
      setPayoffAmount(0);
      setPayoffNotes("");

      // Set for receipt printing
      setSelectedLoanForPrint({
        ...updatedLoan,
        receiptPaidAmount: payAmt,
        receiptPreviousBalance: curRem,
        receiptNewBalance: nextRem,
        receiptDate: todayStr
      });
    } catch (err) {
      console.error("Failed to record early payoff:", err);
      toast.error(isAr ? "فشل تسجيل السداد المعجل" : "Failed to record early payoff");
    } finally {
      setIsSubmittingPayoff(false);
    }
  };

  // Helper to extract first 3 names (الاسم الثلاثي) intelligently preserving compound names (e.g. عبد الرحمن, أبو الوفا)
  const getThreePartName = (fullName: string): string => {
    if (!fullName) return "";
    const cleaned = fullName.trim().replace(/\s+/g, " ");
    const tokens = cleaned.split(" ");
    if (tokens.length <= 3) return cleaned;

    const compoundPrefixes = new Set([
      "عبد", "أبو", "ابو", "أم", "ام", "ابن", "آل", "سيف", "نور", "عز",
      "جمال", "صلاح", "شمس", "علاء", "بهاء", "حسام", "فخر", "ضياء", "منة", "منه", "خير", "تقي", "هبة", "هبه"
    ]);

    const parts: string[] = [];
    let i = 0;
    while (i < tokens.length && parts.length < 3) {
      const current = tokens[i];
      const next = tokens[i + 1];

      if (compoundPrefixes.has(current) && next) {
        parts.push(`${current} ${next}`);
        i += 2;
      } else {
        parts.push(current);
        i += 1;
      }
    }

    return parts.join(" ");
  };

  const filtered = useMemo(() => {
    const list = employees.filter((emp) => {
      if (statusFilter !== "All Status" && emp.status !== statusFilter.toLowerCase()) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        return (
          emp.name?.toLowerCase().includes(q) ||
          emp.nationalId?.toLowerCase().includes(q) ||
          emp.position?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const statusPriority: Record<string, number> = {
      active: 1,
      suspended: 2,
      left: 3,
    };

    return list.sort((a, b) => {
      const priorityA = statusPriority[a.status?.toLowerCase()] || 99;
      const priorityB = statusPriority[b.status?.toLowerCase()] || 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Within the same status, sort alphabetically
      return (a.name || "").localeCompare(b.name || "", "ar");
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

  const handleOpenCareerModal = (mode: "transfer" | "promotion") => {
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بنقل أو ترقية الموظفين." : "Managers are not authorized to transfer or promote employees.");
      return;
    }
    if (!activeEmp) return;
    setCareerMode(mode);
    setCareerTargetBranch(activeEmp.storeId?.toLowerCase().includes("ola") ? "alamein4" : "ola");
    setCareerTargetPosition(activeEmp.position || "Cashier");
    setCareerTargetSalary(activeEmp.baseSalary || 0);
    setCareerEffectiveDate(new Date().toISOString().split("T")[0]);
    setCareerNotes("");
    setShowCareerModal(true);
  };

  const handleSubmitCareer = async (e?: React.FormEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!activeEmp) return;
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بنقل أو ترقية الموظفين." : "Managers are not authorized to transfer or promote employees.");
      return;
    }
    setIsSubmittingCareer(true);
    try {
      const eventId = `CE-${Date.now()}`;
      let newEvent: CareerEvent;
      const updates: Partial<Employee> = {
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "admin"
      };

      if (careerMode === "transfer") {
        newEvent = {
          id: eventId,
          date: careerEffectiveDate || new Date().toISOString().split("T")[0],
          type: "transfer",
          title: careerTargetBranch === "ola" ? "نقل إلى فرع أولا القرنفل (التجمع الخامس)" : "نقل إلى فرع العلمين 4 (مارينا الساحل)",
          fromBranch: activeEmp.storeId || currentBranch || "alamein4",
          toBranch: careerTargetBranch,
          notes: careerNotes || "قرار نقل إداري بين فروع الشركة",
          createdBy: currentUser?.email || "admin"
        };
        updates.storeId = careerTargetBranch === "ola" ? "ola" : "eL-alamein-4";
      } else {
        newEvent = {
          id: eventId,
          date: careerEffectiveDate || new Date().toISOString().split("T")[0],
          type: "promotion",
          title: `ترقية إلى وظيفة: ${careerTargetPosition}`,
          fromPosition: activeEmp.position,
          toPosition: careerTargetPosition,
          fromSalary: activeEmp.baseSalary || 0,
          toSalary: Number(careerTargetSalary) || activeEmp.baseSalary || 0,
          notes: careerNotes || "ترقية وظيفية وتعديل مسمى وراتب",
          createdBy: currentUser?.email || "admin"
        };
        updates.position = careerTargetPosition;
        if (Number(careerTargetSalary) > 0) {
          updates.baseSalary = Number(careerTargetSalary);
        }
      }

      const updatedHistory = [newEvent, ...(activeEmp.careerHistory || [])];
      updates.careerHistory = updatedHistory;

      await updateDoc(doc(db, "employees", activeEmp.id), updates);
      toast.success(
        careerMode === "transfer"
          ? (isAr ? "تم نقل الموظف بنجاح وتحديث بيانات الفرع!" : "Employee transferred and branch updated successfully!")
          : (isAr ? "تمت ترقية الموظف وتعديل بياناته الوظيفية بنجاح!" : "Employee promoted and position updated successfully!")
      );
      setShowCareerModal(false);
      setCareerNotes("");

      // Update local state
      setEmployees(prev => prev.map(emp => emp.id === activeEmp.id ? { ...emp, ...updates } : emp));
      if (selectedEmployee?.id === activeEmp.id) {
        setSelectedEmployee(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error("Failed to submit career event:", err);
      toast.error(isAr ? "فشل تحديث المسار الوظيفي للموظف" : "Failed to update employee career status");
    } finally {
      setIsSubmittingCareer(false);
    }
  };

  const handleOpenBonusModal = () => {
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بمنح المكافآت." : "Managers are not authorized to award bonuses.");
      return;
    }
    if (!activeEmp) return;
    setBonusAmount(500);
    setBonusReason(isAr ? "مكافأة تميز وسنوية عمل / عيد ميلاد" : "Performance & Work Anniversary / Birthday Bonus");
    setShowBonusModal(true);
  };

  const handleSubmitBonus = async (e?: React.FormEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!activeEmp) return;
    if (isManager) {
      toast.error(isAr ? "المديرون غير مخولين بمنح المكافآت." : "Managers are not authorized to award bonuses.");
      return;
    }
    setIsSubmittingBonus(true);
    try {
      const payload = {
        employeeId: activeEmp.id,
        employeeName: activeEmp.name,
        amount: Number(bonusAmount),
        type: "bonus",
        reason: bonusReason || (isAr ? "مكافأة مناسبات / أداء متميز" : "Special Occasion / Performance Bonus"),
        date: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7),
        storeId: activeEmp.storeId || currentBranch || "alamein4",
        status: "approved",
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "admin"
      };

      await addDoc(collection(db, "adjustments"), payload);
      toast.success(
        isAr
          ? `تم صرف مكافأة قدرها ${Number(bonusAmount).toLocaleString()} ج.م وقيدها بحسابات الموظف!`
          : `Bonus of ${Number(bonusAmount).toLocaleString()} EGP granted to employee!`
      );
      setShowBonusModal(false);
      setBonusReason(isAr ? "مكافأة تميز وحسن سير وسلوك" : "Excellence & Good Conduct Bonus");
    } catch (err) {
      console.error("Failed to grant bonus:", err);
      toast.error(isAr ? "فشل صرف المكافأة" : "Failed to grant bonus");
    } finally {
      setIsSubmittingBonus(false);
    }
  };

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
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] pb-32 print:hidden relative overflow-hidden" dir={isAr ? "rtl" : "ltr"}>
        {/* Subtle animated background mesh */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[120px]"></div>
        </div>

        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 relative z-10">

          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2 drop-shadow-sm">
                {isAr ? "مركز إدارة شؤون العاملين" : "Command Center"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                {isAr ? "إدارة شؤون الموظفين، الحركات والمسيرات، والوثائق والعقود الرسمية." : "Manage workforce, analyze payroll, and handle contracts."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center justify-center p-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md transition-all cursor-pointer"
                title={isAr ? "تحديث البيانات" : "Refresh Data"}
              >
                <RefreshCw size={20} className={loading ? "animate-spin text-indigo-500" : ""} />
              </button>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-slate-900/20 dark:shadow-white/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <Plus size={20} /> {isAr ? "إضافة موظف جديد" : "Add Employee"}
              </button>
            </div>
          </div>

          {/* Metrics Top Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{isAr ? "على رأس العمل" : "Active"}</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{isAr ? "موقوف مؤقتاً" : "Suspended"}</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{suspendedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{isAr ? "ترك العمل" : "Left"}</p>
                <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{leftCount}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <UserX size={24} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-5 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{isAr ? "إجمالي الموظفين" : "Total Employees"}</p>
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
                  <Search size={18} className={`absolute ${isAr ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-slate-400`} />
                  <input
                    type="text"
                    placeholder={isAr ? "بحث بالاسم، الرقم القومي، الهاتف..." : "Search employees..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full bg-slate-100 dark:bg-black/20 text-slate-900 dark:text-white font-medium p-3 ${isAr ? "pr-11 pl-4" : "pl-11 pr-4"} rounded-2xl outline-none border border-transparent focus:border-indigo-500/50 transition-all placeholder:text-slate-400`}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex-1 bg-slate-100 dark:bg-black/20 text-sm font-bold p-3 rounded-2xl outline-none text-slate-700 dark:text-slate-200 border border-transparent focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="All Status">{isAr ? "جميع الحالات" : "All Status"}</option>
                    <option value="active">{isAr ? "نشط (على رأس العمل)" : "Active (نشط)"}</option>
                    <option value="suspended">{isAr ? "موقوف مؤقتاً" : "Suspended (موقوف)"}</option>
                    <option value="left">{isAr ? "ترك العمل (منهي خدمته)" : "Left (ترك العمل)"}</option>
                  </select>
                </div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto px-2 space-y-2 custom-scrollbar pb-4">
                {loading ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={30} /></div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm font-medium">
                    {isAr ? "لم يتم العثور على موظفين." : "No employees found."}
                  </div>
                ) : (
                  filtered.map(emp => {
                    const isActive = activeEmployeeId === emp.id;
                    const grad = getColorGradient(emp.name);
                    const shortName = getThreePartName(emp.name);

                    return (
                      <div
                        key={emp.id}
                        onClick={() => setActiveEmployeeId(emp.id)}
                        title={isAr ? `الاسم الكامل الرسمي: ${emp.name}` : `Full Legal Name: ${emp.name}`}
                        className={`group cursor-pointer p-3 rounded-2xl flex items-center justify-between transition-all duration-200 border ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-500/15 shadow-sm border-indigo-200 dark:border-indigo-500/40 ring-1 ring-indigo-500/20"
                            : "hover:bg-slate-100 dark:hover:bg-white/5 border-transparent hover:border-slate-200/60 dark:hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-1">
                          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-base shadow-md shrink-0 relative`}>
                            {emp.name.charAt(0)}
                            {emp.status === "active" && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#121216]" />
                            )}
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <p className={`font-bold text-[14.5px] truncate leading-tight ${
                              isActive ? "text-indigo-900 dark:text-indigo-200" : "text-slate-800 dark:text-slate-100"
                            }`}>
                              {shortName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                                {emp.position}
                              </span>
                              {emp.status !== "active" && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                                  emp.status === "suspended"
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/40"
                                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/40"
                                }`}>
                                  {emp.status === "suspended" ? (isAr ? "موقوف" : "Suspended") : (isAr ? "ترك العمل" : "Left")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Dot and Quick Actions */}
                        <div className="shrink-0 flex items-center gap-1 pl-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintFolderCover(emp);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all cursor-pointer"
                            title={isAr ? "طباعة غلاف ملف الموظف (A4)" : "Print Folder Cover (A4)"}
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTerminationModal(emp);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                            title={isAr ? "إخلاء طرف ومخالصة نهائية" : "Termination Clearance"}
                          >
                            <FileCheck2 size={15} />
                          </button>
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              emp.status === 'active'
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                : emp.status === 'suspended'
                                  ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                            }`}
                            title={emp.status === 'active' ? (isAr ? 'نشط' : 'Active') : emp.status === 'suspended' ? (isAr ? 'موقوف' : 'Suspended') : (isAr ? 'ترك العمل' : 'Left')}
                          />
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

                    {/* Action Buttons floating top right / left */}
                    <div className={`absolute top-6 ${isAr ? "left-6" : "right-6"} flex items-center gap-2.5 flex-wrap justify-end`}>
                      {!isManager && (
                        <button
                          onClick={() => handleOpenEdit(activeEmp)}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-2xl transition-all shadow-sm cursor-pointer"
                          title={isAr ? "تعديل بيانات الموظف" : "Edit Details"}
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
                          title={isAr ? "خطابات ومستندات رسمية معتمدة" : "Official Corporate HR Letters"}
                        >
                          <FileBadge2 size={16} />
                          <span>{isAr ? "الخطابات الرسمية" : "HR Letters"}</span>
                          <span className="text-[11px] bg-emerald-800/80 px-1.5 py-0.5 rounded text-white/90">{isAr ? "معتمد" : "Official"}</span>
                          <ChevronDown size={14} className={`transition-transform duration-200 ${showLettersMenu ? "rotate-180" : ""}`} />
                        </button>
                        {showLettersMenu && (
                          <div className={`absolute ${isAr ? "left-0" : "right-0"} mt-2 w-72 bg-white dark:bg-[#121216] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150`}>
                            <div className={`px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-1 ${isAr ? "text-right" : "text-left"}`}>
                              <p className="text-xs font-black text-slate-800 dark:text-white">{isAr ? "المستندات الرسمية المعتمدة (A4)" : "Official Documents (A4)"}</p>
                              <p className="text-[10px] text-slate-400">{isAr ? "طباعة خطابات معتمدة بخاتم الشركة" : "Print official certified letters"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePrintSalaryLetter(activeEmp)}
                              className={`w-full ${isAr ? "text-right" : "text-left"} px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group cursor-pointer`}
                            >
                              <span className="flex items-center gap-2">
                                <Banknote size={15} className="text-emerald-600 group-hover:scale-110 transition" />
                                <span>{isAr ? "شهادة مفردات مرتب (مفردات الدخل)" : "Salary Certificate (Proof of Income)"}</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintExperienceCert(activeEmp)}
                              className={`w-full ${isAr ? "text-right" : "text-left"} px-3 py-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group cursor-pointer`}
                            >
                              <span className="flex items-center gap-2">
                                <Award size={15} className="text-indigo-600 group-hover:scale-110 transition" />
                                <span>{isAr ? "شهادة خبرة رسمية (مادة 130)" : "Experience Certificate (Labor Law 130)"}</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintBankMandate(activeEmp)}
                              className={`w-full ${isAr ? "text-right" : "text-left"} px-3 py-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group cursor-pointer`}
                            >
                              <span className="flex items-center gap-2">
                                <Landmark size={15} className="text-sky-600 group-hover:scale-110 transition" />
                                <span>{isAr ? "خطاب فتح حساب بنكي وتحويل راتب" : "Bank Mandate & Salary Transfer"}</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <div className="h-px bg-slate-100 dark:border-white/5 my-1" />
                            <div className={`px-3 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 ${isAr ? "text-right" : "text-left"}`}>
                              {isAr ? "الهيئة القومية للتأمين الاجتماعي (قانون 148)" : "Social Insurance (Law 148/2019)"}
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePrintSocialInsurance1(activeEmp)}
                              className={`w-full ${isAr ? "text-right" : "text-left"} px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group cursor-pointer`}
                            >
                              <span className="flex items-center gap-2">
                                <FileText size={15} className="text-amber-600 group-hover:scale-110 transition" />
                                <span>{isAr ? "استمارة 1 تأمينات (س1 - اشتراك جديد)" : "Social Insurance Form 1 (S1 - New Hire)"}</span>
                              </span>
                              <Printer size={13} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintSocialInsurance6(activeEmp)}
                              className={`w-full ${isAr ? "text-right" : "text-left"} px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-800 dark:text-slate-100 flex items-center justify-between text-xs font-bold transition group cursor-pointer`}
                            >
                              <span className="flex items-center gap-2">
                                <FileText size={15} className="text-rose-600 group-hover:scale-110 transition" />
                                <span>{isAr ? "استمارة 6 تأمينات (س6 - إنهاء خدمة)" : "Social Insurance Form 6 (S6 - Exit)"}</span>
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
                        title={isAr ? "طباعة غلاف ملف الموظف (A4)" : "Print Folder Cover (A4)"}
                      >
                        <Printer size={16} />
                        <span>{isAr ? "غلاف الملف" : "Folder Cover"}</span>
                        <span className="text-[11px] bg-indigo-800/80 px-1.5 py-0.5 rounded text-white/90">{isAr ? "ملف A4" : "A4 Cover"}</span>
                      </button>
                      <button
                        onClick={() => handleOpenTerminationModal(activeEmp)}
                        className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-rose-600/30 active:scale-95 cursor-pointer"
                        title={isAr ? "مخالصة نهائية وإخلاء طرف" : "Termination & Clearance"}
                      >
                        <FileCheck2 size={16} />
                        <span>{isAr ? "إخلاء طرف ومخالصة" : "Termination Clearance"}</span>
                        <span className="text-[11px] bg-rose-800/80 px-1.5 py-0.5 rounded text-white/90">{isAr ? "مخالصة" : "Clearance"}</span>
                      </button>
                      <button
                        onClick={() => handlePrintContract(activeEmp)}
                        disabled={isPrinting}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-black/50 hover:bg-slate-800 dark:hover:bg-black/80 backdrop-blur-md text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg cursor-pointer"
                      >
                        {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                        {isAr ? "طباعة عقد العمل" : "Print Contract"}
                      </button>
                    </div>

                    {/* Massive Avatar overlapping the edge */}
                    <div className={`absolute -bottom-12 ${isAr ? "right-10" : "left-10"} w-28 h-28 rounded-[2rem] bg-slate-50 dark:bg-[#0A0A0A] shadow-2xl p-2 z-10`}>
                      <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${getColorGradient(activeEmp.name)} flex items-center justify-center text-white font-black text-5xl`}>
                        {activeEmp.name.charAt(0)}
                      </div>
                    </div>
                  </div>

                  {/* Profile Body */}
                  <div className="pt-16 px-6 sm:px-10 pb-10 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/50">
                            <CheckCircle2 size={12} className="text-indigo-500" />
                            {isAr ? "الاسم الرسمي الكامل (Full Legal Name)" : "Full Legal Name"}
                          </span>
                          {activeEmp.nationalId && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                              ({isAr ? "رقم قومي: " : "National ID: "}{activeEmp.nationalId})
                            </span>
                          )}
                        </div>
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
                              ● {activeEmp.status === "active" ? (isAr ? "نشط" : "Active") : activeEmp.status === "suspended" ? (isAr ? "موقوف" : "Suspended") : (isAr ? "ترك العمل" : "Left")}
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
                                title={isAr ? "تعيين كنشط بالخدمة" : "Mark Active"}
                              >
                                ● {isAr ? "نشط" : "Active"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(activeEmp.id, "suspended")}
                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeEmp.status === "suspended"
                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                title={isAr ? "تعيين كموقوف مؤقتاً" : "Mark Suspended"}
                              >
                                ● {isAr ? "موقوف" : "Suspended"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(activeEmp.id, "left")}
                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeEmp.status === "left"
                                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                title={isAr ? "تعيين كمنهي الخدمة أو ترك العمل" : "Mark Left"}
                              >
                                ● {isAr ? "ترك العمل" : "Left"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {!isManager && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenCareerModal("transfer")}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-bold transition border border-indigo-200 dark:border-indigo-800/40 cursor-pointer"
                            title={isAr ? "نقل فرع" : "Branch Transfer"}
                          >
                            <ArrowRightLeft size={15} />
                            <span>{isAr ? "نقل فرع" : "Transfer Branch"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCareerModal("promotion")}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold transition border border-emerald-200 dark:border-emerald-800/40 cursor-pointer"
                            title={isAr ? "ترقية وتعديل راتب" : "Promotion & Raise"}
                          >
                            <TrendingUp size={15} />
                            <span>{isAr ? "ترقية / مسمى" : "Promotion / Raise"}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(activeEmp.id)}
                            className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 cursor-pointer"
                            title={isAr ? "حذف الموظف" : "Delete Employee"}
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* MILESTONE CELEBRATIONS (BIRTHDAYS & WORK ANNIVERSARIES) */}
                    {(() => {
                      const m = getMilestoneCelebrationStatus(activeEmp);
                      if (!m || (!m.birthdayInfo && !m.anniversaryInfo)) return null;
                      const { birthdayInfo, anniversaryInfo } = m;

                      return (
                        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-pink-500/10 border border-amber-500/20 shadow-sm relative overflow-hidden">
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <Gift size={20} />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                                  {isAr ? "مناسبات وتكريم العاملين وسنوية العمل" : "Milestone Celebrations & Recognition"}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  {isAr ? "متابعة المناسبات السعيدة لتعزيز ولاء العاملين وتحفيزهم" : "Track birthdays and work anniversaries to boost loyalty and engagement"}
                                </p>
                              </div>
                            </div>
                            {!isManager && (
                              <button
                                type="button"
                                onClick={handleOpenBonusModal}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer"
                              >
                                <Award size={14} />
                                <span>{isAr ? "صرف مكافأة تميز / مناسبة" : "Issue Milestone Bonus"}</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Birthday Box */}
                            {birthdayInfo ? (
                              <div className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                                birthdayInfo.isToday
                                  ? "bg-pink-500/15 border-pink-500/40 text-pink-700 dark:text-pink-300 shadow-sm"
                                  : birthdayInfo.isUpcoming
                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                    : "bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
                              }`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                                    <Cake size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black">{isAr ? `عيد الميلاد (${birthdayInfo.dateStr})` : `Birthday (${birthdayInfo.dateStr})`}</span>
                                      {birthdayInfo.isToday && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white animate-pulse">
                                          {isAr ? "اليوم! 🎉" : "Today! 🎉"}
                                        </span>
                                      )}
                                      {birthdayInfo.isUpcoming && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                          {isAr ? `خلال ${birthdayInfo.daysToBirthday} يوم` : `In ${birthdayInfo.daysToBirthday} days`}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {birthdayInfo.isToday
                                        ? (isAr ? `يتم اليوم عامه الـ ${birthdayInfo.turningAge}، نتمنى له عاماً سعيداً!` : `Turns ${birthdayInfo.turningAge} today, wishing them a happy birthday!`)
                                        : (isAr ? `متبقي ${birthdayInfo.daysToBirthday} يوم ليكمل ${birthdayInfo.turningAge} سنة` : `${birthdayInfo.daysToBirthday} days left to turn ${birthdayInfo.turningAge} years old`)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppGreeting(activeEmp, "birthday")}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow transition active:scale-95 cursor-pointer shrink-0"
                                  title={isAr ? "تهنئة واتساب" : "WhatsApp Greeting"}
                                >
                                  <MessageCircle size={15} />
                                  <span className="hidden sm:inline">{isAr ? "تهنئة واتساب" : "WhatsApp"}</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400 text-xs flex items-center justify-center">
                                {isAr ? "تاريخ الميلاد غير مسجل (سجل الرقم القومي لحساب تلقائي)" : "Birth date not registered (Enter National ID for auto-calculation)"}
                              </div>
                            )}

                            {/* Work Anniversary Box */}
                            {anniversaryInfo ? (
                              <div className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                                anniversaryInfo.isToday
                                  ? "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 shadow-sm"
                                  : anniversaryInfo.isUpcoming
                                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                                    : "bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
                              }`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <Award size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black">{isAr ? "سنوية العمل في الشركة" : "Work Anniversary"}</span>
                                      {anniversaryInfo.isToday && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white animate-pulse">
                                          {isAr ? "اليوم! 🌟" : "Today! 🌟"}
                                        </span>
                                      )}
                                      {anniversaryInfo.isUpcoming && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                                          {isAr ? `خلال ${anniversaryInfo.daysToAnniversary} يوم` : `In ${anniversaryInfo.daysToAnniversary} days`}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {anniversaryInfo.isToday
                                        ? (isAr ? `يُتم اليوم ${anniversaryInfo.milestoneYears} سنوات من العطاء والولاء!` : `Completes ${anniversaryInfo.milestoneYears} years of dedication today!`)
                                        : (isAr ? `يكمل ${anniversaryInfo.milestoneYears} سنوات عمل خلال ${anniversaryInfo.daysToAnniversary} يوم` : `Completes ${anniversaryInfo.milestoneYears} years of service in ${anniversaryInfo.daysToAnniversary} days`)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppGreeting(activeEmp, "anniversary")}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow transition active:scale-95 cursor-pointer shrink-0"
                                  title={isAr ? "تهنئة واتساب" : "WhatsApp Greeting"}
                                >
                                  <MessageCircle size={15} />
                                  <span className="hidden sm:inline">{isAr ? "تهنئة سنوية" : "Milestone"}</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400 text-xs flex items-center justify-center">
                                {isAr ? "تاريخ بدء العمل غير مسجل" : "Hire date not registered"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

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
                              <span>{isAr ? "الشهادات الصحية والأوراق الرسمية" : "Legal Compliance & Health Certificates"}</span>
                            </h3>
                            {(hc.status === "expired" || hc.status === "missing") && (
                              <span className="text-[11px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full border border-rose-500/30 flex items-center gap-1">
                                <AlertTriangle size={12} /> {isAr ? "تنبيه سلامة الغذاء: شهادة صحية مطلوبة" : "Food Safety Alert: Health Certificate Required"}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {/* Health Certificate */}
                            <div className={`p-4 rounded-2xl border ${hc.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isAr ? "الشهادة الصحية" : "Health Certificate"}
                                  </span>
                                  <HeartPulse size={16} className={hc.status === "valid" ? "text-emerald-500" : "text-rose-500"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.healthCertExpiry || (isAr ? "غير مسجل" : "Not registered")}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{isAr ? hc.labelAr : hc.labelEn}</span>
                              </div>
                            </div>

                            {/* National ID Expiry */}
                            <div className={`p-4 rounded-2xl border ${nidExp.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isAr ? "بطاقة الرقم القومي" : "National ID Card"}
                                  </span>
                                  <CreditCard size={16} className={nidExp.status === "valid" ? "text-emerald-500" : "text-amber-500"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.nationalIdExpiry || (activeEmp.nationalId ? (isAr ? "14 رقم قومي ساري" : "14-digit Valid ID") : (isAr ? "غير مسجل" : "Not registered"))}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{isAr ? nidExp.labelAr : nidExp.labelEn}</span>
                              </div>
                            </div>

                            {/* Criminal Record */}
                            <div className={`p-4 rounded-2xl border ${cr.badge} flex flex-col justify-between transition`}>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isAr ? "الفيش والتشبيه" : "Criminal Record (Fesh)"}
                                  </span>
                                  <ShieldCheck size={16} className={cr.status === "valid" ? "text-emerald-500" : "text-slate-400"} />
                                </div>
                                <p className="font-mono text-sm font-black text-slate-800 dark:text-white">
                                  {activeEmp.criminalRecordDate || (isAr ? "مستند بالأرشيف" : "Archived Record")}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[11px] font-bold block">{isAr ? cr.labelAr : cr.labelEn}</span>
                              </div>
                            </div>

                            {/* Military Status */}
                            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-black/20 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isAr ? "الموقف التجنيدي" : "Military Status"}
                                  </span>
                                  <Award size={16} className="text-indigo-500" />
                                </div>
                                <p className="text-xs font-black text-slate-800 dark:text-white line-clamp-2">
                                  {activeEmp.militaryStatus || (isAr ? "أدى الخدمة العسكرية (قدوة حسنة)" : "Completed Service (Good Conduct)")}
                                </p>
                              </div>
                              <div className="mt-3">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  {isAr ? "● مستند رسمي معتمد" : "● Official Certified Document"}
                                </span>
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
                                <span>{isAr ? "فترة الاختبار وتجديد العقود" : "Probation Period & Contract Renewal"}</span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {isAr
                                  ? "طبقاً للمادة (32) من قانون العمل المصري رقم 12 لسنة 2003: فترة الاختبار لا تزيد على 3 أشهر."
                                  : "Per Art. (32) of Egyptian Labor Law 12/2003: Probation cannot exceed 3 months."}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-xl text-xs font-black border self-start md:self-auto ${prob.badge}`}>
                              {isAr ? prob.labelAr : prob.labelEn}
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
                              <span>{isAr ? "تاريخ استلام العمل:" : "Hire Date:"} <strong className="text-slate-800 dark:text-slate-200 font-mono">{activeEmp.startDate || "-"}</strong></span>
                              <span className="mx-2">•</span>
                              <span>{isAr ? "منقضي:" : "Elapsed:"} <strong className="text-slate-800 dark:text-slate-200">{prob.daysElapsed} {isAr ? "يوماً" : "days"}</strong></span>
                            </div>
                            {crt && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{isAr ? "تجديد العقد السنوي:" : "Contract Renewal:"}</span>
                                <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${crt.badge}`}>
                                  {isAr ? crt.labelAr : crt.labelEn}
                                </span>
                              </div>
                            )}
                          </div>

                          {prob.stage === "evaluation_due" && (
                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
                              <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                              <span>{isAr ? prob.alertText : (prob.alertTextEn || prob.alertText)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. LOANS & ADVANCES LIVE SUMMARY */}
                    <div className="mb-8 p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                              <HandCoins size={18} />
                            </div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {isAr ? "سلف الموظف ومستحقاته المقيدة" : "Loans & Advances Management Suite"}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {isAr
                              ? "سجل السلف النقدية، الأقساط المجدولة، والتفويضات الرسمية بالخصم وفقاً للمادة (34) من قانون العمل رقم 12 لسنة 2003."
                              : "Cash advances register, scheduled installments, and official deduction authorizations per Art. (34) of Labor Law 12/2003."}
                          </p>
                        </div>
                        {!isManager && (
                          <button
                            type="button"
                            onClick={() => {
                              setLoanAmount(1000);
                              setLoanInstallmentMonths(1);
                              setLoanCategory("living");
                              setShowLoanModal(true);
                            }}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                          >
                            <Plus size={15} /> {isAr ? "صرف سلفة جديدة معتمدة" : "Issue New Advance"}
                          </button>
                        )}
                      </div>

                      {/* Stat Tiles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            {isAr ? "إجمالي المنصرف" : "Total Disbursed"}
                          </p>
                          <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white font-mono">{fmtCurrency(loanStats.totalBorrowed)}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                              {isAr ? "المسدد والمخصوم" : "Settled & Deducted"}
                            </p>
                            <span className="text-[9.5px] font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                              {loanStats.progressPercent}%
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtCurrency(loanStats.totalSettled)}</p>
                        </div>
                        <div className={`p-3.5 rounded-2xl border ${loanStats.remainingBalance > 0
                            ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30"
                            : "bg-emerald-50/60 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30"
                          }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                              {isAr ? "الرصيد المتبقي ذمته" : "Remaining Balance"}
                            </p>
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${loanStats.remainingBalance > 0 ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"}`}>
                              {loanStats.remainingBalance > 0 ? (isAr ? "ساري" : "Active") : (isAr ? "خالص الذمة" : "Settled")}
                            </span>
                          </div>
                          <p className={`text-base sm:text-lg font-black font-mono ${loanStats.remainingBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {fmtCurrency(loanStats.remainingBalance)}
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30">
                          <p className="text-[10.5px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
                            {isAr ? "قسط الراتب القادم" : "Next Payroll Due"}
                          </p>
                          <p className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-300 font-mono">
                            {fmtCurrency(loanStats.nextMonthInstallmentDue)}
                          </p>
                        </div>
                      </div>

                      {/* Repayment Journey Progress Bar */}
                      {loanStats.totalBorrowed > 0 && (
                        <div className="mb-5 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5">
                          <div className="flex items-center justify-between text-xs font-bold mb-2">
                            <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <span>{isAr ? "مسار سداد السلف" : "Repayment Journey"}</span>
                            </span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              {loanStats.totalSettled.toLocaleString()} {isAr ? "ج.م من" : "EGP of"} {loanStats.totalBorrowed.toLocaleString()} {isAr ? "ج.م" : "EGP"} ({loanStats.progressPercent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-white/10 h-3 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 rounded-full"
                              style={{ width: `${loanStats.progressPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Filter Tabs */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLoanFilter("all")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${loanFilter === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                          >
                            {isAr ? `الكل (${empLoans.length})` : `All (${empLoans.length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoanFilter("active")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${loanFilter === "active" ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-rose-600"}`}
                          >
                            {isAr
                              ? `سارية وقيد السداد (${empLoans.filter(l => (Number(l.remainingBalance ?? l.amount) > 0) && !l.settled && l.status !== "settled").length})`
                              : `Active (${empLoans.filter(l => (Number(l.remainingBalance ?? l.amount) > 0) && !l.settled && l.status !== "settled").length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoanFilter("settled")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${loanFilter === "settled" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-emerald-600"}`}
                          >
                            {isAr
                              ? `مسددة بالكامل (${empLoans.filter(l => l.settled || l.status === "settled" || (Number(l.remainingBalance ?? l.amount) <= 0)).length})`
                              : `Settled (${empLoans.filter(l => l.settled || l.status === "settled" || (Number(l.remainingBalance ?? l.amount) <= 0)).length})`}
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {isAr ? `إجمالي الحركات: ${empLoans.length}` : `Total records: ${empLoans.length}`}
                        </span>
                      </div>

                      {/* Loans History Cards / Table */}
                      {loadingLoans ? (
                        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-emerald-600" />
                          <span>{isAr ? "جاري تحميل سجل السلف والأقساط..." : "Loading loans and installment records..."}</span>
                        </div>
                      ) : empLoans.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 font-medium bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                          {isAr
                            ? "لا توجد سلف أو مستحقات مسجلة حالياً على الموظف (الذمة المالية خالصة تماماً)."
                            : "No loans or advances recorded. Financial liabilities are fully cleared."}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {empLoans
                            .filter(l => {
                              const rem = Number(l.remainingBalance !== undefined ? l.remainingBalance : (l.settled || l.status === "settled" ? 0 : (l.amount || l.approved || 0)));
                              const isSettled = l.settled === true || l.status === "settled" || rem <= 0;
                              if (loanFilter === "active") return !isSettled;
                              if (loanFilter === "settled") return isSettled;
                              return true;
                            })
                            .map((l, idx) => {
                              const origAmt = Number(l.amount || l.approved || l.requested || 0);
                              const remAmt = Number(l.remainingBalance !== undefined ? l.remainingBalance : (l.settled || l.status === "settled" ? 0 : origAmt));
                              const setAmt = Number(l.settledAmount !== undefined ? l.settledAmount : Math.max(0, origAmt - remAmt));
                              const isSettled = l.settled === true || l.status === "settled" || remAmt <= 0;
                              const pct = origAmt > 0 ? Math.min(100, Math.round((setAmt / origAmt) * 100)) : 100;
                              const isExpanded = expandedLoanId === (l.id || idx.toString());

                              return (
                                <div
                                  key={l.id || idx}
                                  className={`rounded-2xl border transition-all p-4 ${isSettled
                                      ? "bg-white/40 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 opacity-90"
                                      : "bg-white dark:bg-[#161616] border-amber-200 dark:border-amber-900/30 shadow-sm"
                                    }`}
                                >
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${isSettled ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"}`}>
                                        <HandCoins size={18} />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                            {fmtCurrency(origAmt)}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isSettled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"}`}>
                                            {isSettled ? (isAr ? "مسددة بالكامل (خالصة)" : "Fully Settled") : (isAr ? `متبقي: ${fmtCurrency(remAmt)}` : `Remaining: ${fmtCurrency(remAmt)}`)}
                                          </span>
                                          {l.category && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                                              {loanCategoryLabels[l.category]?.icon} {isAr ? loanCategoryLabels[l.category]?.label : (loanCategoryLabels[l.category]?.labelEn || loanCategoryLabels[l.category]?.label)}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                          <span>{isAr ? "تاريخ الصرف:" : "Issue Date:"} <strong className="font-mono text-slate-700 dark:text-slate-300">{l.date || "-"}</strong></span>
                                          <span className="mx-1.5">•</span>
                                          <span>{isAr ? "نظام التقسيط:" : "Installments:"} <strong className="text-slate-700 dark:text-slate-300">{l.installmentCount || 1} {isAr ? "شهر/أشهر" : "mo."}</strong> ({fmtCurrency(l.monthlyInstallment || origAmt)} / {isAr ? "شهر" : "mo."})</span>
                                          {l.reason && (
                                            <>
                                              <span className="mx-1.5">•</span>
                                              <span className="text-slate-500 truncate max-w-[200px]">{l.reason}</span>
                                            </>
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                                      {/* 1-Click Print Official Legal Contract */}
                                      <button
                                        type="button"
                                        onClick={() => handlePrintLoanContract(l, activeEmp)}
                                        title={isAr ? "طباعة إقرار استلام سلفة وتفويض بالخصم رسمي (A4)" : "Print Official Loan & Deduction Mandate (A4)"}
                                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Printer size={14} className="text-slate-500" />
                                        <span>{isAr ? "إقرار وتفويض (A4)" : "Mandate (A4)"}</span>
                                      </button>

                                      {/* Early Cash Payoff Button */}
                                      {!isSettled && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveLoanForPayoff(l);
                                            setPayoffAmount(remAmt);
                                            setPayoffNotes("");
                                            setShowEarlyPayoffModal(true);
                                          }}
                                          title={isAr ? "سداد نقدي معجل وتوريد للخزينة" : "Early Cash Payoff to Branch Safe"}
                                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                        >
                                          <DollarSign size={14} />
                                          <span>{isAr ? "سداد نقدي معجل" : "Early Payoff"}</span>
                                        </button>
                                      )}

                                      {/* WhatsApp Statement */}
                                      <button
                                        type="button"
                                        onClick={() => sendWhatsAppLoanStatement(l, activeEmp)}
                                        title={isAr ? "إرسال كشف حساب السلفة عبر واتساب" : "Send Loan Statement via WhatsApp"}
                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Share2 size={14} />
                                        <span>{isAr ? "واتساب" : "WhatsApp"}</span>
                                      </button>

                                      {/* Toggle Installments Table */}
                                      {Array.isArray(l.installments) && l.installments.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setExpandedLoanId(isExpanded ? null : (l.id || idx.toString()))}
                                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                          title={isAr ? "عرض جدول الأقساط الشهرية" : "Toggle Installment Schedule"}
                                        >
                                          <ChevronRight size={16} className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Mini Loan Progress Bar */}
                                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                                      <span>{isAr ? `نسبة السداد: ${pct}% (${fmtCurrency(setAmt)} مسدد)` : `Repaid: ${pct}% (${fmtCurrency(setAmt)} settled)`}</span>
                                      <span>{isAr ? `المتبقي: ${fmtCurrency(remAmt)}` : `Remaining: ${fmtCurrency(remAmt)}`}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${isSettled ? "bg-emerald-500" : "bg-amber-500"}`}
                                        style={{ width: `${pct}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Expandable Installment Breakdown Table */}
                                  {isExpanded && Array.isArray(l.installments) && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-200">
                                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        {isAr
                                          ? "جدول استحقاق الأقساط الشهرية المعتمدة (المادة 34 من قانون العمل 12 لسنة 2003):"
                                          : "Approved Monthly Installment Schedule (Egyptian Labor Law 12/2003, Art. 34):"}
                                      </p>
                                      <div className="overflow-x-auto custom-scrollbar">
                                        <table className={`w-full ${isAr ? "text-right" : "text-left"} text-xs`}>
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-bold">
                                              <th className="pb-1.5">{isAr ? "القسط" : "Inst."}</th>
                                              <th className="pb-1.5">{isAr ? "الشهر المستحق" : "Due Month"}</th>
                                              <th className="pb-1.5">{isAr ? "قيمة القسط" : "Amount"}</th>
                                              <th className="pb-1.5">{isAr ? "الحالة" : "Status"}</th>
                                              <th className="pb-1.5">{isAr ? "تاريخ وتفاصيل الخصم" : "Date & Details"}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {l.installments.map((inst: any, iIdx: number) => {
                                              const isInstPaid = inst.status === "paid";
                                              return (
                                                <tr key={iIdx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                                  <td className="py-2 font-mono text-slate-700 dark:text-slate-300 font-bold">
                                                    #{inst.installmentNumber || iIdx + 1}
                                                  </td>
                                                  <td className="py-2 font-mono text-slate-600 dark:text-slate-300">
                                                    {inst.month || "-"}
                                                  </td>
                                                  <td className="py-2 font-mono font-black text-slate-900 dark:text-white">
                                                    {fmtCurrency(inst.amount)}
                                                  </td>
                                                  <td className="py-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isInstPaid
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                                      }`}>
                                                      {isInstPaid
                                                        ? (inst.paymentMethod === "early_cash"
                                                          ? (isAr ? "تم سداده نقداً للخزينة" : "Paid in Cash to Safe")
                                                          : (isAr ? "تم الاستقطاع بالراتب" : "Deducted from Payroll"))
                                                        : (isAr ? "قيد الاستحقاق (مجدول)" : "Scheduled")}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 text-[11px] text-slate-500 font-mono">
                                                    {inst.paidAt ? new Date(inst.paidAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB') : (isAr ? "مجدول بالراتب القادم" : "Scheduled on next payroll")}
                                                    {inst.note && <span className={`${isAr ? "mr-2" : "ml-2"} text-indigo-600 dark:text-indigo-400`}>({inst.note})</span>}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Repayments History */}
                                      {Array.isArray(l.repayments) && l.repayments.length > 0 && (
                                        <div className="mt-2.5 p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5">
                                          <p className="text-[10.5px] font-bold text-slate-500 mb-1">
                                            {isAr ? "سجل التوريدات النقدية المعجلة للخزينة:" : "Early Safe Cash Inflow Log:"}
                                          </p>
                                          <div className="space-y-1">
                                            {l.repayments.map((rep: any, rIdx: number) => (
                                              <div key={rIdx} className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-mono">
                                                <span>• {rep.date}: {isAr ? "توريد نقدي بالخزينة بمبلغ" : "Cash deposit to safe of"} {fmtCurrency(rep.amount)}</span>
                                                <span className="text-slate-400">{isAr ? "بواسطة:" : "By:"} {rep.receivedBy}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* CAREER JOURNEY & PROMOTIONS TIMELINE */}
                    <div className="mb-8 p-6 rounded-3xl bg-white/50 dark:bg-black/20 border border-slate-100 dark:border-white/5 shadow-sm">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <TrendingUp size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white">
                              {isAr ? "سجل التنقلات والترقيات الوظيفية" : "Career Journey & Branch Transfers"}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {isAr
                                ? "تاريخ التدرج الوظيفي، التنقل بين الفروع، وتعديلات الرواتب"
                                : "Career progression history, branch transfers, and salary adjustments"}
                            </p>
                          </div>
                        </div>

                        {!isManager && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenCareerModal("transfer")}
                              className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <ArrowRightLeft size={14} />
                              <span>{isAr ? "نقل فرع" : "Branch Transfer"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCareerModal("promotion")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <TrendingUp size={14} />
                              <span>{isAr ? "ترقية" : "Promotion"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {(!activeEmp.careerHistory || activeEmp.careerHistory.length === 0) ? (
                        <div className="py-6 text-center text-xs text-slate-400 font-medium bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                          {isAr
                            ? `لا توجد تنقلات أو ترقيات مسجلة بعد. الموظف في موقعه الحالي منذ تاريخ التعيين (${activeEmp.startDate || "غير محدد"}).`
                            : `No transfers or promotions recorded yet. Employee is in current post since hire date (${activeEmp.startDate || "N/A"}).`}
                        </div>
                      ) : (
                        <div className={`space-y-3 relative ${isAr ? "before:right-4 pr-6 text-right" : "before:left-4 pl-6 text-left"} before:absolute before:inset-y-0 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10`}>
                          {activeEmp.careerHistory.map((item, idx) => (
                            <div key={item.id || idx} className="relative bg-white dark:bg-[#121216] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs">
                              <span className={`absolute ${isAr ? "-right-7" : "-left-7"} top-4 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black ${
                                item.type === "promotion" ? "bg-emerald-500" : "bg-indigo-500"
                              }`} />
                              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  item.type === "promotion"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                                }`}>
                                  {item.type === "promotion" ? (isAr ? "ترقية وظيفية" : "Promotion") : (isAr ? "نقل فرع" : "Branch Transfer")}
                                </span>
                                <span className="font-mono text-xs text-slate-400">{item.date}</span>
                              </div>
                              <h5 className="font-bold text-xs text-slate-800 dark:text-white mb-0.5">{item.title}</h5>
                              {item.type === "promotion" && item.toSalary && (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                  {isAr
                                    ? `تعديل الراتب: من ${fmtCurrency(item.fromSalary || 0)} إلى ${fmtCurrency(item.toSalary)}`
                                    : `Salary adjustment: from ${fmtCurrency(item.fromSalary || 0)} to ${fmtCurrency(item.toSalary)}`}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{item.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Data Grid */}
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                      {isAr ? "البيانات المالية والتعاقدية" : "Financial & Employment Details"}
                    </h3>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "الراتب الأساسي" : "Base Salary"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{fmtCurrency(activeEmp.baseSalary)}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "استقطاع التأمينات" : "Insurance Deduct"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{fmtCurrency(activeEmp.insurance)}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "تاريخ استلام العمل" : "Start Date"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">{activeEmp.startDate || "-"}</p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "فترة الوردية" : "Shift Time"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                          {activeEmp.shiftTime === "Morning" ? (isAr ? "صباحي" : "Morning") : activeEmp.shiftTime === "Night" ? (isAr ? "مسائي" : "Night") : (activeEmp.shiftTime || "-")}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "نوع التعاقد" : "Employment Type"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                          {activeEmp.fulltime ? (isAr ? "دوام كامل" : "Full-Time") : (isAr ? "دوام جزئي" : "Part-Time")}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isAr ? "السن والنوع" : "Age & Gender"}
                        </p>
                        <p className="text-2xl font-black text-slate-800 dark:text-white">
                          {activeEmp.age}{isAr ? " سنة" : "y"} / {activeEmp.gender === "Male" ? (isAr ? "ذكر" : "Male") : activeEmp.gender === "Female" ? (isAr ? "أنثى" : "Female") : activeEmp.gender}
                        </p>
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
                            {isAr ? "مخالصة نهائية وإخلاء طرف قانوني" : "Employee Exit & Legal Termination Clearance"}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {isAr
                              ? "إقرار رسمي طبقاً لقانون العمل المصري: إبراء ذمة العامل من العهد والتزامات الفرع المالية."
                              : "Official Egyptian Labor Law release: certifies liabilities cleared and custody returned."}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTerminationModal(activeEmp)}
                        className="shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
                      >
                        <FileCheck2 size={15} /> {isAr ? "إصدار وثيقة المخالصة" : "Issue Clearance Paper"}
                      </button>
                    </div>

                    {/* NATIONAL ID DECODED INTELLIGENCE CARD */}
                    {(() => {
                      if (!activeEmp.nationalId) return null;
                      const decoded = decodeEgyptianNationalId(activeEmp.nationalId);
                      if (!decoded.isValid) return null;

                      return (
                        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-sky-50/40 to-transparent dark:from-indigo-950/20 dark:via-sky-950/10 border border-indigo-200/80 dark:border-indigo-800/40 shadow-sm">
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                                <CreditCard size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-white">
                                  {isAr ? "البيانات المستخرجة وتدقيق الرقم القومي" : "National ID Civil Intelligence"}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {isAr
                                    ? "تدقيق رسمي وفقاً لسجلات الأحوال المدنية وقانون العمل وقانون التأمينات رقم 148"
                                    : "Official civil registry, Labor Law, and Social Insurance Law 148 audit"}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                              decoded.checksumValid
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                            }`}>
                              {decoded.checksumValid ? (isAr ? "مطابق رياضياً (Modulo-11) ✓" : "Modulo-11 Validated ✓") : (isAr ? "ساري رسمياً" : "Officially Valid")}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                            <div className="p-3 bg-white/70 dark:bg-black/30 rounded-2xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                {isAr ? "محافظة الميلاد" : "Birth Governorate"}
                              </span>
                              <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1">
                                <MapPin size={14} className="text-indigo-600" />
                                <span>{isAr ? decoded.governorateAr : (decoded.governorateEn || decoded.governorateAr)}</span>
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">{isAr ? "كود:" : "Code:"} {decoded.governorateCode}</span>
                            </div>

                            <div className="p-3 bg-white/70 dark:bg-black/30 rounded-2xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                {isAr ? "النوع والسن" : "Gender & Age"}
                              </span>
                              <p className="text-sm font-black text-slate-800 dark:text-white">
                                {isAr ? decoded.genderAr : decoded.gender} ({decoded.age} {isAr ? "سنة" : "yrs"})
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">{decoded.birthDate}</span>
                            </div>

                            <div className="p-3 bg-white/70 dark:bg-black/30 rounded-2xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                {isAr ? "الخروج على المعاش" : "Statutory Retirement"}
                              </span>
                              <p className="text-sm font-black text-slate-800 dark:text-white">
                                {isAr ? "سنة" : "Year"} {decoded.retirementYear}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {isAr ? "سن" : "Age"} {decoded.retirementAge} ({isAr ? `متبقي ${decoded.yearsToRetirement}س` : `${decoded.yearsToRetirement}y left`})
                              </span>
                            </div>

                            <div className="p-3 bg-white/70 dark:bg-black/30 rounded-2xl border border-slate-200/60 dark:border-white/5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                {isAr ? "الرقم القومي" : "National ID"}
                              </span>
                              <p className="font-mono text-xs font-black text-slate-800 dark:text-white truncate">
                                {decoded.cleanNid}
                              </p>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                {isAr ? "14 رقماً مسجلاً" : "14-digit recorded"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className={`p-2.5 rounded-xl border font-bold ${decoded.laborBadge} flex items-center gap-2`}>
                              <span>{isAr ? decoded.laborStatusAr : (decoded.laborStatusEn || decoded.laborStatusAr)}</span>
                            </div>
                            <div className={`p-2.5 rounded-xl border font-bold ${decoded.militaryBadge} flex items-center gap-2`}>
                              <span>{isAr ? decoded.militaryStatusAr : (decoded.militaryStatusEn || decoded.militaryStatusAr)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                      {isAr ? "البيانات الشخصية" : "Personal Info"}
                    </h3>
                    <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4 mb-8">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">
                          {isAr ? "الرقم القومي" : "National ID"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.nationalId || "-"}</span>
                          {activeEmp.nationalId && activeEmp.nationalId.length === 14 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              {isAr ? "ساري" : "Valid"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">
                          {isAr ? "المحافظة" : "Governorate of Origin"}
                        </span>
                        <span className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-1">
                          <MapPin size={16} className="text-indigo-600" />
                          <span>{activeEmp.governorateOfBirth || (activeEmp.nationalId ? (isAr ? decodeEgyptianNationalId(activeEmp.nationalId).governorateAr : (decodeEgyptianNationalId(activeEmp.nationalId).governorateEn || decodeEgyptianNationalId(activeEmp.nationalId).governorateAr)) : "-")}</span>
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">
                          {isAr ? "رقم الهاتف" : "Phone Number"}
                        </span>
                        <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.phone || "-"}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-slate-200 dark:border-white/10 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">
                          {isAr ? "العنوان" : "Address"}
                        </span>
                        <span className="font-black text-slate-800 dark:text-white text-lg">{activeEmp.address || "-"}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 gap-1">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">
                          {isAr ? "رقم إيصال الأمانة / الشيك" : "Cheque Signed #"}
                        </span>
                        <span className="font-mono font-black text-slate-800 dark:text-white text-lg">{activeEmp.chequeSignedNum || "-"}</span>
                      </div>
                    </div>

                    {/* Banking & Emergency Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Banking */}
                      <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Landmark size={14} className="text-indigo-500" />
                          <span>{isAr ? "بيانات الراتب والبنك" : "Bank & Payroll Details"}</span>
                        </h4>
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "اسم البنك" : "Bank Name"}</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.bankName || (isAr ? "غير محدد" : "Not specified")}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "الحساب / IBAN" : "Account / IBAN"}</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white truncate max-w-[160px]" title={activeEmp.bankIbanOrAccount}>
                              {activeEmp.bankIbanOrAccount || (isAr ? "غير محدد" : "Not specified")}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "انستاباي / محفظة" : "InstaPay / Wallet"}</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {activeEmp.instaPayAddress || (isAr ? "غير محدد" : "Not specified")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact */}
                      <div className="bg-white/50 dark:bg-black/20 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Users size={14} className="text-rose-500" />
                          <span>{isAr ? "جهة اتصال الطوارئ" : "Emergency Contact"}</span>
                        </h4>
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "اسم القريب" : "Contact Name"}</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.emergencyContactName || (isAr ? "غير مسجل" : "Not registered")}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-white/10 pb-2">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "صلة القرابة" : "Relationship"}</span>
                            <span className="font-bold text-slate-800 dark:text-white">{activeEmp.emergencyContactRelation || (isAr ? "غير مسجل" : "Not registered")}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{isAr ? "رقم الهاتف" : "Phone Number"}</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">
                              {activeEmp.emergencyContactPhone || (isAr ? "غير مسجل" : "Not registered")}
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
                  <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300 mb-2">
                    {isAr ? "لم يتم تحديد موظف" : "No Employee Selected"}
                  </h3>
                  <p className="text-slate-500 max-w-md">
                    {isAr
                      ? "اختر موظفاً من القائمة الجانبية لعرض ملفه الكامل، بياناته المالية، وعقود عمله."
                      : "Select an employee from the list to view their complete profile, financials, and contract details."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. ENTERPRISE LOAN & SALARY ADVANCE ISSUANCE MODAL */}
      {showLoanModal && activeEmp && (() => {
        const salary = Number(activeEmp.baseSalary) || 0;
        const maxSafeInstallment = Math.round(salary * 0.5);
        const months = Number(loanInstallmentMonths) || 1;
        const currentMonthlyInst = Math.round((Number(loanAmount) || 0) / months);
        const isCapExceeded = salary > 0 && currentMonthlyInst > maxSafeInstallment;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 relative max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <HandCoins size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {isAr ? "صرف سلفة نقدية وتقسيط معتمد" : "Issue Loan / Salary Advance"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeEmp.name} • {isAr ? "الراتب الأساسي:" : "Base Salary:"} {salary.toLocaleString()} {isAr ? "ج.م" : "EGP"} • {isAr ? "الفرع:" : "Branch:"} {activeEmp.storeId === "ola" ? (isAr ? "أولا القرنفل" : "Ola El-Qornofol") : (isAr ? "العلمين 4" : "Alamein 4")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Reason Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                    {isAr ? "تصنيف سبب السلفة (Retail Category) *" : "Loan Purpose Category *"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(loanCategoryLabels) as (keyof typeof loanCategoryLabels)[]).map((catKey) => {
                      const item = loanCategoryLabels[catKey];
                      const isSelected = loanCategory === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setLoanCategory(catKey as any)}
                          className={`p-2.5 rounded-xl border text-right transition flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs"
                              : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-600 dark:text-slate-400 text-xs"
                          }`}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span className="text-[11px] leading-tight">{isAr ? item.label : (item.labelEn || item.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount Input with Live Arabic Words */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {isAr ? "إجمالي مبلغ السلفة المطلوب (جنيه مصري) *" : "Total Loan Amount Required (EGP) *"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={loanAmount || ""}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      placeholder={isAr ? "مثال: 3000" : "e.g. 3000"}
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background text-lg font-mono font-black focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {isAr ? "ج.م" : "EGP"}
                    </span>
                  </div>
                  {loanAmount > 0 && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/30">
                      {isAr
                        ? `التفقيط الرسمي: فقط وقدره ${numberToArabicWords(loanAmount)} جنيهاً مصرياً لا غير.`
                        : `Words: Only ${numberToArabicWords(loanAmount)} Egyptian Pounds.`}
                    </p>
                  )}
                </div>

                {/* Multi-Month Installment Term Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      {isAr ? "مدة التقسيط وعدد الأقساط الشهرية *" : "Installment Plan & Months *"}
                    </label>
                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {fmtCurrency(currentMonthlyInst)} / {isAr ? "شهر" : "mo."}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4, 6, 10, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLoanInstallmentMonths(m)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                          loanInstallmentMonths === m
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                            : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        {m === 1 ? (isAr ? "دفعة واحدة" : "1 Month") : (isAr ? `${m} شهور` : `${m} Months`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Egyptian Labor Law Article 34 Cap Gauge */}
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition ${
                    isCapExceeded
                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/40 text-rose-800 dark:text-rose-200"
                      : "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  <ShieldCheck size={18} className={`shrink-0 mt-0.5 ${isCapExceeded ? "text-rose-600" : "text-emerald-600"}`} />
                  <div className="space-y-1">
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span>{isAr ? "ضوابط المادة (34) من قانون العمل رقم 12 لسنة 2003:" : "Egyptian Labor Law 12/2003 Art. 34 Regulations:"}</span>
                      <span className="font-mono font-black">
                        {isAr ? `الحد الأقصى القانوني للخصم (50%): ${fmtCurrency(maxSafeInstallment)}` : `Statutory Max Deduction (50%): ${fmtCurrency(maxSafeInstallment)}`}
                      </span>
                    </div>
                    {isCapExceeded ? (
                      <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300 font-medium">
                        {isAr
                          ? `⚠️ تحذير: القسط الشهري المحدد (${fmtCurrency(currentMonthlyInst)}) يتجاوز 50% من الراتب الأساسي للعامل (${fmtCurrency(maxSafeInstallment)}). يُنصح بزيادة عدد شهور التقسيط لتفادي مخالفة قانون العمل.`
                          : `⚠️ Warning: Monthly installment (${fmtCurrency(currentMonthlyInst)}) exceeds 50% of base salary (${fmtCurrency(maxSafeInstallment)}). Consider increasing installment months to comply with labor law.`}
                      </p>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300 font-medium">
                        {isAr
                          ? `✓ متوافق تماماً: القسط الشهري (${fmtCurrency(currentMonthlyInst)}) يقع في النطاق القانوني الآمن (أقل من 50% من الراتب الشهري).`
                          : `✓ Fully Compliant: Monthly installment (${fmtCurrency(currentMonthlyInst)}) is within safe legal limit (< 50% of base salary).`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Direct Safe Outflow Badge */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {isAr ? (
                      <><strong>التأثير المالي والخزينة:</strong> سيتم قيد المبلغ وصرفه مباشرة كمسحوبات نقدية من خزينة الفرع (Safe Cash Outflow)، وترحيل الأقساط شهرياً إلى مسير الرواتب تلقائياً.</>
                    ) : (
                      <><strong>Treasury Impact:</strong> Disbursed as a Safe Cash Outflow from branch safe, and installments will deduct automatically on payroll.</>
                    )}
                  </span>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {isAr ? "ملاحظات إضافية على السلفة" : "Additional Loan Notes"}
                  </label>
                  <textarea
                    rows={2}
                    value={loanNotes}
                    onChange={(e) => setLoanNotes(e.target.value)}
                    placeholder={isAr ? "اكتب أي ملاحظات خاصة بإذن الصرف أو موافقة الإدارة..." : "Enter any approval notes or comments..."}
                    className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingLoan || !loanAmount || loanAmount <= 0}
                  onClick={() => handleCreateLoan(activeEmp)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingLoan ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />}
                  <span>{isAr ? "اعتماد وصرف السلفة وتوليد الإقرار" : "Approve, Disburse & Generate Mandate"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. EARLY CASH PAYOFF & SAFE RECOVERY MODAL */}
      {showEarlyPayoffModal && activeLoanForPayoff && activeEmp && (() => {
        const rem = Number(activeLoanForPayoff.remainingBalance !== undefined ? activeLoanForPayoff.remainingBalance : activeLoanForPayoff.amount);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative">
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {isAr ? "سداد نقدي معجل وتوريد للخزينة" : "Early Cash Settlement & Safe Deposit"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeEmp.name} • {isAr ? "الرصيد المتبقي ذمته:" : "Remaining Balance:"} {fmtCurrency(rem)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEarlyPayoffModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 font-bold">{isAr ? "قيمة السلفة الأصلية:" : "Original Loan Amount:"}</span>
                    <span className="font-mono font-black text-slate-800 dark:text-white">{fmtCurrency(activeLoanForPayoff.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-bold">{isAr ? "الرصيد القائم ذمته حالياً:" : "Current Outstanding Balance:"}</span>
                    <span className="font-mono font-black text-rose-600 dark:text-rose-400">{fmtCurrency(rem)}</span>
                  </div>
                </div>

                {/* Amount to Pay */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {isAr ? "المبلغ المورد نقداً إلى خزينة الفرع (جنيه مصري) *" : "Cash Amount Deposited to Branch Safe (EGP) *"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={rem}
                      value={payoffAmount || ""}
                      onChange={(e) => setPayoffAmount(Number(e.target.value))}
                      placeholder="e.g. 1000"
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background text-lg font-mono font-black focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {isAr ? "ج.م" : "EGP"}
                    </span>
                  </div>

                  {/* Quick percentage chips */}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setPayoffAmount(Math.round(rem * 0.25))}
                      className="flex-1 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoffAmount(Math.round(rem * 0.5))}
                      className="flex-1 py-1 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoffAmount(rem)}
                      className="flex-1 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 cursor-pointer"
                    >
                      {isAr ? "100% (سداد كامل وخلو طرف)" : "100% (Full Settlement)"}
                    </button>
                  </div>
                </div>

                {/* Direct Safe Recovery Note */}
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5 text-indigo-600" />
                  <span>
                    {isAr ? (
                      <>سيتم توريد هذا المبلغ نقداً إلى <strong>خزينة الفرع مباشرة (Safe Inflow)</strong> كإيداع سداد سلفة، وتخفيض رصيد مديونية العامل فوراً دون انتظار موعد الراتب.</>
                    ) : (
                      <>Deposited directly into <strong>branch safe (Safe Inflow)</strong> to clear employee debt immediately without waiting for payroll.</>
                    )}
                  </span>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {isAr ? "ملاحظات أمين الخزينة / سند التوريد" : "Cashier Notes / Receipt Ref"}
                  </label>
                  <input
                    type="text"
                    value={payoffNotes}
                    onChange={(e) => setPayoffNotes(e.target.value)}
                    placeholder={isAr ? "مثال: توريد نقدي بخزينة فرع أولا القرنفل بخزينة المحل..." : "e.g. Cash deposit in branch safe..."}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEarlyPayoffModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingPayoff || !payoffAmount || payoffAmount <= 0 || payoffAmount > rem}
                  onClick={handleEarlyPayoff}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPayoff ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{isAr ? "تأكيد التوريد وسداد السلفة" : "Confirm Deposit & Settle"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CAREER / TRANSFER / PROMOTION MODAL */}
      {showCareerModal && activeEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${
                  careerMode === "transfer"
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {careerMode === "transfer" ? <ArrowRightLeft size={22} /> : <TrendingUp size={22} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {careerMode === "transfer"
                      ? (isAr ? "نقل موظف إلى فرع آخر" : "Branch Transfer")
                      : (isAr ? "ترقية موظف وتعديل مسمى وراتب" : "Promotion & Salary Adjustment")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeEmp.name} — {isAr ? "الوظيفة الحالية:" : "Current Position:"} {activeEmp.position} ({activeEmp.storeId?.toLowerCase().includes("ola") ? (isAr ? "فرع أولا القرنفل" : "Ola El-Qornofol Branch") : (isAr ? "فرع العلمين 4" : "Alamein 4 Branch")})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCareerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCareer} className="space-y-4">
              {careerMode === "transfer" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                    {isAr ? "الفرع المنقول إليه *" : "Destination Branch *"}
                  </label>
                  <select
                    value={careerTargetBranch}
                    onChange={(e) => setCareerTargetBranch(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  >
                    <option value="ola">{isAr ? "فرع أولا القرنفل (القاهرة الجديدة - التجمع الخامس)" : "Ola El-Qornofol Branch (New Cairo - 5th Settlement)"}</option>
                    <option value="alamein4">{isAr ? "فرع العلمين 4 (الساحل الشمالي - مارينا)" : "Alamein 4 Branch (North Coast - Marina)"}</option>
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      {isAr ? "المسمى الوظيفي الجديد (New Position) *" : "New Job Position *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={careerTargetPosition}
                      onChange={(e) => setCareerTargetPosition(e.target.value)}
                      placeholder="e.g. Senior Cashier / Assistant Branch Manager"
                      className="w-full p-3 rounded-xl border border-border bg-background text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                      {isAr ? "الراتب الأساسي الجديد (جنيه مصري) *" : "New Base Salary (EGP) *"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        required
                        value={careerTargetSalary || ""}
                        onChange={(e) => setCareerTargetSalary(Number(e.target.value))}
                        className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background text-base font-mono font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {isAr ? "ج.م" : "EGP"}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  {isAr ? "تاريخ سريان القرار *" : "Effective Date *"}
                </label>
                <input
                  type="date"
                  required
                  value={careerEffectiveDate}
                  onChange={(e) => setCareerEffectiveDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  {isAr ? "ملاحظات أو أسباب القرار الإداري" : "Administrative Notes / Reason"}
                </label>
                <textarea
                  rows={2}
                  value={careerNotes}
                  onChange={(e) => setCareerNotes(e.target.value)}
                  placeholder={
                    careerMode === "transfer"
                      ? (isAr ? "مثال: انتداب لموسم الصيف أو نقل دائم لتغطية احتياجات الفرع..." : "e.g. Summer season transfer or branch operational needs...")
                      : (isAr ? "مثال: ترقية استثنائية نظراً للأداء المتميز وتحقيق المستهدف..." : "e.g. Merit-based promotion for outstanding performance...")
                  }
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCareerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCareer}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                    careerMode === "transfer"
                      ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  }`}
                >
                  {isSubmittingCareer ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  <span>
                    {careerMode === "transfer"
                      ? (isAr ? "تأكيد النقل وحفظ السجل" : "Confirm Transfer & Save")
                      : (isAr ? "تأكيد الترقية وتحديث الراتب" : "Confirm Promotion & Update Salary")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MILESTONE BONUS MODAL */}
      {showBonusModal && activeEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] border border-border w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                  <Award size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {isAr ? "صرف مكافأة مناسبة / تميز" : "Issue Milestone / Merit Bonus"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeEmp.name} — {isAr ? "تقدير سنوية العمل أو عيد الميلاد" : "Work Anniversary or Birthday Recognition"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBonusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitBonus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  {isAr ? "قيمة المكافأة (جنيه مصري) *" : "Bonus Amount (EGP) *"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={50}
                    required
                    value={bonusAmount || ""}
                    onChange={(e) => setBonusAmount(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background text-lg font-mono font-black focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {isAr ? "ج.م" : "EGP"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                  {isAr ? "بيان سبب صرف المكافأة" : "Bonus Reason"}
                </label>
                <input
                  type="text"
                  required
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder={isAr ? "مثال: مكافأة تقديرية بمناسبة إتمام سنة من العطاء..." : "e.g. Recognition for completing a year of service..."}
                  className="w-full p-3 rounded-xl border border-border bg-background text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Gift size={15} className="shrink-0 mt-0.5" />
                <span>
                  {isAr
                    ? "سيتم تسجيل هذه المكافأة كبند مستحق إضافي في تسوية المرتبات الشهرية للموظف."
                    : "This bonus will be recorded as an additional entitlement in the employee's monthly payroll."}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBonus || !bonusAmount || bonusAmount <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingBonus ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  <span>{isAr ? "تأكيد اعتماد وصرف المكافأة" : "Confirm & Issue Bonus"}</span>
                </button>
              </div>
            </form>
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
                  {selectedEmployee
                    ? (isAr ? "تعديل بيانات الموظف" : "Edit Employee")
                    : (isAr ? "إضافة موظف جديد" : "Add Employee")}
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "الاسم الكامل (رباعي) *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder={isAr ? "مثال: أحمد محمد عبدالله" : "e.g. Ahmed Mohamed Abdullah"}
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "المسمى الوظيفي" : "Position"}
                  </label>
                  <select
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    {POSITIONS.map(p => (
                      <option key={p} value={p}>
                        {isAr ? (POSITION_AR_MAP[p] || p) : p}
                      </option>
                    ))}
                    <option value="Other">{isAr ? "أخرى" : "Other"}</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "حالة العمل" : "Status"}
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="active">{isAr ? "على رأس العمل (نشط)" : "Active (On Duty)"}</option>
                    <option value="suspended">{isAr ? "موقوف مؤقتاً عن العمل" : "Suspended"}</option>
                    <option value="left">{isAr ? "ترك العمل (منتهي الخدمة)" : "Left / Terminated"}</option>
                  </select>
                </div>

                {/* Base Salary & Insurance */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "الراتب الأساسي (ج.م)" : "Base Salary (EGP)"}
                  </label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "استقطاع التأمينات (ج.م)" : "Insurance Deduct (EGP)"}
                  </label>
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
                    <span>{isAr ? "الرقم القومي (14 رقم)" : "National ID (14 Digits)"}</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {isAr ? "فك تشفير ذكي وتدقيق تلقائي" : "Smart Decoding & Auto-Validation"}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={e => handleNationalIdChange(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono tracking-wider text-base"
                    placeholder={isAr ? "14 رقم قومي" : "14 Digits"}
                    maxLength={14}
                  />

                  {/* LIVE DECODED NATIONAL ID PREVIEW */}
                  {(() => {
                    if (!formData.nationalId) return null;
                    const decoded = decodeEgyptianNationalId(formData.nationalId);

                    if (!decoded.isValid) {
                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>{decoded.errorMessage || (isAr ? "رقم قومي غير صالح" : "Invalid National ID")}</span>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-2.5 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1 border-b border-indigo-200/50 dark:border-indigo-800/40 pb-1.5">
                          <span className="font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                            <CheckCircle size={13} className="text-emerald-500" />
                            <span>{isAr ? "بيانات الرقم القومي (مستخرجة تلقائياً):" : "National ID Decoded Data (Auto):"}</span>
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                            decoded.checksumValid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}>
                            {decoded.checksumValid
                              ? (isAr ? "مطابق رياضياً ✓" : "Checksum Valid ✓")
                              : (isAr ? "ساري رسمياً" : "Officially Valid")}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          <div className={`bg-white/80 dark:bg-black/30 p-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 ${isAr ? "text-right" : "text-left"}`}>
                            <span className="text-slate-400 block text-[10px]">{isAr ? "المحافظة:" : "Governorate:"}</span>
                            <strong className="text-slate-800 dark:text-white">📍 {isAr ? decoded.governorateAr : (decoded.governorateEn || decoded.governorateAr)}</strong>
                          </div>
                          <div className={`bg-white/80 dark:bg-black/30 p-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 ${isAr ? "text-right" : "text-left"}`}>
                            <span className="text-slate-400 block text-[10px]">{isAr ? "النوع والسن:" : "Gender & Age:"}</span>
                            <strong className="text-slate-800 dark:text-white">
                              {isAr
                                ? `${decoded.genderAr} (${decoded.age}س)`
                                : `${decoded.gender || decoded.genderAr} (${decoded.age}y)`}
                            </strong>
                          </div>
                          <div className={`bg-white/80 dark:bg-black/30 p-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 ${isAr ? "text-right" : "text-left"}`}>
                            <span className="text-slate-400 block text-[10px]">{isAr ? "المعاش:" : "Retirement:"}</span>
                            <strong className="text-slate-800 dark:text-white">👴 {decoded.retirementYear}</strong>
                          </div>
                        </div>

                        {/* Labor Law & Military Badges */}
                        <div className={`space-y-1 pt-0.5 ${isAr ? "text-right" : "text-left"}`}>
                          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${decoded.laborBadge}`}>
                            {isAr ? decoded.laborStatusAr : (decoded.laborStatusEn || decoded.laborStatusAr)}
                          </div>
                          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${decoded.militaryBadge}`}>
                            {isAr ? decoded.militaryStatusAr : (decoded.militaryStatusEn || decoded.militaryStatusAr)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "رقم الهاتف" : "Phone"}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                {/* Start Date & Date of Birth */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "تاريخ استلام العمل (بداية العقد)" : "Start Date (Onboarding)"}
                  </label>
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
                      {isAr ? "تاريخ الميلاد" : "Date of Birth"}
                    </label>
                    {formData.age ? (
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                        {formData.age} {isAr ? "سنة (محسوب)" : "yrs (calculated)"}
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
                      {isAr ? (
                        <>السن المحسوب تلقائياً: <strong className="text-slate-700 dark:text-slate-200">{formData.age} عاماً</strong></>
                      ) : (
                        <>Auto-calculated age: <strong className="text-slate-700 dark:text-slate-200">{formData.age} yrs</strong></>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAr ? "أدخل تاريخ الميلاد أو الرقم القومي لحساب السن تلقائياً" : "Enter birth date or National ID to calculate age"}
                    </p>
                  )}
                </div>

                {/* Shift & Fulltime */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "فترة العمل (الشفت)" : "Shift Time"}
                  </label>
                  <select
                    value={formData.shiftTime}
                    onChange={e => setFormData({ ...formData, shiftTime: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Morning">{isAr ? "صباحي (Morning)" : "Morning"}</option>
                    <option value="Night">{isAr ? "مسائي (Night)" : "Night"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "نوع التوظيف" : "Employment Type"}
                  </label>
                  <select
                    value={formData.fulltime ? "Yes" : "No"}
                    onChange={e => setFormData({ ...formData, fulltime: e.target.value === "Yes" })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Yes">{isAr ? "دوام كامل (Full-Time)" : "Full-Time"}</option>
                    <option value="No">{isAr ? "دوام جزئي (Part-Time)" : "Part-Time"}</option>
                  </select>
                </div>

                {/* Gender & Cheque */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "النوع" : "Gender"}
                  </label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  >
                    <option value="Male">{isAr ? "ذكر" : "Male"}</option>
                    <option value="Female">{isAr ? "أنثى" : "Female"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "رقم شيك / إيصال الأمانة" : "Cheque Signed #"}
                  </label>
                  <input
                    type="text"
                    value={formData.chequeSignedNum}
                    onChange={e => setFormData({ ...formData, chequeSignedNum: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder={isAr ? "اختياري" : "Optional"}
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "العنوان" : "Address"}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder={isAr ? "العنوان بالتفصيل..." : "Full address..."}
                  />
                </div>

                {/* --- Section: Retail Compliance & Official Documents --- */}
                <div className="md:col-span-2 pt-4 border-t border-border">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <HeartPulse size={16} className="text-rose-500" />
                    <span>{isAr ? "الشهادات الصحية والأوراق الرسمية والامتثال" : "Retail Compliance & Official Documents"}</span>
                  </h4>
                </div>

                {/* Health Cert Expiry */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>{isAr ? "تاريخ انتهاء الشهادة الصحية" : "Health Cert Expiry"}</span>
                    <span className="text-[10px] text-rose-500 font-bold">
                      {isAr ? "إلزامية لمحلات الأغذية" : "Mandatory for Food Retail"}
                    </span>
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
                    {isAr ? "تاريخ انتهاء بطاقة الرقم القومي" : "National ID Expiry"}
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
                    <span>{isAr ? "تاريخ الفيش والتشبيه" : "Criminal Record Date"}</span>
                    <span className="text-[10px] text-slate-400">{isAr ? "صلاحية 3 أشهر" : "Valid for 3 months"}</span>
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
                    {isAr ? "الموقف من التجنيد" : "Military Status"}
                  </label>
                  <select
                    value={formData.militaryStatus || MILITARY_STATUS_OPTIONS[0]}
                    onChange={e => setFormData({ ...formData, militaryStatus: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-medium text-sm"
                  >
                    {MILITARY_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {isAr ? opt : (MILITARY_STATUS_EN_MAP[opt] || opt)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Annual Contract End Date */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>{isAr ? "تاريخ انتهاء العقد السنوي" : "Contract End Date"}</span>
                    <span className="text-[10px] text-indigo-500 font-bold">
                      {isAr ? "تنبيه قبل 30 يوماً من التجديد" : "Alert 30 days before renewal"}
                    </span>
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
                    <span>{isAr ? "البيانات البنكية وتحويلات الراتب والمحافظ" : "Banking & Salary Transfers"}</span>
                  </h4>
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "اسم البنك" : "Bank Name"}
                  </label>
                  <input
                    type="text"
                    value={formData.bankName || ""}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder={isAr ? "مثال: البنك الأهلي المصري / بنك مصر / CIB" : "e.g. National Bank of Egypt / CIB"}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Bank Account / IBAN */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "رقم الحساب / الآيبان (IBAN)" : "Account # / IBAN"}
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
                    {isAr ? "عنوان انستاباي أو محفظة كاش" : "InstaPay / Mobile Wallet"}
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
                    <span>{isAr ? "جهة الاتصال للطوارئ" : "Emergency Contact"}</span>
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "اسم شخص للطوارئ" : "Contact Name"}
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactName || ""}
                    onChange={e => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    placeholder={isAr ? "الاسم صلة قرابة أولى" : "Full name of contact"}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    {isAr ? "هاتف الطوارئ" : "Emergency Phone"}
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
                    {isAr ? "صلة القرابة" : "Relationship"}
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactRelation || ""}
                    onChange={e => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                    placeholder={isAr ? "مثال: الوالد / الزوجة / الأخ" : "e.g. Father, Spouse, Brother"}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Employee Portrait Photo (4x6) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>{isAr ? "الصورة الشخصية 4×6" : "Personal Photo 4×6"}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                      {isAr ? "⚡ ضغط فوري" : "⚡ Instant Compressed"}
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl hover:bg-indigo-100/50 transition active:scale-[0.99]">
                      {isUploadingPhoto ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <Camera size={18} className="text-indigo-600 dark:text-indigo-400" />}
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                        {isUploadingPhoto
                          ? (isAr ? "جاري المعالجة..." : "Processing...")
                          : formData.photoUrl
                            ? (isAr ? "تغيير الصورة الشخصية" : "Change Photo 4×6")
                            : (isAr ? "رفع / التقاط صورة 4×6" : "Upload / Capture 4×6")}
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
                          title={isAr ? "حذف الصورة" : "Remove Photo"}
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
                    <span>{isAr ? "صورة بطاقة الرقم القومي" : "National ID Card"}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                      {isAr ? "⚡ ضغط فوري" : "⚡ Instant Compressed"}
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/20 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-[0.99]">
                      {isUploadingID ? <Loader2 className="animate-spin text-indigo-500" size={18} /> : <Upload size={18} className="text-slate-600 dark:text-slate-300" />}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {isUploadingID
                          ? (isAr ? "جاري المعالجة..." : "Processing...")
                          : formData.nationalIdPhotoUrl
                            ? (isAr ? "تغيير صورة البطاقة" : "Change Scanned ID")
                            : (isAr ? "رفع / مسح البطاقة" : "Upload / Scan ID")}
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
                          title={isAr ? "حذف صورة البطاقة" : "Remove ID Photo"}
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
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                  <span>{isAr ? "حفظ بيانات الموظف" : "Save Employee"}</span>
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
                    {isAr ? "إصدار إقرار مخالصة وإخلاء طرف قانوني" : "Issue Legal Discharge & Exit Clearance"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isAr
                      ? "إقرار إبراء ذمة واستلام المستحقات والتصفية المالية وفقاً لأحكام قانون العمل المصري"
                      : "Official Egyptian Labor Law compliant Discharge, Liabilities Release & Job Clearance"}
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
                  {isAr ? "الرقم القومي: " : "ID: "}
                  {terminationEmp.nationalId || (isAr ? "غير مسجل" : "No National ID")} • {terminationEmp.position} • {isAr ? "الفرع: " : "Branch: "}
                  {terminationEmp.storeId || currentBranch}
                </p>
              </div>
              <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-lg uppercase">
                {isAr ? "إخلاء طرف" : "Exit Clearance"}
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    {isAr ? "تاريخ ترك العمل" : "Termination / Exit Date"}
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
                    {isAr ? "سبب انتهاء العمل" : "Exit Reason"}
                  </label>
                  <select
                    value={terminationData.reason}
                    onChange={e => setTerminationData({ ...terminationData, reason: e.target.value })}
                    className="w-full p-3 bg-slate-100 dark:bg-black/20 border border-transparent focus:border-rose-500 rounded-xl font-bold text-sm outline-none cursor-pointer"
                  >
                    <option value="استقالة اختيارية برغبة العامل الصريحة">
                      {isAr ? "استقالة اختيارية برغبة العامل الصريحة" : "Voluntary Resignation (استقالة اختيارية)"}
                    </option>
                    <option value="انتهاء مدة عقد العمل المحدد دون تجديد">
                      {isAr ? "انتهاء مدة عقد العمل المحدد دون تجديد" : "Fixed-Term Contract Expiration (انتهاء مدة العقد)"}
                    </option>
                    <option value="إنهاء علاقة العمل بالتراضي والاتفاق المشترك">
                      {isAr ? "إنهاء علاقة العمل بالتراضي والاتفاق المشترك" : "Mutual Consent Termination (إنهاء بالتراضي)"}
                    </option>
                    <option value="ترك العمل بناءً على طلبه لظروف خاصة">
                      {isAr ? "ترك العمل بناءً على طلبه لظروف خاصة" : "Personal Circumstances (ترك العمل لظروف خاصة)"}
                    </option>
                    <option value="عدم اجتياز فترة الاختبار بنجاح">
                      {isAr ? "عدم اجتياز فترة الاختبار بنجاح" : "Probation Period Non-Pass (فترة الاختبار)"}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    {isAr ? "صافي مبلغ التصفية المالية المستلم (ج.م)" : "Net Financial Settlement Amount (EGP)"}
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
                      ? (isAr ? numberToArabicWords(terminationData.settlementAmount) : `${terminationData.settlementAmount.toLocaleString()} EGP`)
                      : (isAr ? "تم استلام كافة المستحقات بالكامل حتى تاريخه" : "All entitlements settled in full to date")}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    {isAr ? "مقابل رصيد الإجازات المستحقة (ج.م)" : "Accrued Leave Compensation (EGP)"}
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
                      ? (isAr ? numberToArabicWords(terminationData.leaveCompensation) : `${terminationData.leaveCompensation.toLocaleString()} EGP`)
                      : (isAr ? "تم استنفاد الإجازات بالكامل أو متضمنة بالتصفية" : "All leaves consumed or included in settlement")}
                  </p>
                </div>
              </div>

              {/* Custody & Clearances Verification Box */}
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle size={16} />
                  <span>{isAr ? "شروط المخالصة وإبراء الذمة القانونية (قانون العمل المصري)" : "Discharge & Legal Clearance Terms (Egyptian Labor Law)"}</span>
                </div>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={terminationData.paidInFull}
                      onChange={e => setTerminationData({ ...terminationData, paidInFull: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>
                      {isAr
                        ? "إقرار العامل باستلام كامل الأجور والبدلات والإضافي ومكافأة نهاية الخدمة (لا يطلب المنشأة بأي شيء)"
                        : "Employee acknowledges full receipt of wages, allowances, overtime, and benefits (no outstanding claims)"}
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={terminationData.custodyCleared}
                      onChange={e => setTerminationData({ ...terminationData, custodyCleared: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>
                      {isAr
                        ? "تسليم كافة العهد: عهدة نقدية، مفاتيح الفرع والخزينة، الزي الرسمي، وبطاقات التشغيل (المنشأة بريئة الذمة)"
                        : "Full handover of company custody: petty cash, branch keys, uniforms, and access cards (fully cleared)"}
                    </span>
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
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handlePrintTermination(terminationEmp)}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                <Printer size={18} />
                <span>{isAr ? "طباعة وثيقة المخالصة الرسمية" : "Print Official Clearance"}</span>
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
              margin: ${printDocumentType === 'termination' ? '8mm 12mm 8mm 12mm !important' : printDocumentType === 'folder_cover' ? '8mm 10mm 8mm 10mm !important' : (printDocumentType === 'salary_letter' || printDocumentType === 'experience_cert' || printDocumentType === 'bank_mandate' || printDocumentType === 'social_insurance_1' || printDocumentType === 'social_insurance_6' || printDocumentType === 'loan_contract' || printDocumentType === 'loan_receipt') ? '6mm 9mm 6mm 9mm !important' : '15mm'}; 
            }
            .content-wrapper { padding: 0; margin: 0 auto; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            ${printDocumentType === 'termination' || printDocumentType === 'folder_cover' || printDocumentType === 'salary_letter' || printDocumentType === 'experience_cert' || printDocumentType === 'bank_mandate' || printDocumentType === 'social_insurance_1' || printDocumentType === 'social_insurance_6' || printDocumentType === 'loan_contract' || printDocumentType === 'loan_receipt' ? `
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
              .termination-page, .folder-cover-page, .salary-letter-page, .experience-cert-page, .bank-mandate-page, .social-insurance-page-1, .social-insurance-page-6, .loan-contract-page, .loan-receipt-page {
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
            const net = Number(selectedEmployee.baseSalary || (selectedEmployee as any).salary || 0);
            const insurance = Number(selectedEmployee.insurance || 0);
            const gross = insurance > 0 ? (net + insurance) : net;
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
                          {net.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", color: "#475569" }}>الأجر الأساسي الصافي المنصوص عليه بسجلات شؤون العاملين</td>
                      </tr>
                      {insurance > 0 && (
                        <>
                          <tr style={{ background: "#f1f5f9" }}>
                            <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", fontWeight: "900", color: "#0f172a" }}>إجمالي الأجر التأميني الشامل (Gross Salary):</td>
                            <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12.5px", color: "#0f172a" }}>
                              {gross.toLocaleString()} ج.م
                            </td>
                            <td style={{ border: "1px solid #94a3b8", padding: "6px 10px", fontWeight: "bold", color: "#0f172a" }}>الأجر الشامل مضافاً إليه حصة التأمينات الاجتماعية</td>
                          </tr>
                          <tr>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", fontWeight: "bold", color: "#b91c1c", background: "#fef2f2" }}>استقطاع التأمينات الاجتماعية (س1):</td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "12px", color: "#b91c1c" }}>
                              ({insurance.toLocaleString()}) ج.م
                            </td>
                            <td style={{ border: "1px solid #cbd5e1", padding: "6px 10px", color: "#b91c1c" }}>حصة العامل في التأمين الاجتماعي المصري المسددة</td>
                          </tr>
                        </>
                      )}
                      <tr style={{ background: "#ecfdf5" }}>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", fontWeight: "900", fontSize: "12px", color: "#047857" }}>صافي الراتب الشهري المنصرف (Net Salary):</td>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", textAlign: "center", fontFamily: "monospace", fontWeight: "900", fontSize: "14px", color: "#047857" }}>
                          {net.toLocaleString()} ج.م
                        </td>
                        <td style={{ border: "2px solid #059669", padding: "8px 10px", fontWeight: "bold", color: "#047857" }}>صافي ما يتقاضاه العامل شهرياً دون أي استقطاع</td>
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
                    <span style={{ textDecoration: "underline" }}>{netWords} جنيهاً مصرياً</span>
                    <span> لا غير، يتم صرفها بالكامل وبانتظام بنهاية كل شهر ميلادي.</span>
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

          // IF PRINTING SOCIAL INSURANCE FORM 1 (استمارة 1 تأمينات اجتماعية - طلب اشتراك مؤمن عليه)
          if (printDocumentType === 'social_insurance_1') {
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const nidChars = (selectedEmployee.nationalId || "").padEnd(14, " ").slice(0, 14).split("");
            const comprehensiveWage = (selectedEmployee.baseSalary || 0) + (selectedEmployee.insurance || 0);

            return (
              <div
                className="content-wrapper social-insurance-page-1"
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
                {/* 1. GOVERNMENT & OFFICIAL AUTHORITY HEADER */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1.8fr 1.4fr",
                    gap: "8px",
                    alignItems: "center",
                    borderBottom: "2.5px solid #0f172a",
                    paddingBottom: "6px",
                    marginBottom: "8px"
                  }}>
                    {/* Right: State & Ministry */}
                    <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                      <div style={{ fontWeight: "900", fontSize: "11px" }}>جمهورية مصر العربية</div>
                      <div>وزارة التضامن الاجتماعي</div>
                      <div style={{ fontWeight: "bold" }}>الهيئة القومية للتأمين الاجتماعي</div>
                      <div style={{ fontSize: "9px", color: "#475569" }}>صندوق العاملين بقطاع الأعمال العام والخاص</div>
                    </div>

                    {/* Center: Form Title Badge */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        border: "2px solid #0f172a",
                        borderRadius: "8px",
                        padding: "4px 10px",
                        background: "#f8fafc"
                      }}>
                        <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                          استمارة رقم (1) تأمينات اجتماعية
                        </div>
                        <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#334155" }}>
                          طلب اشتراك مؤمن عليه (قطاع خاص)
                        </div>
                        <div style={{ fontSize: "8px", color: "#64748b", marginTop: "1px" }}>
                          طبقاً لأحكام قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019
                        </div>
                      </div>
                    </div>

                    {/* Left: Office & Codes */}
                    <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>المكتب المختص:</strong> {branchInfo.socialInsuranceOffice}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم المنشأة:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{branchInfo.companyInsuranceNumber}</span></div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>كود القطاع:</strong> 3 (قطاع خاص)</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>التاريخ:</strong> {todayFormatted}</div>
                    </div>
                  </div>

                  {/* 2. SECTION 1: EMPLOYER / FACILITY DETAILS (بيانات صاحب العمل والمنشأة) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>أولاً: بيانات صاحب العمل والمنشأة (القطاع الخاص)</span>
                      <span>رمز النشاط: تجارة التجزئة والمواد الغذائية</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم المنشأة القانوني:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "42%", fontWeight: "bold", color: "#0f172a" }}>{companyTitleAr} ({companySubtitleEn})</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>الرقم التأميني للمنشأة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "22%", fontFamily: "monospace", fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{branchInfo.companyInsuranceNumber}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>رقم السجل التجاري:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>{branchInfo.commReg}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>رقم البطاقة الضريبية:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>{branchInfo.taxId}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>عنوان موقع العمل / الفرع:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>{branchInfo.storeAddress} ({branchTitleAr})</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. SECTION 2: INSURED EMPLOYEE DETAILS (بيانات المؤمن عليه) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#1e3a8a",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثانياً: بيانات المؤمن عليه (العامل)</span>
                      <span>وفقاً لبطاقة الرقم القومي سارية المفعول</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم المؤمن عليه رباعياً:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11px" }}>{selectedEmployee.name}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>الرقم التأميني للعامل:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "22%", fontFamily: "monospace", fontWeight: "bold" }}>
                            {selectedEmployee.socialInsuranceNumber || "طلب استخراج رقم تأميني جديد"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                              {nidChars.map((ch, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: "inline-block",
                                    width: "20px",
                                    height: "22px",
                                    border: "1.5px solid #475569",
                                    borderRadius: "3px",
                                    textAlign: "center",
                                    lineHeight: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    fontFamily: "monospace",
                                    background: "#fff"
                                  }}
                                >
                                  {ch.trim() || "-"}
                                </span>
                              ))}
                              <span style={{ fontSize: "9px", color: "#64748b", marginRight: "8px" }}>(من واقع بطاقة الرقم القومي)</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>تاريخ ومحل الميلاد:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>{selectedEmployee.birthDate || "-"} — جمهورية مصر العربية</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الجنس والجنسية:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>{selectedEmployee.gender === 'female' ? 'أنثى' : 'ذكر'} — مصري الجنسية</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>المهنة والوظيفة المثبتة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontWeight: "bold", color: "#0f172a" }}>{selectedEmployee.position}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>تاريخ بدء العمل الفعلي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>{selectedEmployee.startDate || "محدد بالعقد"}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>محل إقامة المؤمن عليه:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>{selectedEmployee.address || "مدون بالبطاقة القومية"} — هاتف: {selectedEmployee.phone || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. SECTION 3: WAGE & CONTRIBUTION BRACKETS (بيانات الأجر واشتراك التأمين) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#047857",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثالثاً: بيانات أجور الاشتراك التأميني (جنيه مصري)</span>
                      <span>وفقاً للحد الأدنى والأقصى لأجر الاشتراك بقانون 148 لسنة 2019</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", textAlign: "center", fontWeight: "bold" }}>
                          <th style={{ border: "1px solid #cbd5e1", padding: "4px" }}>أجر الاشتراك الشهري</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "4px" }}>الأجر الشامل التعاقدي</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "4px" }}>حصة المؤمن عليه (11%)</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "4px" }}>حصة المنشأة (18.75%)</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "4px" }}>إجمالي الاشتراك التأميني (29.75%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ textAlign: "center", fontFamily: "monospace", fontSize: "11px", fontWeight: "bold" }}>
                          <td style={{ border: "1px solid #cbd5e1", padding: "5px", color: "#0f172a" }}>{(selectedEmployee.baseSalary || 0).toLocaleString()} ج.م</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "5px", color: "#047857" }}>{comprehensiveWage.toLocaleString()} ج.م</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "5px", color: "#b91c1c" }}>{(selectedEmployee.insurance || 0).toLocaleString()} ج.م</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "5px", color: "#1e3a8a" }}>{Math.round((selectedEmployee.baseSalary || 0) * 0.1875).toLocaleString()} ج.م</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "5px", color: "#0f172a", background: "#ecfdf5" }}>
                            {Math.round((selectedEmployee.baseSalary || 0) * 0.2975).toLocaleString()} ج.م
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 5. STATUTORY DECLARATIONS (إقرار العامل وصاحب العمل) */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "9.5px",
                    lineHeight: "1.5",
                    marginBottom: "8px"
                  }}>
                    {/* Employee declaration */}
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", background: "#f8fafc" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a", borderBottom: "1px dashed #cbd5e1", paddingBottom: "2px", marginBottom: "4px" }}>
                        إقرار المؤمن عليه (العامل):
                      </div>
                      <div>
                        أقر أنا الموقع أدناه بصحة كافة البيانات الواردة بهذه الاستمارة وبأنني التحقت بالعمل لدى المنشأة المذكورة في التاريخ الموضح بعاليه، وأتعهد بإخطار الهيئة بأي تعديل يطرأ على حالتي.
                      </div>
                      <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between" }}>
                        <span>اسم العامل: <strong>{selectedEmployee.name}</strong></span>
                        <span>التوقيع: ............................</span>
                      </div>
                    </div>

                    {/* Employer declaration */}
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", background: "#f8fafc" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a", borderBottom: "1px dashed #cbd5e1", paddingBottom: "2px", marginBottom: "4px" }}>
                        إقرار صاحب العمل / المنشأة:
                      </div>
                      <div>
                        تقر شركة <strong>{companyTitleAr}</strong> بصحة بيانات العامل الموضح بعاليه وأنه يعمل بالمنشأة تحت إشرافها وإدارتها وتلتزم المنشأة بسداد الاشتراكات المستحقة وفقاً لأحكام القانون رقم 148 لسنة 2019.
                      </div>
                      <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between" }}>
                        <span>صفة الموقع: <strong>المدير المسؤول</strong></span>
                        <span>التوقيع: ............................</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. SIGNATURES, OFFICIAL STAMP & SOCIAL INSURANCE OFFICE AUDIT */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr 1.7fr",
                    gap: "8px",
                    alignItems: "center",
                    borderTop: "2px solid #0f172a",
                    paddingTop: "6px",
                    marginBottom: "6px"
                  }}>
                    {/* Employer Signatures */}
                    <div style={{ textAlign: "center", fontSize: "9.5px" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>مسؤول شؤون العاملين والرواتب:</div>
                      <div style={{ color: "#64748b", margin: "2px 0 20px 0" }}>إدارة الموارد البشرية (HR)</div>
                      <div>التوقيع والاعتماد: ............................</div>
                    </div>

                    {/* OFFICIAL OLA / ANH STAMP */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{
                        width: "135px",
                        height: "78px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "4px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        boxShadow: "inset 0 0 0 1px #1e3a8a"
                      }}>
                        <div style={{ fontSize: "10.5px", fontWeight: "900", lineHeight: "1.2" }}>{companyTitleAr}</div>
                        <div style={{ fontSize: "8px", fontWeight: "800", textTransform: "uppercase" }}>{companySubtitleEn}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace", marginTop: "2px" }}>س.ت : {branchInfo.commReg}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace" }}>ب.ض : {branchInfo.taxId}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace" }}>تأمين : {branchInfo.companyInsuranceNumber}</div>
                      </div>
                    </div>

                    {/* Authority Official Receipt Box (خاص باعتماد مكتب التأمينات الاجتماعية) */}
                    <div style={{
                      border: "1.5px dashed #475569",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "8.5px",
                      lineHeight: "1.4",
                      background: "#f1f5f9"
                    }}>
                      <div style={{ fontWeight: "bold", textAlign: "center", color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "3px" }}>
                        خاص بمكتب التأمينات الاجتماعية (للاستعمال الرسمي)
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>رقم الوارد: ............................</span>
                        <span>تاريخ الورود: .... / .... / 2026</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                        <span>توقيع المراجع: .......................</span>
                        <span>توقيع مدير المكتب: ...................</span>
                      </div>
                      <div style={{ textAlign: "center", color: "#64748b", marginTop: "3px", fontSize: "7.5px" }}>
                        (خاتم شعار الجمهورية / مكتب التأمينات الاجتماعية المختص)
                      </div>
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "2px",
                    fontSize: "8px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>استمارة 1 تأمينات - نظام إدارة الموارد البشرية المعتمد لشركة {companyTitleAr}</span>
                    <span>سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId} | رقم تأميني: {branchInfo.companyInsuranceNumber}</span>
                  </div>
                </div>
              </div>
            );
          }

          // IF PRINTING SOCIAL INSURANCE FORM 6 (استمارة 6 تأمينات اجتماعية - إخطار انتهاء خدمة مؤمن عليه)
          if (printDocumentType === 'social_insurance_6') {
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const nidChars = (selectedEmployee.nationalId || "").padEnd(14, " ").slice(0, 14).split("");
            const exitDateFormatted = terminationData?.terminationDate || selectedEmployee.contractEndDate || new Date().toISOString().split("T")[0];

            return (
              <div
                className="content-wrapper social-insurance-page-6"
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
                {/* 1. GOVERNMENT & OFFICIAL AUTHORITY HEADER */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1.8fr 1.4fr",
                    gap: "8px",
                    alignItems: "center",
                    borderBottom: "2.5px solid #0f172a",
                    paddingBottom: "6px",
                    marginBottom: "8px"
                  }}>
                    {/* Right: State & Ministry */}
                    <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                      <div style={{ fontWeight: "900", fontSize: "11px" }}>جمهورية مصر العربية</div>
                      <div>وزارة التضامن الاجتماعي</div>
                      <div style={{ fontWeight: "bold" }}>الهيئة القومية للتأمين الاجتماعي</div>
                      <div style={{ fontSize: "9px", color: "#475569" }}>صندوق العاملين بقطاع الأعمال العام والخاص</div>
                    </div>

                    {/* Center: Form Title Badge */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        border: "2px solid #b91c1c",
                        borderRadius: "8px",
                        padding: "4px 10px",
                        background: "#fef2f2"
                      }}>
                        <div style={{ fontSize: "14px", fontWeight: "900", color: "#b91c1c" }}>
                          استمارة رقم (6) تأمينات اجتماعية
                        </div>
                        <div style={{ fontSize: "10.5px", fontWeight: "bold", color: "#334155" }}>
                          إخطار انتهاء خدمة مؤمن عليه (قطاع خاص)
                        </div>
                        <div style={{ fontSize: "8px", color: "#64748b", marginTop: "1px" }}>
                          طبقاً لأحكام قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019 وقانون العمل 12 لسنة 2003
                        </div>
                      </div>
                    </div>

                    {/* Left: Office & Codes */}
                    <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>المكتب المختص:</strong> {branchInfo.socialInsuranceOffice}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم المنشأة:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{branchInfo.companyInsuranceNumber}</span></div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>كود الشطب:</strong> إنهاء خدمة</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>التاريخ:</strong> {todayFormatted}</div>
                    </div>
                  </div>

                  {/* 2. SECTION 1: EMPLOYER / FACILITY DETAILS (بيانات صاحب العمل والمنشأة) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>أولاً: بيانات المنشأة وصاحب العمل</span>
                      <span>قطاع خاص — كود رقم: 3</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم المنشأة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "42%", fontWeight: "bold", color: "#0f172a" }}>{companyTitleAr} ({companySubtitleEn})</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>الرقم التأميني للمنشأة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "22%", fontFamily: "monospace", fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>{branchInfo.companyInsuranceNumber}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>السجل التجاري:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>{branchInfo.commReg}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>البطاقة الضريبية:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>{branchInfo.taxId}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>مقر العمل التابع له:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>{branchInfo.storeAddress} ({branchTitleAr})</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. SECTION 2: INSURED EMPLOYEE DETAILS (بيانات المؤمن عليه المنهي خدمته) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#b91c1c",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثانياً: بيانات المؤمن عليه المطلوب شطب اشتراكه</span>
                      <span>سجلات العاملين بالقطاع الخاص</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم المؤمن عليه:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11px" }}>{selectedEmployee.name}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>الرقم التأميني:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "22%", fontFamily: "monospace", fontWeight: "bold" }}>
                            {selectedEmployee.socialInsuranceNumber || "مسجل بسجلات الهيئة"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                              {nidChars.map((ch, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: "inline-block",
                                    width: "20px",
                                    height: "22px",
                                    border: "1.5px solid #475569",
                                    borderRadius: "3px",
                                    textAlign: "center",
                                    lineHeight: "20px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    fontFamily: "monospace",
                                    background: "#fff"
                                  }}
                                >
                                  {ch.trim() || "-"}
                                </span>
                              ))}
                              <span style={{ fontSize: "9px", color: "#64748b", marginRight: "8px" }}>(مطابق لأصل بطاقة الرقم القومي)</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>المسمى والمهنة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontWeight: "bold" }}>{selectedEmployee.position}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>تاريخ بدء الاشتراك:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace" }}>{selectedEmployee.startDate || "تاريخ التعيين"}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#fee2e2", fontWeight: "900", color: "#991b1b" }}>تاريخ انتهاء الخدمة الفعلي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "900", color: "#b91c1c", fontSize: "11px" }}>
                            {exitDateFormatted}
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>آخر أجر اشتراك مسدد:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>
                            {(selectedEmployee.baseSalary || 0).toLocaleString()} ج.م
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. SECTION 3: STATUTORY REASON FOR TERMINATION (سبب انتهاء الخدمة وفقاً للقانون) */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{
                      background: "#334155",
                      color: "#fff",
                      fontSize: "10.5px",
                      fontWeight: "bold",
                      padding: "3px 8px",
                      borderRadius: "4px 4px 0 0"
                    }}>
                      ثالثاً: سبب انتهاء الخدمة ومسوغات الشطب التأميني
                    </div>
                    <div style={{
                      border: "1px solid #cbd5e1",
                      borderTop: "none",
                      padding: "8px 12px",
                      background: "#f8fafc",
                      fontSize: "10px",
                      lineHeight: "1.8"
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        <div>
                          <strong>[  {terminationData?.reason === 'resignation' ? 'X' : ' '}  ]</strong> 1. الاستقالة الصريحة برغبة العامل كتابياً (مادة 119 قانون 12 لسنة 2003).
                        </div>
                        <div>
                          <strong>[  {terminationData?.reason === 'contract_end' || (!terminationData && selectedEmployee.contractEndDate) ? 'X' : ' '}  ]</strong> 2. انتهاء مدة عقد العمل محدد المدة دون تجديده (مادة 104 قانون 12).
                        </div>
                        <div>
                          <strong>[  {terminationData?.reason === 'probation_fail' ? 'X' : ' '}  ]</strong> 3. عدم اجتياز فترة الاختبار بنجاح (المادة 32 من قانون العمل 12 لسنة 2003).
                        </div>
                        <div>
                          <strong>[  {terminationData?.reason === 'mutual_agreement' ? 'X' : ' '}  ]</strong> 4. إنهاء التعاقد بالاتفاق والتراضي وخلو الطرف التام.
                        </div>
                        <div>
                          <strong>[  {terminationData?.reason === 'job_abandonment' ? 'X' : ' '}  ]</strong> 5. الانقطاع عن العمل دون مسوغ مشروع مع استيفاء الإنذارات القانونية.
                        </div>
                        <div>
                          <strong>[  {terminationData?.reason === 'other' ? 'X' : ' '}  ]</strong> 6. أسباب قانونية أخرى / بلوغ السن القانونية للمعاش.
                        </div>
                      </div>
                      {terminationData?.notes && (
                        <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: "4px" }}>
                          <strong>ملاحظات المنشأة:</strong> {terminationData.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. STATUTORY UNDERTAKING & CLEARANCE */}
                  <div style={{
                    fontSize: "9.5px",
                    lineHeight: "1.6",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    marginBottom: "8px",
                    color: "#991b1b"
                  }}>
                    <strong>إقرار المنشأة وصاحب العمل:</strong>
                    <br />
                    تقر شركة <strong>{companyTitleAr}</strong> بأن العامل المذكور قد انتهت علاقته التعاقدية بالمنشأة اعتباراً من تاريخ <strong>{exitDateFormatted}</strong> للأسباب المبينة بعاليه، وتتعهد المنشأة بسداد كافة الاشتراكات والمبالغ التأمينية المستحقة عن فترة خدمته وحتى تاريخ شطبه طبقاً لأحكام القانون رقم 148 لسنة 2019.
                  </div>
                </div>

                {/* 6. SIGNATURES, OFFICIAL STAMP & SOCIAL INSURANCE OFFICE AUDIT */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1fr 1.7fr",
                    gap: "8px",
                    alignItems: "center",
                    borderTop: "2px solid #0f172a",
                    paddingTop: "6px",
                    marginBottom: "6px"
                  }}>
                    {/* Employer Signatures */}
                    <div style={{ textAlign: "center", fontSize: "9.5px" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>المدير العام / المسؤول:</div>
                      <div style={{ color: "#64748b", margin: "2px 0 20px 0" }}>المفوض عن إدارة المنشأة</div>
                      <div>التوقيع والاعتماد: ............................</div>
                    </div>

                    {/* OFFICIAL OLA / ANH STAMP */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{
                        width: "135px",
                        height: "78px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "4px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a",
                        boxShadow: "inset 0 0 0 1px #1e3a8a"
                      }}>
                        <div style={{ fontSize: "10.5px", fontWeight: "900", lineHeight: "1.2" }}>{companyTitleAr}</div>
                        <div style={{ fontSize: "8px", fontWeight: "800", textTransform: "uppercase" }}>{companySubtitleEn}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace", marginTop: "2px" }}>س.ت : {branchInfo.commReg}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace" }}>ب.ض : {branchInfo.taxId}</div>
                        <div style={{ fontSize: "7.5px", fontWeight: "bold", fontFamily: "monospace" }}>تأمين : {branchInfo.companyInsuranceNumber}</div>
                      </div>
                    </div>

                    {/* Authority Official Receipt Box (خاص باعتماد مكتب التأمينات الاجتماعية) */}
                    <div style={{
                      border: "1.5px dashed #475569",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "8.5px",
                      lineHeight: "1.4",
                      background: "#f1f5f9"
                    }}>
                      <div style={{ fontWeight: "bold", textAlign: "center", color: "#0f172a", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px", marginBottom: "3px" }}>
                        خاص بمكتب التأمينات الاجتماعية (للاستعمال الرسمي)
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>رقم وارد الشطب: ....................</span>
                        <span>تاريخ الورود: .... / .... / 2026</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                        <span>توقيع مراجع الشطب: ..............</span>
                        <span>توقيع مدير المكتب: ..................</span>
                      </div>
                      <div style={{ textAlign: "center", color: "#64748b", marginTop: "3px", fontSize: "7.5px" }}>
                        (خاتم شعار الجمهورية / شطب المؤمن عليه من سجلات المنشأة)
                      </div>
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "2px",
                    fontSize: "8px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>استمارة 6 تأمينات - نظام إدارة الموارد البشرية المعتمد لشركة {companyTitleAr}</span>
                    <span>سجل تجاري: {branchInfo.commReg} | بطاقة ضريبية: {branchInfo.taxId} | رقم تأميني: {branchInfo.companyInsuranceNumber}</span>
                  </div>
                </div>
              </div>
            );
          }

          // IF PRINTING 100% LEGAL EGYPTIAN LOAN CONTRACT & DEDUCTION AUTHORIZATION (إقرار استلام سلفة وتفويض بالخصم)
          if (printDocumentType === 'loan_contract') {
            const loan = selectedLoanForPrint || (empLoans && empLoans[0]) || {};
            const loanAmt = Number(loan.amount || loan.approved || 0);
            const instCount = Number(loan.installmentCount || 1);
            const monthlyInst = Number(loan.monthlyInstallment || Math.round(loanAmt / instCount));
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
            const nidChars = (selectedEmployee.nationalId || "").padEnd(14, " ").slice(0, 14).split("");

            // Build or retrieve installments list
            const installmentsList = Array.isArray(loan.installments) && loan.installments.length > 0 
              ? loan.installments 
              : (() => {
                  const arr = [];
                  const sD = new Date(loan.date || Date.now());
                  for (let i = 0; i < instCount; i++) {
                    const mD = new Date(sD.getFullYear(), sD.getMonth() + i, 1);
                    const mStr = `${mD.getFullYear()}-${String(mD.getMonth() + 1).padStart(2, "0")}`;
                    const isLast = i === instCount - 1;
                    arr.push({
                      installmentNumber: i + 1,
                      month: mStr,
                      amount: isLast ? (loanAmt - (monthlyInst * (instCount - 1))) : monthlyInst,
                      status: "pending"
                    });
                  }
                  return arr;
                })();

            let runningBalance = loanAmt;

            return (
              <div
                className="content-wrapper loan-contract-page"
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
                  padding: "5mm 8mm",
                  boxSizing: "border-box"
                }}
              >
                <div>
                  {/* 1. OFFICIAL CORPORATE & LEGAL HEADER */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 2fr 1.4fr",
                    gap: "8px",
                    alignItems: "center",
                    borderBottom: "2.5px solid #0f172a",
                    paddingBottom: "5px",
                    marginBottom: "7px"
                  }}>
                    {/* Right: Company Identity */}
                    <div style={{ textAlign: "right", fontSize: "10px", lineHeight: "1.4", color: "#1e293b" }}>
                      <div style={{ fontWeight: "900", fontSize: "12px" }}>{companyTitleAr}</div>
                      <div style={{ fontSize: "8.5px", fontWeight: "700", textTransform: "uppercase", color: "#475569" }}>{companySubtitleEn}</div>
                      <div style={{ fontSize: "9px", fontFamily: "monospace", marginTop: "1px" }}>س.ت: {branchInfo.commReg} | ب.ض: {branchInfo.taxId}</div>
                      <div style={{ fontSize: "8.5px", color: "#64748b" }}>قطاع التجزئة والمتاجر - إدارة الموارد البشرية</div>
                    </div>

                    {/* Center: Official Legal Agreement Badge */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        border: "2px solid #0f172a",
                        borderRadius: "8px",
                        padding: "4px 10px",
                        background: "#f8fafc"
                      }}>
                        <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#0f172a" }}>
                          إقرار استلام سلفة نقدية وتفويض رسمي بالاستقطاع من الراتب
                        </div>
                        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#047857" }}>
                          سلفة قرض حسن بدون فوائد • تفويض قانوني ملزم ونافذ
                        </div>
                        <div style={{ fontSize: "8px", color: "#475569", marginTop: "1px" }}>
                          طبقاً لأحكام المادة (34) من قانون العمل المصري رقم 12 لسنة 2003
                        </div>
                      </div>
                    </div>

                    {/* Left: Metadata & Branch Details */}
                    <div style={{ textAlign: "left", fontSize: "9.5px", lineHeight: "1.5", color: "#1e293b", fontFamily: "monospace" }}>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>رقم السلفة:</strong> <span style={{ fontWeight: "bold", color: "#1e3a8a", fontSize: "11px" }}>LN-{(loan.id || "NEW").slice(-6).toUpperCase()}</span></div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>تاريخ التحرير:</strong> {todayFormatted}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>الفرع:</strong> {branchTitleAr}</div>
                      <div><strong style={{ fontFamily: "'Cairo', sans-serif" }}>جهة الصرف:</strong> خزينة الفرع (Safe)</div>
                    </div>
                  </div>

                  {/* 2. SECTION 1: EMPLOYEE & EMPLOYER IDENTIFICATION */}
                  <div style={{ marginBottom: "6px" }}>
                    <div style={{
                      background: "#0f172a",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "2.5px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>أولاً: بيانات العامل المقترض والجهة المانحة</span>
                      <span>عقد ملزم للطرفين</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>اسم العامل المقترض:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "42%", fontWeight: "900", color: "#0f172a", fontSize: "11px" }}>{selectedEmployee.name}</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "18%", background: "#f1f5f9", fontWeight: "bold" }}>المسمى الوظيفي:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", width: "22%", fontWeight: "bold" }}>{selectedEmployee.position}</td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الرقم القومي (14 رقم):</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "2.5px" }}>
                              {nidChars.map((ch, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: "inline-block",
                                    width: "18px",
                                    height: "19px",
                                    border: "1.5px solid #475569",
                                    borderRadius: "3px",
                                    textAlign: "center",
                                    lineHeight: "17px",
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    fontFamily: "monospace",
                                    background: "#fff"
                                  }}
                                >
                                  {ch.trim() || "-"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الراتب الأساسي الشهري:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                            {(selectedEmployee.baseSalary || 0).toLocaleString()} ج.م
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>الشركة المانحة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>{companyTitleAr} (س.ت: {branchInfo.commReg})</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px", background: "#f1f5f9", fontWeight: "bold" }}>مكان العمل والفرع:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "3.5px 6px" }}>{branchTitleAr}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 3. SECTION 2: LOAN FINANCIAL DETAILS & TAFQEET */}
                  <div style={{ marginBottom: "6px" }}>
                    <div style={{
                      background: "#047857",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "2.5px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثانياً: تفاصيل السلفة المعتمدة والتفقيط المالي القانوني</span>
                      <span>المبالغ بالجنيه المصري (EGP)</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", background: "#f8fafc" }}>
                      <tbody>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "20%", background: "#ecfdf5", fontWeight: "bold", color: "#065f46" }}>إجمالي مبلغ السلفة:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "30%", fontWeight: "900", fontSize: "12px", color: "#047857", fontFamily: "monospace" }}>
                            {loanAmt.toLocaleString()} ج.م
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "20%", background: "#f1f5f9", fontWeight: "bold" }}>مدة ونظام التقسيط:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", width: "30%", fontWeight: "bold" }}>
                            {instCount} قسط/أقساط شهرية متتالية
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>التفقيط المالي الرسمي:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontWeight: "bold", color: "#1e293b", fontSize: "10px" }}>
                            فقط وقدره: <strong style={{ color: "#047857" }}>{numberToArabicWords(loanAmt)} جنيهاً مصرياً لا غير</strong>.
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>قيمة القسط الشهري:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold", color: "#1e3a8a" }}>
                            {monthlyInst.toLocaleString()} ج.م شهرياً
                          </td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>تاريخ بدء أول قسط:</td>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", fontFamily: "monospace", fontWeight: "bold" }}>
                            راتب شهر: {loan.firstInstallmentMonth || loan.month || "-"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ border: "1px solid #cbd5e1", padding: "4px 6px", background: "#f1f5f9", fontWeight: "bold" }}>سبب وتصنيف السلفة:</td>
                          <td colSpan={3} style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}>
                            {loan.categoryLabel || loan.reason || "سلفة راتب نقدية معتمدة وفقاً لاحتياجات العامل"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. SECTION 3: ITEMIZED INSTALLMENT SCHEDULE GRID */}
                  <div style={{ marginBottom: "6px" }}>
                    <div style={{
                      background: "#334155",
                      color: "#fff",
                      fontSize: "9.5px",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: "4px 4px 0 0",
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>ثالثاً: جدول استحقاق واستقطاع الأقساط الشهرية من الراتب</span>
                      <span>سقف الخصم القانوني: لا يجاوز 50% من الأجر</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px", textAlign: "center" }}>
                      <thead>
                        <tr style={{ background: "#e2e8f0", color: "#1e293b", fontWeight: "bold" }}>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>القسط</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>شهر الاستحقاق</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>قيمة القسط الشهري</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>الرصيد المتبقي بعد الخصم</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>حالة القسط</th>
                          <th style={{ border: "1px solid #cbd5e1", padding: "3px" }}>توقيع العامل بالعلم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installmentsList.slice(0, 12).map((inst: any, idx: number) => {
                          runningBalance = Math.max(0, runningBalance - Number(inst.amount));
                          return (
                            <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontWeight: "bold", fontFamily: "monospace" }}>#{inst.installmentNumber || idx + 1}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace", fontWeight: "bold" }}>{inst.month}</td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace", fontWeight: "bold", color: "#047857" }}>
                                {Number(inst.amount).toLocaleString()} ج.م
                              </td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px", fontFamily: "monospace" }}>
                                {runningBalance.toLocaleString()} ج.م
                              </td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px" }}>
                                {inst.status === "paid" ? "تم الخصم بالراتب ✓" : "مجدول بالراتب"}
                              </td>
                              <td style={{ border: "1px solid #cbd5e1", padding: "3px", color: "#94a3b8" }}>..........................</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 5. SECTION 4: STATUTORY EGYPTIAN LABOR LAW UNDERTAKINGS */}
                  <div style={{
                    fontSize: "8.5px",
                    lineHeight: "1.55",
                    background: "#f8fafc",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "5px 8px",
                    marginBottom: "6px",
                    color: "#1e293b"
                  }}>
                    <strong style={{ color: "#0f172a", fontSize: "9px" }}>رابعاً: البنود القانونية والتفويض الإلزامي بالاستقطاع:</strong>
                    <ol style={{ margin: "2px 0 0 0", paddingRight: "16px" }}>
                      <li>
                        <strong>إقرار الاستلام:</strong> أقر أنا الموقع أدناه بأنني قد استلمت من إدارة الشركة كامل مبلغ السلفة الموضح بعاليه نقداً من خزينة الفرع على سبيل القرض الحسن دون أي فوائد، وتعد ذمتي مشغولة به قانوناً.
                      </li>
                      <li>
                        <strong>تفويض الخصم القانوني:</strong> أفوض إدارة الشركة تفويضاً رسمياً ونهائياً لا رجعة فيه باستقطاع قيمة القسط الشهري الموضح بالجدول من راتبي الشهري اعتباراً من شهر الاستحقاق وحتى تمام السداد، وذلك إعمالاً لنص المادة (34) من قانون العمل رقم 12 لسنة 2003.
                      </li>
                      <li>
                        <strong>تسوية نهاية الخدمة:</strong> في حال انتهاء علاقة العمل لأي سبب من الأسباب (استقالة، فسخ، انتهاء العقد، أو ترك العمل) قبل إتمام سداد كامل السلفة، فإنني أفوض الشركة تفويضاً صريحاً باستقطاع كامل الرصيد المتبقي ذمتي دفعة واحدة من أي مستحقات نهائية لي طرف الشركة (مكافأة نهاية الخدمة، رصيد الإجازات، أجر آخر شهر، أو أي مستحقات أخرى). وفي حال عدم كفايتها أتعهد بسداد المتبقي نقداً فوراً.
                      </li>
                      <li>
                        <strong>الحجية القضائية:</strong> تم تحرير هذا الإقرار بمحض إرادتي الحرة ودون أي إكراه، ويعد حجة قانونية نافذة وقاطعة في مواجهتي ومسؤوليتي المدنية والقضائية الكاملة أمام كافة الجهات الرسمية.
                      </li>
                    </ol>
                  </div>
                </div>

                {/* 6. SIGNATURES & THUMBPRINT BLOCK */}
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                    gap: "6px",
                    alignItems: "center",
                    borderTop: "2px solid #0f172a",
                    paddingTop: "4px",
                    marginBottom: "4px"
                  }}>
                    {/* Employee Signature */}
                    <div style={{ textAlign: "center", fontSize: "9px" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>المقر بما فيه (العامل المقترض):</div>
                      <div style={{ color: "#475569", margin: "1px 0" }}>{selectedEmployee.name}</div>
                      <div style={{ color: "#64748b", margin: "15px 0 0 0" }}>التوقيع: .................................</div>
                    </div>

                    {/* OFFICIAL THUMBPRINT BOX (بصمة الإبهام الأيمن للعامل) */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: "bold", color: "#0f172a", marginBottom: "2px" }}>
                        بصمة إبهام العامل (ختم إلزامي):
                      </div>
                      <div style={{
                        width: "95px",
                        height: "58px",
                        border: "2px solid #0f172a",
                        borderRadius: "5px",
                        background: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        fontSize: "8px",
                        color: "#94a3b8",
                        fontWeight: "bold",
                        boxShadow: "inset 0 0 4px rgba(0,0,0,0.05)"
                      }}>
                        [ بصمة الإبهام الأيمن ]
                      </div>
                    </div>

                    {/* Safe Custodian / Finance */}
                    <div style={{ textAlign: "center", fontSize: "9px" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>أمين الخزينة / المسؤول المالي:</div>
                      <div style={{ color: "#475569", margin: "1px 0" }}>تم الصرف نقداً من الخزينة</div>
                      <div style={{ color: "#64748b", margin: "15px 0 0 0" }}>التوقيع: .................................</div>
                    </div>

                    {/* HR Approval & Corporate Stamp */}
                    <div style={{ textAlign: "center", fontSize: "9px" }}>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>اعتماد الموارد البشرية:</div>
                      <div style={{
                        margin: "3px auto 0 auto",
                        width: "115px",
                        height: "52px",
                        border: "1.5px solid #1e3a8a",
                        borderRadius: "6px",
                        padding: "2px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a"
                      }}>
                        <div style={{ fontSize: "9px", fontWeight: "900", lineHeight: "1.1" }}>{companyTitleAr}</div>
                        <div style={{ fontSize: "7px", fontWeight: "bold", fontFamily: "monospace" }}>س.ت: {branchInfo.commReg}</div>
                        <div style={{ fontSize: "7px", fontWeight: "bold", fontFamily: "monospace" }}>ب.ض: {branchInfo.taxId}</div>
                        <div style={{ fontSize: "7px", color: "#047857", fontWeight: "bold" }}>معتمد للصرف والخصم</div>
                      </div>
                    </div>
                  </div>

                  {/* Document Legal Footer */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: "2px",
                    fontSize: "7.5px",
                    color: "#64748b",
                    fontWeight: "bold"
                  }}>
                    <span>إقرار سلفة معتمد رقم LN-{(loan.id || "NEW").slice(-6).toUpperCase()} • محرر وفق أحكام قانون العمل رقم 12 لسنة 2003</span>
                    <span>شركة {companyTitleAr} • س.ت: {branchInfo.commReg} • ب.ض: {branchInfo.taxId}</span>
                  </div>
                </div>
              </div>
            );
          }

          // IF PRINTING EARLY CASH REPAYMENT RECEIPT (إيصال استلام نقدية وسداد سلفة معجل)
          if (printDocumentType === 'loan_receipt') {
            const loan = selectedLoanForPrint || {};
            const paidAmt = Number(loan.receiptPaidAmount || 0);
            const prevBal = Number(loan.receiptPreviousBalance || 0);
            const newBal = Number(loan.receiptNewBalance || 0);
            const todayFormatted = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

            return (
              <div
                className="content-wrapper loan-receipt-page"
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
                  padding: "12mm 14mm",
                  boxSizing: "border-box"
                }}
              >
                <div>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #047857", paddingBottom: "10px", marginBottom: "15px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>{companyTitleAr}</div>
                      <div style={{ fontSize: "11px", color: "#475569", fontWeight: "bold" }}>{companySubtitleEn}</div>
                      <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>س.ت: {branchInfo.commReg} | ب.ض: {branchInfo.taxId}</div>
                    </div>
                    <div style={{
                      border: "2px solid #047857",
                      borderRadius: "8px",
                      padding: "6px 14px",
                      background: "#f0fdf4",
                      textAlign: "center"
                    }}>
                      <div style={{ fontSize: "16px", fontWeight: "900", color: "#047857" }}>
                        إيصال استلام نقدية وتوريد للخزينة
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1e293b" }}>
                        سداد نقدي معجل لسلفة عامل
                      </div>
                    </div>
                    <div style={{ textAlign: "left", fontSize: "11px", fontFamily: "monospace" }}>
                      <div><strong>رقم الإيصال:</strong> RCT-{(loan.id || "GEN").slice(-6).toUpperCase()}</div>
                      <div><strong>تاريخ التوريد:</strong> {todayFormatted}</div>
                      <div><strong>الفرع:</strong> {branchTitleAr}</div>
                    </div>
                  </div>

                  {/* Receipt Body */}
                  <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", lineHeight: "2.2" }}>
                      <tbody>
                        <tr>
                          <td style={{ width: "25%", fontWeight: "bold", color: "#475569" }}>استلمنا من السيد/</td>
                          <td style={{ width: "75%", fontWeight: "900", color: "#0f172a", fontSize: "15px" }}>{selectedEmployee.name}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold", color: "#475569" }}>بطاقة الرقم القومي/</td>
                          <td style={{ fontFamily: "monospace", fontWeight: "bold", letterSpacing: "1px" }}>{selectedEmployee.nationalId || "-"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold", color: "#475569" }}>الوظيفة والفرع/</td>
                          <td>{selectedEmployee.position} — {branchTitleAr}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold", color: "#065f46" }}>مبلغاً وقدره نقداً/</td>
                          <td style={{ fontWeight: "900", color: "#047857", fontSize: "18px", fontFamily: "monospace" }}>
                            {paidAmt.toLocaleString()} جنيهاً مصرياً (EGP)
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold", color: "#475569" }}>فقط وقدره/</td>
                          <td style={{ fontWeight: "bold", color: "#1e293b" }}>
                            {numberToArabicWords(paidAmt)} جنيهاً مصرياً لا غير.
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: "bold", color: "#475569" }}>وذلك سداداً عن/</td>
                          <td>سداد نقدي معجل لسلفة الراتب رقم (LN-{(loan.id || "NEW").slice(-6).toUpperCase()}) وتوريد المبلغ بخزينة الفرع.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Balances Tile */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "25px" }}>
                    <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "8px", textAlign: "center", border: "1px solid #cbd5e1" }}>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold" }}>الرصيد قبل السداد</div>
                      <div style={{ fontSize: "16px", fontWeight: "900", fontFamily: "monospace", color: "#0f172a", marginTop: "4px" }}>
                        {prevBal.toLocaleString()} ج.م
                      </div>
                    </div>
                    <div style={{ background: "#ecfdf5", padding: "12px", borderRadius: "8px", textAlign: "center", border: "1px solid #a7f3d0" }}>
                      <div style={{ fontSize: "11px", color: "#065f46", fontWeight: "bold" }}>المسدد نقداً بالإيصال</div>
                      <div style={{ fontSize: "18px", fontWeight: "900", fontFamily: "monospace", color: "#047857", marginTop: "4px" }}>
                        {paidAmt.toLocaleString()} ج.م
                      </div>
                    </div>
                    <div style={{ background: newBal > 0 ? "#fef2f2" : "#ecfdf5", padding: "12px", borderRadius: "8px", textAlign: "center", border: `1px solid ${newBal > 0 ? "#fecaca" : "#a7f3d0"}` }}>
                      <div style={{ fontSize: "11px", color: newBal > 0 ? "#991b1b" : "#065f46", fontWeight: "bold" }}>الرصيد المتبقي ذمته</div>
                      <div style={{ fontSize: "16px", fontWeight: "900", fontFamily: "monospace", color: newBal > 0 ? "#b91c1c" : "#047857", marginTop: "4px" }}>
                        {newBal.toLocaleString()} ج.م {newBal === 0 && "✓ (خالص)"}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6", background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px dashed #cbd5e1" }}>
                    * يعد هذا الإيصال سنداً رسمياً لإبراء ذمة العامل من المبلغ المسدد نقداً وتوريده بالخزينة، ولا يعتد بأي سداد نقدي بدون هذا الإيصال المعتمد وخاتم الفرع.
                  </div>
                </div>

                {/* Signatures & Seal */}
                <div style={{ borderTop: "2px solid #0f172a", paddingTop: "15px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", textAlign: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "12px", color: "#0f172a" }}>المسدد (العامل):</div>
                      <div style={{ color: "#64748b", margin: "5px 0 35px 0", fontSize: "11px" }}>{selectedEmployee.name}</div>
                      <div>التوقيع: ............................</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "12px", color: "#0f172a" }}>أمين الخزينة المستلم:</div>
                      <div style={{ color: "#64748b", margin: "5px 0 35px 0", fontSize: "11px" }}>خزينة {branchTitleAr}</div>
                      <div>التوقيع: ............................</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "12px", color: "#0f172a" }}>خاتم المنشأة والفرع:</div>
                      <div style={{
                        margin: "5px auto 0 auto",
                        width: "120px",
                        height: "60px",
                        border: "2px solid #1e3a8a",
                        borderRadius: "8px",
                        padding: "4px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#eff6ff",
                        color: "#1e3a8a"
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: "900" }}>{companyTitleAr}</div>
                        <div style={{ fontSize: "7.5px", fontFamily: "monospace" }}>س.ت: {branchInfo.commReg}</div>
                        <div style={{ fontSize: "7.5px", color: "#047857", fontWeight: "bold" }}>تم التوريد بالخزينة</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", fontSize: "9px", color: "#94a3b8", marginTop: "15px", borderTop: "1px solid #e2e8f0", paddingTop: "5px" }}>
                    نظام إدارة الموارد البشرية والحسابات لشركة {companyTitleAr} • طبع بتاريخ {todayFormatted}
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
