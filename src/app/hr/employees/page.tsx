"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, auth } from "@/lib/firebase";
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
  UserCheck
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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

  const handleOpenDetails = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowDetailsModal(true);
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

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-8 w-8 text-indigo-500" />
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">Employees</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your workforce, salaries, and contracts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center p-3 bg-card border border-border text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? "animate-spin text-indigo-500" : ""} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:bg-indigo-700 transition"
          >
            <Plus size={20} /> Add Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500 mb-1">Total Employees</p>
          <p className="text-4xl font-black text-indigo-600">{employees.length}</p>
        </div>
        <div className="bg-card border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500 mb-1">Active</p>
          <p className="text-4xl font-black text-emerald-500">{activeCount}</p>
        </div>
        <div className="bg-card border border-purple-200 dark:border-purple-900/50 rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500 mb-1">Full-Time</p>
          <p className="text-4xl font-black text-purple-500">{fullTimeCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card border border-border rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-2 px-3 flex-1 w-full">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm font-medium w-full p-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
        </div>
        <div className="h-8 w-px bg-border hidden sm:block"></div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-transparent text-sm font-bold p-3 outline-none text-slate-700 dark:text-slate-200 w-full sm:w-auto"
        >
          <option>All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-bold text-sm mx-2 flex items-center gap-2">
          <Download size={16} /> Export
        </button>
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-card border border-dashed border-border rounded-3xl">
          <Users size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No employees found</h3>
          <p className="text-slate-500 mt-2">Adjust your search or add a new employee.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              {/* Status Badge */}
              <div className="absolute top-6 right-6">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  emp.status === "active" 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {emp.status}
                </span>
              </div>

              {/* Header Profile */}
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0">
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50 line-clamp-2 leading-tight">
                    {emp.name}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">{emp.position}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-y-4 mb-6 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Salary</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{fmtCurrency(emp.baseSalary)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Start Date</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{emp.startDate || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Type</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{emp.fulltime ? "Full-Time" : "Part-Time"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Shift</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{emp.shiftTime || "-"}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                <button 
                  onClick={() => handleOpenDetails(emp)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-xl font-bold text-sm transition"
                >
                  <Eye size={16} /> Details
                </button>
                <button 
                  onClick={() => handlePrintContract(emp)}
                  disabled={isPrinting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-400 rounded-xl font-bold text-sm transition"
                >
                  {isPrinting && selectedEmployee?.id === emp.id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
                  Contract
                </button>
                <button 
                  onClick={() => handleOpenEdit(emp)}
                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(emp.id)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Area */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-8 flex justify-between items-start text-white relative">
              <button 
                onClick={() => setShowDetailsModal(false)} 
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-md transition"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30 text-3xl font-black shrink-0">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-black leading-tight mb-1">{selectedEmployee.name}</h2>
                  <p className="text-indigo-100 font-medium">{selectedEmployee.position}</p>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-8 overflow-y-auto space-y-8 bg-slate-50 dark:bg-background">
              
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5"><UserCheck size={14}/> National ID</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wide">{selectedEmployee.nationalId || "-"}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1">Gender / Age</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{selectedEmployee.gender || "-"} • {selectedEmployee.age || "-"} yrs</p>
                  </div>
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm col-span-2">
                    <p className="text-xs font-bold text-slate-400 mb-1">Address</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 leading-relaxed">{selectedEmployee.address || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Employment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5"><Briefcase size={14}/> Position</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{selectedEmployee.position || "-"}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1">Start Date</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{selectedEmployee.startDate || "-"}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1">Type & Shift</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">{selectedEmployee.fulltime ? "Full-Time" : "Part-Time"} • {selectedEmployee.shiftTime || "-"}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedEmployee.status === "active" 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {selectedEmployee.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compensation */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Compensation</h3>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">Base Salary</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500">{fmtCurrency(selectedEmployee.baseSalary)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-700/70 dark:text-emerald-400/70 mb-1">Insurance Deduct</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(selectedEmployee.insurance)}/mo</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-border bg-white dark:bg-card flex gap-4">
              <button 
                onClick={() => handlePrintContract(selectedEmployee)}
                disabled={isPrinting}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition flex justify-center items-center gap-2 shadow-sm"
              >
                {isPrinting ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} Print Contract
              </button>
              <button 
                onClick={() => { setShowDetailsModal(false); handleOpenEdit(selectedEmployee); }}
                className="flex-1 py-3 border border-border text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN CONTRACT PRINT CONTAINER */}
      <div 
        ref={contractRef}
        className="hidden bg-white text-black print-contract"
        style={{ width: "210mm", minHeight: "297mm", padding: "20mm", boxSizing: "border-box", direction: "rtl", fontFamily: "Arial, sans-serif" }}
      >
        {selectedEmployee && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>ﻋﻘﺪ ﻋﻤﻞ</h1>
              <h2 style={{ fontSize: "16px", margin: "5px 0 0 0", color: "#555" }}>Employment Contract</h2>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ width: "48%" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Company Name / ﺍﺳﻢ ﺍﻟﺸﺮﻛﺔ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>El Masreya for Trade</p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "15px" }}>
              ﺑﻴﺎﻧﺎﺕ ﺍﻟﻤﻮﻇﻒ / Employee Information
            </h3>

            <div style={{ display: "flex", flexWrap: "wrap", marginBottom: "20px" }}>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Employee Name / ﺍﺳﻢ ﺍﻟﻤﻮﻇﻒ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{selectedEmployee.name}</p>
              </div>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Position / ﺍﻟﻤﺴﻤﻰ ﺍﻟﻮﻇﻴﻔﻲ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{selectedEmployee.position}</p>
              </div>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Base Salary / ﺍﻟﺮﺍﺗﺐ ﺍﻷﺳﺎﺳﻲ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{fmtCurrency(selectedEmployee.baseSalary)}</p>
              </div>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>National ID / ﺍﻟﺮﻗﻢ ﺍﻟﻘﻮﻣﻲ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{selectedEmployee.nationalId || "-"}</p>
              </div>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Start Date / ﺗﺎﺭﻳﺦ ﺍﻟﺒﺪﺀ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{selectedEmployee.startDate}</p>
              </div>
              <div style={{ width: "50%", marginBottom: "15px" }}>
                <p style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#666" }}>Phone / ﺭﻗﻢ ﺍﻟﻬﺎﺗﻒ</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold", direction: "ltr", textAlign: "right" }}>{selectedEmployee.phone || "-"}</p>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "bold", borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "15px" }}>
              ﺑﻨﻮﺩ ﺍﻟﻌﻘﺪ / Contract Terms
            </h3>

            <div style={{ fontSize: "12px", lineHeight: "1.8", color: "#333", textAlign: "justify" }}>
              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻷﻭﻟﻰ: ﻃﺒﻴﻌﺔ ﺍﻟﻌﻘﺪ ﻭﺍﻷﺳﺎﺱ ﺍﻟﻘﺎﻧﻮﻧﻲ</strong><br/>
              ﻳﻌﺘﺒﺮ ﻫﺬﺍ ﺍﻟﻌﻘﺪ ﻋﻘﺪ ﻋﻤﻞ ﻓﺮﺩﻱ ﻳﻨﻈﻢ ﺍﻟﻌﻼﻗﺔ ﺑﻴﻦ ﺍﻟﻄﺮﻓﻴﻦ ﻃﺒﻗًﺎ ﻷﺣﻜﺎﻡ ﻗﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﺍﻟﻤﺼﺮﻱ ﻭﻻﺋﺤﺘﻪ ﺍﻟﺘﻨﻔﻴﺬﻳﺔ ﻭﻣﺎ ﻳﺴﺘﺠﺪ ﻣﻦ ﺗﻌﺪﻳﻼﺗ، ﻭﻗﺎﻧﻮﻥ ﺍﻟﺘﺄﻣﻴﻨﺎﺕ ﺍﻻﺟﺘﻤﺎﻋﻴﺔ ﻭﺍﻟﻤﻌﺎﺷﺎﺕ ﻭﺗﻌﺪﻳﻼﺗﻪ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺜﺎﻧﻴﺔ: ﻣﻮﺿﻮﻉ ﺍﻟﻌﻘﺪ ﻭﻣﻜﺎﻥ ﺍﻟﻌﻤﻞ</strong><br/>
              ﻳﻮﺍﻓﻖ ﺍﻟﻌﺎﻣﻞ ﻋﻠﻰ ﺍﻟﻌﻤﻞ ﻟﺪﻯ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ ﻓﻲ ﻭﻇﻴﻔﺔ: {selectedEmployee.position}.<br/>
              ﻳﻠﺘﺰﻡ ﺍﻟﻌﺎﻣﻞ ﺑﺄﺩﺍﺀ ﺟﻤﻴﻊ ﺍﻟﻤﻬﺎﻡ ﻭﺍﻟﻮﺍﺟﺒﺎﺕ ﺍﻟﻤﺮﺗﺒﻄﺔ ﺑﻮﻇﻴﻔﺘﻫ، ﻭﻛﻞ ﻣﺎ ﻳﺴﻨﺪ ﺇﻟﻴﻪ ﻣﻦ ﺃﻋﻤﺎﻝ ﺗﺪﺧﻞ ﻓﻲ ﻧﻄﺎﻕ ﻃﺒﻴﻌﺔ ﻧﺸﺎﻁ ﺍﻟﺸﺮﻛﺔ ﺩﻭﻥ ﺇﺧﻼﻝ ﺑﺎﻟﻘﺎﻧﻮﻥ.<br/>
              ﻣﻜﺎﻥ ﺍﻟﻌﻤﻞ ﺍﻷﺳﺎﺳﻲ ﻫﻮ ﻓﺮﻉ ﺍﻟﺸﺮﻛﺔ ﺍﻟﻜﺎﺋﻦ ﻓﻲ: ﺍﻟﻤﺤﺪﺩ ﺣﺴﺐ ﺍﻟﻔﺮﻉ. ﻭﻳﺠﻮﺯ ﻟﺼﺎﺣﺐ ﺍﻟﻌﻤﻟ، ﻭﻓﻗًﺎ ﻟﻤﻘﺘﻀﻴﺎﺕ ﺍﻟﻌﻤﻟ، ﻧﻘﻞ ﺍﻟﻌﺎﻣﻞ ﺇﻟﻰ ﺃﻱ ﻓﺮﻉ ﺃﻭ ﻣﻘﺮ ﺁﺧﺮ ﺗﺎﺑﻊ ﻟﻠﺸﺮﻛﺔ ﺩﺍﺧﻞ ﺟﻤﻬﻮﺭﻳﺔ ﻣﺼﺮ ﺍﻟﻌﺮﺑﻴﺔ ﺑﺸﺮﻁ ﺃﻻ ﻳﺘﺮﺗﺐ ﻋﻠﻰ ﺍﻟﻨﻘﻞ ﺿﺮﺭ ﺟﺴﻴﻢ ﻟﻠﻌﺎﻣﻞ ﻭﻭﻓﻗًﺎ ﻟﻠﻘﺎﻧﻮﻥ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺜﺎﻟﺜﺔ: ﺳﺎﻋﺎﺕ ﻭﻣﻮﺍﻋﻴﺪ ﺍﻟﻌﻤﻞ</strong><br/>
              ﻳﻠﺘﺰﻡ ﺍﻟﻌﺎﻣﻞ ﺑﺎﻟﻌﻤﻞ ﻟﻤﺪﺓ ﻻ ﺗﺰﻳﺪ ﻋﻦ ﺛﻤﺎﻧﻲ ﺳﺎﻋﺎﺕ ﻋﻤﻞ ﻓﻌﻠﻴﺔ ﻳﻮﻣﻳًﺎ ﻭﺑﺤﺪ ﺃﻗﺼﻰ ﺛﻤﺎﻥ ﻭﺃﺭﺑﻌﻴﻦ ﺳﺎﻋﺔ ﺃﺳﺒﻮﻋﻳًﺎ، ﻻ ﺗﺪﺧﻞ ﻓﻴﻬﺎ ﻓﺘﺮﺍﺕ ﺍﻟﺮﺍﺣﺔ ﻭﺍﻟﻄﻌﺎﻣ، ﻭﺫﻟﻚ ﻭﻓﻗًﺎ ﻟﻘﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ.<br/>
              ﻳﺤﺪﺩ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ ﻣﻮﺍﻋﻴﺪ ﺍﻟﺤﻀﻮﺭ ﻭﺍﻻﻧﺼﺮﺍﻑ.<br/>
              ﻳﻠﺘﺰﻡ ﺍﻟﻌﺎﻣﻞ ﺑﺎﻻﻧﺼﺮﺍﻑ ﺑﻌﺪ ﺇﺗﻤﺎﻡ ﻋﻤﻠﻪ ﻭﺍﻟﺘﻮﻗﻴﻊ ﻓﻲ ﺳﺠﻼﺕ ﺍﻟﺤﻀﻮﺭ ﻭﺍﻻﻧﺼﺮﺍﻑ ﺃﻭ ﺍﻟﻨﻈﺎﻡ ﺍﻹﻟﻜﺘﺮﻭﻧﻲ ﺍﻟﻤﻌﺘﻤﺪ ﻟﺪﻯ ﺍﻟﺸﺮﻛﺔ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺮﺍﺑﻌﺔ: ﺍﻷﺟﺮ ﻭﻣﻮﻋﺪ ﺍﻟﺼﺮﻑ</strong><br/>
              ﻳﺘﻘﺎﺿﻰ ﺍﻟﻌﺎﻣﻞ ﺃﺟﺮًﺎ ﺷﻬﺮﻳًﺎ ﺇﺟﻤﺎﻟﻳًﺎ ﻗﺪﺭﻩ: {fmtCurrency(selectedEmployee.baseSalary)}.<br/>
              ﻳﺼﺮﻑ ﺃﺟﺮ ﺍﻟﻌﺎﻣﻞ ﺷﻬﺮﻳًﺎ ﻓﻲ ﺍﻟﻴﻮﻡ ﺍﻟﺨﺎﻣﺲ ﻣﻦ ﻛﻞ ﺷﻬﺮ ﻣﻴﻼﺩﻱ ﻛﺤﺪ ﺃﻗﺼﯨ، ﻧﻘﺪًﺎ ﺃﻭ ﻋﻦ ﻃﺮﻳﻖ ﺍﻟﺘﺤﻮﻳﻞ ﺍﻟﺒﻨﻜﻲ ﺃﻭ ﺃﻱ ﻭﺳﻴﻠﺔ ﺩﻓﻊ ﻣﺸﺮﻭﻋﺔ ﻳﺘﻔﻖ ﻋﻠﻴﻬﺎ ﺍﻟﻄﺮﻓﺎﻧ، ﻭﺫﻟﻚ ﻭﻓﻗًﺎ ﻟﻤﺎ ﻳﺘﻴﺤﻪ ﺍﻟﻘﺎﻧﻮﻥ.<br/>
              ﻳﺮﺍﻋﻰ ﻓﻲ ﺧﺼﻢ ﺍﻻﺳﺘﻘﻄﺎﻋﺎﺕ ﺍﻟﻘﺎﻧﻮﻧﻴﺔ ﻣﺎ ﻳﻠﻲ: ﺣﺼﺔ ﺍﻟﻌﺎﻣﻞ ﻓﻲ ﺍﻟﺘﺄﻣﻴﻨﺎﺕ ﺍﻻﺟﺘﻤﺎﻋﻴﺔ، ﺍﻟﻀﺮﺍﺋﺐ ﺍﻟﻤﺴﺘﺤﻘﺔ ﻋﻠﻰ ﺍﻟﺪﺧﻟ، ﻭﺃﻱ ﺍﺳﺘﻘﻄﺎﻋﺎﺕ ﺃﺧﺮﻯ ﻣﻘﺮﺭﺓ ﻭﻓﻖ ﺍﻟﻘﺎﻧﻮﻥ ﺃﻭ ﺍﻟﻼﺋﺤﺔ ﺍﻟﺪﺍﺧﻠﻴﺔ ﺍﻟﻤﻌﺘﻤﺪﺓ ﻟﻠﺸﺮﻛﺔ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺨﺎﻣﺴﺔ: ﺍﻟﺘﺰﺍﻣﺎﺕ ﺍﻟﻌﺎﻣﻞ</strong><br/>
              ﻳﻠﺘﺰﻡ ﺍﻟﻌﺎﻣﻞ ﺑﺎﻟﺤﻔﺎﻅ ﻋﻠﻰ ﻣﻈﻬﺮ ﻻﺋﻖ ﻭﻧﻈﻴﻒ ﻳﺘﻨﺎﺳﺐ ﻣﻊ ﻃﺒﻴﻌﺔ ﺍﻟﻌﻤﻞ ﻭﻣﻌﺎﻣﻠﺔ ﺍﻟﻌﻤﻼﺀ، ﻭﺍﻻﻟﺘﺰﺍﻡ ﺑﺎﻟﻤﻼﺑﺲ ﺍﻟﺮﺳﻤﻴﺔ ﺃﻭ ﺍﻟﺰﻱ ﺍﻟﻤﻮﺣﺪ ﺣﺴﺐ ﺗﻌﻠﻴﻤﺎﺕ ﺍﻹﺩﺍﺭﺓ.<br/>
              ﻣﻌﺎﻣﻠﺔ ﺍﻟﻌﻤﻼﺀ ﺑﺎﺣﺘﺮﺍﻡ ﻭﻟﺒﺎﻗﺔ، ﻭﺑﺬﻝ ﺍﻟﻌﻨﺎﻳﺔ ﺍﻟﻼﺯﻣﺔ ﻹﻧﻬﺎﺀ ﻣﺼﺎﻟﺤﻬﻢ ﺑﺄﻓﻀﻞ ﺻﻮﺭﺓ، ﻭﺍﻟﺤﻔﺎﻅ ﻋﻠﻰ ﺭﻭﺡ ﺍﻟﺘﻌﺎﻭﻥ ﻣﻊ ﺍﻟﺰﻣﻼﺀ ﻭﺍﻟﺮﺅﺳﺎﺀ.<br/>
              ﺍﻻﻟﺘﺰﺍﻡ ﺑﺠﻤﻴﻊ ﺍﻟﺘﻌﻠﻴﻤﺎﺕ ﺍﻟﺸﻔﻮﻳﺔ ﻭﺍﻟﻜﺘﺎﺑﻴﺔ ﺍﻟﺼﺎﺩﺭﺓ ﻣﻦ ﺍﻹﺩﺍﺭﺓ ﺍﻟﻤﺨﺘﺼﺔ، ﻭﺍﻻﻟﺘﺰﺍﻡ ﺑﻼﺋﺤﺔ ﺍﻟﻨﻈﺎﻡ ﺍﻟﺪﺍﺧﻠﻲ ﻭﻟﻮﺍﺋﺢ ﺍﻟﺠﺰﺍﺀﺍﺕ ﺍﻟﻤﻌﺘﻤﺪﺓ ﻟﺪﻯ ﺍﻟﺠﻬﺔ ﺍﻹﺩﺍﺭﻳﺔ ﺍﻟﻤﺨﺘﺼﺔ، ﺑﺎﻋﺘﺒﺎﺭﻫﺎ ﺟﺰﺀًﺎ ﻻ ﻳﺘﺠﺰﺃ ﻣﻦ ﻫﺬﺍ ﺍﻟﻌﻘﺪ.<br/>
              ﺍﻟﻤﺤﺎﻓﻈﺔ ﻋﻠﻰ ﺃﺩﻭﺍﺕ ﻭﻣﻌﺪﺍﺕ ﺍﻟﻌﻤﻞ ﻭﺃﻱ ﻋﻬﺪﺓ ﺗﺴﻠﻢ ﺇﻟﻴﻫ، ﻭﺇﺭﺟﺎﻋﻬﺎ ﺑﺤﺎﻟﺘﻬﺎ ﻋﻨﺪ ﺍﻧﺘﻬﺎﺀ ﺍﻟﻌﻤﻞ ﺃﻭ ﻋﻨﺪ ﻃﻠﺐ ﺍﻟﺸﺮﻛﺔ.<br/>
              ﻋﺪﻡ ﺇﻓﺸﺎﺀ ﺃﻱ ﻣﻌﻠﻮﻣﺎﺕ ﺃﻭ ﺑﻴﺎﻧﺎﺕ ﺃﻭ ﺃﺳﺮﺍﺭ ﺗﺘﻌﻠﻖ ﺑﺎﻟﺸﺮﻛﺔ ﺃﻭ ﻋﻤﻼﺋﻬﺎ ﺃﻭ ﻣﻮﺭﺩﻳﻬﺎ، ﺳﻮﺍﺀ ﺃﺛﻨﺎﺀ ﺳﺮﻳﺎﻥ ﻫﺬﺍ ﺍﻟﻌﻘﺪ ﺃﻭ ﺑﻌﺪ ﺍﻧﺘﻬﺎﺋﻫ، ﺇﻻ ﻓﻲ ﺍﻟﺤﺪﻭﺩ ﺍﻟﺘﻲ ﻳﺒﻴﺤﻬﺎ ﺍﻟﻘﺎﻧﻮﻥ.<br/>
              ﺍﻻﻣﺘﻨﺎﻉ ﻋﻦ ﺍﺳﺘﻐﻼﻝ ﺍﻟﻤﻌﻠﻮﻣﺎﺕ ﺃﻭ ﺍﻟﻌﻤﻼﺀ ﻟﻤﺼﻠﺤﺔ ﺷﺨﺼﻴﺔ ﺃﻭ ﻟﺤﺴﺎﺏ ﺟﻬﺔ ﻣﻨﺎﻓﺴﺔ ﺃﺛﻨﺎﺀ ﺍﻟﺨﺪﻣﺔ، ﻭﺃﻱ ﺷﺮﻁ ﻣﻨﺎﻓﺴﺔ ﺑﻌﺪ ﺍﻧﺘﻬﺎﺀ ﺍﻟﺨﺪﻣﺔ – ﺇﻥ ﺗﻢ ﺍﻻﺗﻔﺎﻕ ﻋﻠﻴﻪ – ﻳﺠﺐ ﺃﻥ ﻳﻜﻮﻥ ﻣﻜﺘﻮﺑًﺎ ﻭﻣﺤﺪﺩًﺎ ﻣﻦ ﺣﻴﺚ ﺍﻟﺰﻣﺎﻥ ﻭﺍﻟﻤﻜﺎﻥ ﻭﻧﻮﻉ ﺍﻟﻨﺸﺎﻁ ﻭﺑﻤﺎ ﻻ ﻳﺠﺎﻭﺯ ﻣﺎ ﻳﻘﺒﻠﻪ ﺍﻟﻘﺎﻧﻮﻥ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺴﺎﺩﺳﺔ: ﺍﻟﺘﺰﺍﻣﺎﺕ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ</strong><br/>
              ﺗﻤﻜﻴﻦ ﺍﻟﻌﺎﻣﻞ ﻣﻦ ﺃﺩﺍﺀ ﻋﻤﻠﻪ ﻭﺗﻮﻓﻴﺮ ﺍﻷﺩﻭﺍﺕ ﻭﺍﻟﻮﺳﺎﺋﻞ ﺍﻟﻼﺯﻣﺔ ﻟﺬﻟﻚ.<br/>
              ﺳﺪﺍﺩ ﺍﻷﺟﺮ ﻓﻲ ﻣﻮﺍﻋﻴﺪﻩ ﺍﻟﻤﺤﺪﺩﺓ ﺑﻬﺬﺍ ﺍﻟﻌﻘﺪ ﻭﻃﺒﻗًﺎ ﻟﻠﻘﺎﻧﻮﻥ.<br/>
              ﻗﻴﺪ ﺍﻟﻌﺎﻣﻞ ﻓﻲ ﺍﻟﺘﺄﻣﻴﻨﺎﺕ ﺍﻻﺟﺘﻤﺎﻋﻴﺔ ﻭﺳﺪﺍﺩ ﺍﻟﺤﺼﺔ ﺍﻟﻤﻘﺮﺭﺓ ﻋﻠﻰ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ.<br/>
              ﺗﻮﻓﻴﺮ ﺑﻴﺌﺔ ﻋﻤﻞ ﺁﻣﻨﺔ ﻭﻓﻗًﺎ ﻻﺷﺘﺮﺍﻃﺎﺕ ﺍﻟﺴﻼﻣﺔ ﻭﺍﻟﺼﺤﺔ ﺍﻟﻤﻬﻨﻴﺔ.<br/>
              ﻣﻨﺢ ﺍﻟﻌﺎﻣﻞ ﺍﻹﺟﺎﺯﺍﺕ ﺍﻟﻤﺴﺘﺤﻘﺔ ﻟﻪ ﻭﻓﻗًﺎ ﻷﺣﻜﺎﻡ ﻗﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﻭﻫﺬﺍ ﺍﻟﻌﻘﺪ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺴﺎﺑﻌﺔ: ﺍﻟﺤﻀﻮﺭ ﻭﺍﻻﻧﺼﺮﺍﻑ ﻭﺍﻟﺠﺰﺍﺀﺍﺕ</strong><br/>
              ﻳﻠﺘﺰﻡ ﺍﻟﻌﺎﻣﻞ ﺑﺎﻟﺤﻀﻮﺭ ﻭﺍﻻﻧﺼﺮﺍﻑ ﻓﻲ ﺍﻟﻤﻮﺍﻋﻴﺪ ﺍﻟﻤﺤﺪﺩﺓ، ﻭﺍﻟﺘﻮﻗﻴﻊ ﻓﻲ ﺳﺠﻼﺕ ﺃﻭ ﻧﻈﺎﻡ ﺍﻟﺤﻀﻮﺭ ﻭﺍﻻﻧﺼﺮﺍﻑ.<br/>
              ﻓﻲ ﺣﺎﻝ ﺍﻟﺘﺄﺧﺮ ﺍﻟﻤﺘﻜﺮﺭ ﺃﻭ ﺍﻟﻐﻴﺎﺏ ﺩﻭﻥ ﺇﺫﻥ ﺃﻭ ﻋﺬﺭ ﻣﻘﺒﻮﻟ، ﻳﻄﺒﻖ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ ﺍﻟﺠﺰﺍﺀﺍﺕ ﺍﻟﺘﺄﺩﻳﺒﻴﺔ ﺍﻟﻮﺍﺭﺩﺓ ﻓﻲ ﻗﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﺍﻟﻤﺼﺮﻱ ﻭﻻﺋﺤﺔ ﺍﻟﺠﺰﺍﺀﺍﺕ ﺍﻟﻤﻌﺘﻤﺪﺓ ﺑﺎﻟﺸﺮﻛﺔ.<br/>
              ﺃﻱ ﺧﺼﻮﻣﺎﺕ ﻣﻦ ﺃﺟﺮ ﺍﻟﻌﺎﻣﻞ ﻳﺠﺐ ﺃﻥ ﺗﻜﻮﻥ ﻓﻲ ﺍﻟﺤﺪﻭﺩ ﺍﻟﺘﻲ ﻳﻘﺮﺭﻫﺎ ﻗﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﻭﺃﻻ ﺗﺆﺩﻱ ﺇﻟﻰ ﺣﺮﻣﺎﻥ ﺍﻟﻌﺎﻣﻞ ﻣﻦ ﻛﺎﻣﻞ ﺃﺟﺮﻩ ﻋﻦ ﻣﺪﺓ ﻋﻤﻞ ﻓﻌﻠﻴﺔ.</p>

              <p><strong>ﺍﻟﻤﺎﺩﺓ ﺍﻟﺜﺎﻣﻨﺔ: ﺇﻧﻬﺎﺀ ﺍﻟﻌﻘﺪ ﻭﺍﻹﺧﻄﺎﺭ</strong><br/>
              ﻳﺠﻮﺯ ﻷﻱ ﻣﻦ ﺍﻟﻄﺮﻓﻴﻦ ﺇﻧﻬﺎﺀ ﺍﻟﻌﻘﺪ ﺑﺸﺮﻁ ﺇﺧﻄﺎﺭ ﺍﻟﻄﺮﻑ ﺍﻵﺧﺮ ﺇﺧﻄﺎﺭًﺎ ﻛﺘﺎﺑﻳًﺎ ﻗﺒﻞ ﺍﻹﻧﻬﺎﺀ ﺑﻤﺪﺓ ﻻ ﺗﻘﻞ ﻋﻦ ﺃﺳﺒﻮﻋﻴﻦ ﻭﺫﻟﻚ ﻟﻠﻌﻘﻮﺩ ﻏﻴﺮ ﻣﺤﺪﺩﺓ ﺍﻟﻤﺪﺓ ﻃﺒﻗًﺎ ﻟﻘﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﺍﻟﺠﺪﻳﺪ.<br/>
              ﺇﺫﺍ ﺃﻧﻬﻰ ﺃﻱ ﻣﻦ ﺍﻟﻄﺮﻓﻴﻦ ﺍﻟﻌﻘﺪ ﺍﻟﻤﺤﺪﺩ ﺍﻟﻤﺪﺓ ﺩﻭﻥ ﺳﺒﺐ ﻣﺸﺮﻭﻋ، ﻳﻠﺘﺰﻡ ﺑﺘﻌﻮﻳﺾ ﺍﻟﻄﺮﻑ ﺍﻵﺧﺮ ﻋﻦ ﺍﻟﻀﺮﺭ ﻭﻓﻗًﺎ ﻷﺣﻜﺎﻡ ﺍﻟﻘﺎﻧﻮﻥ.<br/>
              ﻳﺠﻮﺯ ﻟﺼﺎﺣﺐ ﺍﻟﻌﻤﻞ ﻓﺼﻞ ﺍﻟﻌﺎﻣﻞ ﻓﻲ ﺣﺎﻻﺕ ﻣﺤﺪﺩﺓ ﻳﻘﺮﻫﺎ ﺍﻟﻘﺎﻧﻮﻧ، ﻣﻊ ﻣﺮﺍﻋﺎﺓ ﺍﻹﺟﺮﺍﺀﺍﺕ ﺍﻟﻤﻨﺼﻮﺹ ﻋﻠﻴﻬﺎ ﻓﻲ ﻗﺎﻧﻮﻥ ﺍﻟﻌﻤﻞ ﻭﺍﻟﻘﻀﺎﺀ ﺍﻟﻌﻤﺎﻟﻲ ﺍﻟﻤﺨﺘﺺ.<br/>
              ﻳﻘﺪﻡ ﺍﻟﻌﺎﻣﻞ ﺍﺳﺘﻘﺎﻟﺘﻪ ﻛﺘﺎﺑﻳًﺎ ﺇﻟﻰ ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ ﻭﻓﻗًﺎ ﻟﻠﻨﻤﺎﺫﺝ ﻭﺍﻹﺟﺮﺍﺀﺍﺕ ﺍﻟﻤﻌﻤﻮﻝ ﺑﻬﺎ، ﻭﻳﺤﻖ ﻟﻠﻌﺎﻣﻞ ﺍﻟﻌﺪﻭﻝ ﻋﻦ ﺍﺳﺘﻘﺎﻟﺘﻪ ﺧﻼﻝ ﺍﻟﻤﺪﺓ ﺍﻟﺘﻲ ﻳﺤﺪﺩﻫﺎ ﺍﻟﻘﺎﻧﻮﻧ، ﻭﺇﻻ ﺍﻋﺘﺒﺮﺕ ﺍﻻﺳﺘﻘﺎﻟﺔ ﻧﻬﺎﺋﻴﺔ.</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px" }}>
              <div style={{ width: "40%", textAlign: "center" }}>
                <p style={{ fontWeight: "bold", marginBottom: "30px" }}>ﺻﺎﺣﺐ ﺍﻟﻌﻤﻞ<br/><span style={{ fontSize: "12px", color: "#666" }}>Employer Signature</span></p>
                <div style={{ borderBottom: "1px solid #000", width: "80%", margin: "0 auto" }}></div>
              </div>
              <div style={{ width: "40%", textAlign: "center" }}>
                <p style={{ fontWeight: "bold", marginBottom: "30px" }}>ﺗﻮﻗﻴﻊ ﺍﻟﻤﻮﻇﻒ<br/><span style={{ fontSize: "12px", color: "#666" }}>Employee Signature</span></p>
                <div style={{ borderBottom: "1px solid #000", width: "80%", margin: "0 auto" }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
