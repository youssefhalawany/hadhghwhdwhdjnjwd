"use client";

import React, { useState, useEffect } from "react";
import { productsDb } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { PageWrapper } from "@/components/PageWrapper";
import { Package, Search, MapPin, Eye, X, CheckCircle, User, Calendar, Clock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import toast from "react-hot-toast";

interface LostAndFoundItem {
  id: string;
  description: string;
  locationFound: string;
  photoUrl: string;
  cashierName: string;
  timestamp: string;
  localTime?: string;
  status?: string;
  takenAt?: string;
}

export default function ManagerLostAndFoundPage() {
  const { language } = useLanguage();
  const [items, setItems] = useState<LostAndFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, taken
  
  const [selectedItem, setSelectedItem] = useState<LostAndFoundItem | null>(null);

  useEffect(() => {
    const q = query(collection(productsDb, "lost_and_found"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: LostAndFoundItem[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as LostAndFoundItem);
      });
      setItems(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching lost and found items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAsTaken = async (id: string) => {
    if (confirm(language === 'en' ? 'Are you sure this item was returned to the owner?' : 'هل أنت متأكد من إعادة هذا العنصر لمالكه؟')) {
      try {
        await updateDoc(doc(productsDb, "lost_and_found", id), {
          status: "taken",
          takenAt: new Date().toISOString()
        });
        toast.success(language === 'en' ? 'Marked as taken!' : 'تم التحديد كمستلم!');
      } catch (error) {
        console.error("Error updating item status:", error);
        toast.error(language === 'en' ? 'Failed to update status.' : 'فشل تحديث الحالة.');
      }
    }
  };

  const filteredItems = items.filter(item => {
    // 1. Search filter
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.locationFound.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.cashierName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Status filter
    const isTaken = item.status === "taken";
    const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "taken" && isTaken) || 
                          (statusFilter === "pending" && !isTaken);
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (isoString: string, fallbackLocal?: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh'
      }).format(d);
    } catch {
      return fallbackLocal || isoString;
    }
  };

  return (
    <PageWrapper className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-8" dir={language === "ar" ? "rtl" : "ltr"}>
      
      {/* Header & Filters */}
      <header className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Package className="text-cyan-500" size={32} />
              {language === 'en' ? 'Lost & Found' : 'المفقودات'}
            </h1>
            <p className="text-slate-500 mt-2">
              {language === 'en' ? 'Manage reported lost items and mark them when claimed.' : 'إدارة المفقودات المبلغ عنها وتحديدها عند استلامها.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={language === 'en' ? 'Search items...' : 'ابحث في العناصر...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-48 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
          >
            <option value="all">{language === 'en' ? 'All Statuses' : 'كل الحالات'}</option>
            <option value="pending">{language === 'en' ? 'Pending (Not Taken)' : 'قيد الانتظار (لم يتم الاستلام)'}</option>
            <option value="taken">{language === 'en' ? 'Taken' : 'مستلم'}</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
            <Package size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              {language === 'en' ? 'No items found' : 'لم يتم العثور على عناصر'}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const isTaken = item.status === "taken";
              
              return (
                <div key={item.id} className={`bg-white dark:bg-slate-900 rounded-3xl border ${isTaken ? 'border-emerald-500/30' : 'border-slate-200 dark:border-slate-800'} shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow`}>
                  
                  {/* Photo Header */}
                  <div 
                    className="h-48 w-full bg-slate-100 dark:bg-slate-800 relative group cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <img src={item.photoUrl} alt={item.description} className={`w-full h-full object-cover ${isTaken ? 'opacity-50' : ''}`} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                    </div>
                    {isTaken ? (
                      <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-md">
                        <CheckCircle size={12} />
                        {language === 'en' ? 'Claimed' : 'مستلم'}
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                        <Clock size={12} />
                        {language === 'en' ? 'Pending' : 'قيد الانتظار'}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-full">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2 mb-1">
                          {item.description}
                        </h3>
                        <div className="flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                          <MapPin size={14} />
                          {item.locationFound}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-auto">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <User size={14} />
                        {item.cashierName}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Calendar size={14} />
                        {formatDate(item.timestamp, item.localTime)}
                      </div>
                    </div>

                    {/* Action */}
                    {!isTaken && (
                      <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleMarkAsTaken(item.id)}
                          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 py-3 rounded-xl font-bold transition-all"
                        >
                          <CheckCircle size={18} />
                          {language === 'en' ? 'Mark as Taken' : 'تحديد كمستلم'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Full Image Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="relative w-full max-w-lg flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedItem(null)} 
              className="absolute -top-12 right-0 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X size={24} />
            </button>
            
            <img src={selectedItem.photoUrl} alt="Full view" className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-2xl" />
            
            <div className="w-full mt-6 bg-white/10 backdrop-blur-md rounded-2xl p-4 text-white">
              <h3 className="text-xl font-bold mb-2">{selectedItem.description}</h3>
              <p className="text-white/70 text-sm flex items-center gap-2 mb-1">
                <MapPin size={14} /> {selectedItem.locationFound}
              </p>
              <p className="text-white/70 text-sm flex items-center gap-2">
                <User size={14} /> {selectedItem.cashierName} - {formatDate(selectedItem.timestamp, selectedItem.localTime)}
              </p>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}
