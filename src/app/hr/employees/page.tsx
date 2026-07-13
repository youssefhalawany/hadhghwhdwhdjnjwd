"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, auth, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  limit
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
  Upload
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
  status: "active" | "suspended" | string;
  storeId: string;
  address: string;
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
  createdAt?: any;
  createdBy?: string;
}

const POSITIONS = ["Barista", "Cashier", "Manager", "Assistant Manager", "Supervisor"];

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
    startDate: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsub();
  }, []);

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

  const handleOpenAdd = () => {
    setFormData({
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
      startDate: new Date().toISOString().split("T")[0]
    });
    setSelectedEmployee(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      ...emp
    });
    setShowAddModal(true);
  };



  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const bId = currentBranch === "all" ? "alamein4" : currentBranch;
      const storeId = bId === "ola" ? "ola" : "eL-alamein-4";

      const payload = {
        ...formData,
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

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingID(true);
    const fileRef = ref(storage, `employee_ids/${Date.now()}_${file.name}`);
    
    try {
      const uploadTask = await uploadBytesResumable(fileRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      setFormData(prev => ({ ...prev, nationalIdPhotoUrl: downloadURL }));
      toast.success("ID photo uploaded!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload ID photo");
    } finally {
      setIsUploadingID(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this employee? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "employees", id));
      toast.success("Employee deleted");
      loadData(); // refresh data
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handlePrintContract = async (emp: Employee) => {
    setSelectedEmployee(emp);
    // Give state time to render the print container
    setTimeout(() => {
      window.print();
    }, 200);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Active</p>
                <p className="text-4xl font-black text-slate-800 dark:text-white">{activeCount}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Employees</p>
                <p className="text-4xl font-black text-slate-800 dark:text-white">{employees.length}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <BarChart3 size={28} />
              </div>
            </div>
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Full-Time</p>
                <p className="text-4xl font-black text-slate-800 dark:text-white">{fullTimeCount}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <CheckCircle size={28} />
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
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
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
                        className={`group cursor-pointer p-3 rounded-2xl flex items-center justify-between transition-all duration-300 ${
                          isActive 
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
                        {/* Status Dot */}
                        <div className="shrink-0 pl-2">
                          <div className={`w-3 h-3 rounded-full ${emp.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}></div>
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
                    <div className="absolute top-6 right-6 flex items-center gap-3">
                      <button 
                        onClick={() => handleOpenEdit(activeEmp)}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-2xl transition-all shadow-sm"
                        title="Edit Details"
                      >
                        <Edit size={18} />
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
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                            activeEmp.status === "active" 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" 
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                          }`}>
                            {activeEmp.status}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(activeEmp.id)}
                        className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                        title="Delete Employee"
                      >
                        <Trash2 size={20} />
                      </button>
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

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
                  {selectedEmployee ? "Edit Employee" : "Add Employee"}
                </h2>
                {selectedEmployee && <p className="text-sm text-slate-500 mt-1">{selectedEmployee.name}</p>}
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                    placeholder="e.g. احمد محمد عبدالله"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Position</label>
                  <select
                    value={formData.position}
                    onChange={e => setFormData({...formData, position: e.target.value})}
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
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                {/* Base Salary & Insurance */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Base Salary (EGP)</label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Insurance Deduct (EGP)</label>
                  <input
                    type="number"
                    value={formData.insurance}
                    onChange={e => setFormData({...formData, insurance: Number(e.target.value)})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* National ID & Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">National ID</label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={e => setFormData({...formData, nationalId: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono tracking-wider"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Start Date & Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Shift & Fulltime */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shift Time</label>
                  <select
                    value={formData.shiftTime}
                    onChange={e => setFormData({...formData, shiftTime: e.target.value})}
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
                    onChange={e => setFormData({...formData, fulltime: e.target.value === "Yes"})}
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
                    onChange={e => setFormData({...formData, gender: e.target.value})}
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
                    onChange={e => setFormData({...formData, chequeSignedNum: e.target.value})}
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
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-indigo-500"
                  />
                </div>

                {/* ID Photo Upload */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">National ID Photo (Optional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                      {isUploadingID ? <Loader2 className="animate-spin text-indigo-500" size={20} /> : <Camera size={20} className="text-indigo-500" />}
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        {isUploadingID ? "Uploading..." : formData.nationalIdPhotoUrl ? "Change Scanned ID" : "Capture / Upload Scanned ID"}
                      </span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleIDUpload} disabled={isUploadingID} />
                    </label>
                    {formData.nationalIdPhotoUrl && (
                      <div className="h-14 w-14 rounded-xl border border-border overflow-hidden shrink-0">
                        <img src={formData.nationalIdPhotoUrl} alt="ID" className="w-full h-full object-cover" />
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



      {/* HIDDEN CONTRACT PRINT CONTAINER */}
      <div 
        ref={contractRef}
        className="hidden print:block bg-white text-black print-contract"
        style={{ width: "100%", padding: 0, boxSizing: "border-box", direction: "rtl", fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", fontSize: "16px", lineHeight: "2" }}
      >
        <style type="text/css" media="print">
          {`
            @page { size: A4 portrait; margin: 15mm; }
            .content-wrapper { padding-bottom: 20px; }
          `}
        </style>

        {selectedEmployee && (
          <div className="content-wrapper" style={{ maxWidth: "800px", margin: "0 auto", color: "#000", fontFamily: "'Cairo', 'Tajawal', system-ui, sans-serif" }}>
            
            {/* Header / Letterhead */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #000", paddingBottom: "10px", marginBottom: "20px" }}>
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontSize: "22px", fontWeight: "900", margin: 0, color: "#000" }}>الشركة المصرية للتجارة</h1>
                <h2 style={{ fontSize: "14px", margin: "3px 0 0 0", color: "#333", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Circle K Franchise - Egypt</h2>
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
                      <td style={{ padding: "4px 0" }}>الشركة المصرية للتجارة (El Masreya for Trade - Circle K)</td>
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
                  أ) مدة هذا العقد <span style={{ fontWeight: "bold" }}>سنة ميلادية واحدة</span> تبدأ من تاريخ استلام العمل الفعلي في {selectedEmployee.startDate}، وتتجدد تلقائياً لمدد مماثلة ما لم يخطر أحد الطرفين الآخر برغبته في عدم التجديد كتابياً قبل انتهاء المدة بشهر على الأقل.<br/>
                  ب) يخضع الطرف الثاني لفترة اختبار مدتها <span style={{ fontWeight: "bold" }}>ثلاثة أشهر</span> متصلة تبدأ من تاريخ استلام العمل. يحق للطرف الأول خلالها أو بنهايتها إنهاء هذا العقد فوراً دون الحاجة إلى إنذار مسبق أو تعويض إذا ثبت عدم صلاحية الطرف الثاني للعمل.
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
                  أ) <span style={{ fontWeight: "bold" }}>ساعات العمل:</span> يلتزم الطرف الثاني بالعمل لمدة 8 ساعات يومياً (أو 48 ساعة أسبوعياً كحد أقصى) تتخللها فترة راحة، وفقاً لجداول التشغيل التي تقررها إدارة الشركة.<br/>
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
                <h4 style={{ fontSize: "15px", fontWeight: "bold", margin: "0 0 5px 0", color: "#000" }}>البند السابع: أحكام عامة ونسخ العقد</h4>
                <p style={{ margin: 0 }}>
                  أ) يعتبر العنوان المذكور بصدر هذا العقد هو الموطن القانوني المختار للطرف الثاني، وتعتبر كافة المراسلات والإعلانات المرسلة إليه على هذا العنوان صحيحة ومنتجة لآثارها القانونية.<br/>
                  ب) كل ما لم يرد بشأنه نص خاص في هذا العقد يخضع لأحكام قانون العمل المصري رقم 12 لسنة 2003 وقانون التأمينات الاجتماعية رقم 148 لسنة 2019.<br/>
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
                      <div style={{ flex: 1, borderBottom: "1px dotted #000", fontWeight: "bold" }}>الشركة المصرية للتجارة</div>
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
                <div style={{ padding: "15px", border: "1px solid #000", borderRadius: "8px", backgroundColor: "#f9f9f9", marginBottom: "25px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "bold", color: "#000" }}>إقرار استلام وموافقة</h4>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.8", textAlign: "justify" }}>
                    أقر أنا الموقع أعلاه (الطرف الثاني) بأنني قد اطلعت على كافة بنود هذا العقد وفهمتها فهماً نافياً للجهالة، وبأنني تسلمت نسخة أصلية من هذا العقد موقعة ومختومة من الطرف الأول للعمل بموجبها والاحتفاظ بها، وأتعهد بالالتزام التام بكل ما ورد فيها من أحكام وشروط ولوائح الشركة الداخلية.
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", alignItems: "flex-end" }}>
                    <span style={{ fontWeight: "bold", fontSize: "14px", marginLeft: "15px" }}>توقيع الاستلام:</span>
                    <div style={{ width: "200px", borderBottom: "2px dotted #000" }}></div>
                  </div>
                </div>

                {/* HR Only Box */}
                <div style={{ border: "2px dashed #777", padding: "15px", borderRadius: "8px", backgroundColor: "#fff", marginTop: "10px" }}>
                  <h4 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "bold", color: "#555" }}>خاص بإدارة الموارد البشرية (HR Use Only)</h4>
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

                <div style={{ textAlign: "center", marginTop: "30px", fontSize: "14px", fontWeight: "bold", color: "#666" }}>
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
        )}
      </div>
    </>
  );
}
