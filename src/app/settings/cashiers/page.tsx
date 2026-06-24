"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Users, Trash2, PlusCircle, Lock, Store, Clock, Building } from "lucide-react";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashierSettingsPage() {
  const { currentBranch, availableBranches } = useBranch();
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [pin, setPin] = useState("");
  const [shiftType, setShiftType] = useState("All");
  const [branchId, setBranchId] = useState<string>("");
  
  useEffect(() => {
    if (!branchId && currentBranch !== "all") {
      setBranchId(currentBranch);
    }
  }, [currentBranch, branchId]);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchCashiers = async () => {
    setLoading(true);
    try {
      const empSnap = await getDocs(collection(db, "employees"));
      const employeesMap = new Map<string, any>(empSnap.docs.map(d => [d.data().name, { id: d.id, ...d.data() }]));

      const snap = await getDocs(collection(db, "cashiers"));
      const allCashiers: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const activeCashiers: any[] = [];
      for (const c of allCashiers) {
        const emp = employeesMap.get(c.name);
        if (emp && !c.employeeId) {
          try {
            await updateDoc(doc(db, "cashiers", c.id), { employeeId: emp.id });
            c.employeeId = emp.id;
          } catch (err) {}
        }
        activeCashiers.push(c);
      }

      setCashiers(activeCashiers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const snap = await getDocs(collection(db, "employees"));
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeEmps = emps.filter((e: any) => e.status === "active");
      setEmployeesList(activeEmps);
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  useEffect(() => {
    fetchCashiers();
    fetchEmployees();
  }, []);

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }
    setAdding(true);
    try {
      const selectedEmp = employeesList.find(emp => emp.name === name);
      const empId = selectedEmp ? selectedEmp.id : "";

      if (editId) {
        await updateDoc(doc(db, "cashiers", editId), {
          name,
          storeId,
          pin,
          shiftType,
          employeeId: empId,
          branchId
        });
      } else {
        await addDoc(collection(db, "cashiers"), {
          name,
          storeId,
          pin,
          shiftType,
          employeeId: empId,
          branchId,
          createdAt: new Date().toISOString()
        });
      }
      
      setName("");
      setStoreId("");
      setPin("");
      setShiftType("All");
      setEditId(null);
      fetchCashiers();
      toast.success("Cashier saved successfully!");
    } catch (e) {
      console.error(e);
      toast.error(`Failed to save cashier: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cashier: any) => {
    setEditId(cashier.id);
    setName(cashier.name);
    setStoreId(cashier.storeId);
    setPin(cashier.pin);
    setShiftType(cashier.shiftType || "All");
    setBranchId(cashier.branchId || "alamein4");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    toast.warning("Remove this cashier?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "cashiers", id));
            fetchCashiers();
            toast.success("Cashier removed successfully");
          } catch (e) {
            console.error(e);
            toast.error("Failed to delete cashier");
          }
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-background min-h-screen">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Cashier Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage cashier profiles, store assignments, and 4-digit security PINs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ADD / EDIT FORM */}
        <div className="md:col-span-1">
          <form onSubmit={handleAddCashier} className="glass-panel p-6 rounded-2xl border border-border space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold flex items-center gap-2">
                <PlusCircle className={`h-5 w-5 ${editId ? 'text-blue-500' : 'text-red-500'}`} /> 
                {editId ? 'Edit Cashier' : 'Add New Cashier'}
              </h2>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setName(''); setStoreId(''); setPin(''); setShiftType('All'); }} className="text-xs text-slate-500 underline">Cancel Edit</button>
              )}
            </div>
            
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Full Name</label>
              <select
                required
                value={name}
                onChange={e => {
                  const selectedName = e.target.value;
                  setName(selectedName);
                  const selectedEmp = employeesList.find(emp => emp.name === selectedName);
                  if (selectedEmp && selectedEmp.storeId) {
                    setStoreId(selectedEmp.storeId);
                  }
                }}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
              >
                <option value="">Select Employee...</option>
                {employeesList.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.position || "Employee"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Building className="h-3 w-3" /> Branch</label>
              <select
                required
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
              >
                <option value="">Select Branch...</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Store className="h-3 w-3" /> Default Store ID</label>
              <input required value={storeId} onChange={e => setStoreId(e.target.value)} type="text" className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold" placeholder="e.g. eL-alamein-4" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Allowed Shift</label>
              <select
                value={shiftType}
                onChange={e => setShiftType(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 text-sm font-semibold"
              >
                <option value="All">All (Cashier chooses)</option>
                <option value="Morning">Morning Only</option>
                <option value="Noon">Noon Only</option>
                <option value="Night">Night Only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Lock className="h-3 w-3" /> 4-Digit PIN</label>
              <input required value={pin} onChange={e => setPin(e.target.value)} type="text" pattern="[0-9]{4}" maxLength={4} className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500 font-mono tracking-widest text-center text-lg" placeholder="1234" />
            </div>

            <button disabled={adding} type="submit" className={`w-full py-3 text-white rounded-lg font-bold disabled:opacity-50 transition-colors ${editId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {adding ? "Saving..." : editId ? "Save Changes" : "Add Cashier"}
            </button>
          </form>
        </div>

        {/* CASHIERS LIST */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Users className="h-5 w-5 text-slate-500" /> Active Cashiers ({cashiers.filter(c => currentBranch === 'all' || c.branchId === currentBranch).length})</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cashiers.filter(c => currentBranch === 'all' || c.branchId === currentBranch).map(c => (
              <div key={c.id} className="bg-card border border-border p-4 rounded-xl flex justify-between items-center shadow-sm relative overflow-hidden">
                <div>
                  <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                    {c.name}
                    <span className="text-[10px] uppercase font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/50">
                      {c.shiftType || 'All'} Shift
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1"><Store className="h-3 w-3 inline-block -mt-0.5 mr-1" />{c.storeId}</p>
                  <p className="text-xs bg-red-500/10 text-red-650 dark:text-red-400 font-mono px-2 py-0.5 rounded mt-2 inline-block border border-red-200/50 dark:border-red-905/30"><Lock className="h-3 w-3 inline-block -mt-0.5 mr-1" />PIN: ****</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(c)} className="px-3 py-1 text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-200/50 dark:border-blue-905/30">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors" title="Remove Cashier">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
            {cashiers.length === 0 && (
              <div className="col-span-full text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
                No cashiers registered yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
