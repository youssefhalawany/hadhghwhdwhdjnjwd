"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Tag, Trash2, PowerOff, Power } from "lucide-react";
import { productsDb } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";

interface Offer {
  id: string;
  title: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: string;
}

export default function ManagerOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New Offer Form
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const fetchOffers = async () => {
    try {
      const querySnapshot = await getDocs(collection(productsDb, "promotions"));
      const data: Offer[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...(docSnap.data() as Omit<Offer, 'id'>) });
      });
      // Sort by creation date
      setOffers(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !code) return toast.error("Title and Code are required");
    
    try {
      const payload = {
        title,
        code: code.toUpperCase(),
        description,
        active: true,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(productsDb, "promotions"), payload);
      toast.success("Offer created successfully!");
      setShowModal(false);
      setTitle(""); setCode(""); setDescription("");
      fetchOffers();
    } catch (err) {
      console.error(err);
      toast.error("Error creating offer");
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(productsDb, "promotions", id), { active: !currentStatus });
      toast.success(`Offer ${!currentStatus ? 'activated' : 'deactivated'}`);
      setOffers(offers.map(o => o.id === id ? { ...o, active: !currentStatus } : o));
    } catch (err) {
      toast.error("Error updating offer");
    }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this offer completely?")) return;
    try {
      await deleteDoc(doc(productsDb, "promotions", id));
      toast.success("Offer deleted");
      setOffers(offers.filter(o => o.id !== id));
    } catch (err) {
      toast.error("Error deleting offer");
    }
  };

  return (
    <PageWrapper className="bg-background text-foreground min-h-screen">
      <header className="glass-header p-4 sticky top-0 z-10 border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/owner')}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                <Tag className="text-red-500" size={20} />
                Promotions Hub
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">Manage Cashier Offers</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
          >
            <Plus size={16} /> New Offer
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="text-center p-8 text-slate-500">Loading offers...</div>
        ) : offers.length === 0 ? (
          <div className="text-center p-12 glass-panel rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Tag size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Offers Active</h3>
            <p className="text-slate-500 text-sm mt-2">Create an offer to display it on the cashier POS.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {offers.map(offer => (
              <motion.div 
                key={offer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-panel p-5 rounded-2xl border ${offer.active ? 'border-red-500/30 dark:border-red-500/30 shadow-lg shadow-red-500/5' : 'border-slate-200 dark:border-slate-800 opacity-60'} transition-all relative overflow-hidden`}
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{offer.title}</h3>
                    <p className="text-sm font-mono text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md inline-block mt-2">
                      CODE: {offer.code}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${offer.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {offer.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 relative z-10">
                  {offer.description || "No description provided."}
                </p>

                <div className="flex gap-2 relative z-10">
                  <button 
                    onClick={() => toggleStatus(offer.id, offer.active)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      offer.active 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                    }`}
                  >
                    {offer.active ? <><PowerOff size={14}/> Deactivate</> : <><Power size={14}/> Activate</>}
                  </button>
                  <button 
                    onClick={() => deleteOffer(offer.id)}
                    className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {offer.active && (
                  <div className="absolute -bottom-10 -right-10 opacity-5 dark:opacity-10 pointer-events-none">
                    <Tag size={120} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* New Offer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Create Promotion</h2>
            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Offer Title</label>
                <input 
                  type="text" 
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Free Coffee with Donut"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 outline-none focus:border-red-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Promo Code</label>
                <input 
                  type="text" 
                  value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. FREECFDNT"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 outline-none focus:border-red-500 transition-colors uppercase font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Description</label>
                <textarea 
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details for the cashier..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 outline-none focus:border-red-500 transition-colors resize-none h-24"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white shadow-lg shadow-red-500/20"
                >
                  Create Offer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
