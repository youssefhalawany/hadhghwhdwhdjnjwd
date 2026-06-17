"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Users, Trash2, PlusCircle, Lock, Store } from "lucide-react";

export default function CashierSettingsPage() {
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchCashiers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "cashiers"));
      setCashiers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashiers();
  }, []);

  const handleAddCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      alert("PIN must be exactly 4 digits.");
      return;
    }
    setAdding(true);
    try {
      if (editId) {
        // Edit mode
        await updateDoc(doc(db, "cashiers", editId), {
          name,
          storeId,
          pin
        });
      } else {
        // Add mode
        await addDoc(collection(db, "cashiers"), {
          name,
          storeId,
          pin,
          createdAt: new Date().toISOString()
        });
      }
      
      setName("");
      setStoreId("");
      setPin("");
      setEditId(null);
      fetchCashiers();
    } catch (e) {
      console.error(e);
      alert(`Failed to save cashier: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (cashier: any) => {
    setEditId(cashier.id);
    setName(cashier.name);
    setStoreId(cashier.storeId);
    setPin(cashier.pin);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this cashier?")) return;
    try {
      await deleteDoc(doc(db, "cashiers", id));
      fetchCashiers();
    } catch (e) {
      console.error(e);
      alert("Failed to delete cashier");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-t-2 border-red-600 rounded-full"></div></div>;
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
                <button type="button" onClick={() => { setEditId(null); setName(''); setStoreId(''); setPin(''); }} className="text-xs text-slate-500 underline">Cancel Edit</button>
              )}
            </div>
            
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Full Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500" placeholder="e.g. Ahmed Ali" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1"><Store className="h-3 w-3" /> Default Store ID</label>
              <input required value={storeId} onChange={e => setStoreId(e.target.value)} type="text" className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-red-500" placeholder="e.g. eL-alamein-4" />
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
          <h2 className="font-bold flex items-center gap-2"><Users className="h-5 w-5 text-slate-500" /> Active Cashiers ({cashiers.length})</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cashiers.map(c => (
              <div key={c.id} className="bg-card border border-border p-4 rounded-xl flex justify-between items-center shadow-sm">
                <div>
                  <h3 className="font-bold text-foreground text-lg">{c.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{c.storeId}</p>
                  <p className="text-xs bg-red-100 text-red-800 font-mono px-2 py-0.5 rounded mt-2 inline-block border border-red-200">PIN: ****</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(c)} className="px-3 py-1 text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors border border-blue-200">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove Cashier">
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
