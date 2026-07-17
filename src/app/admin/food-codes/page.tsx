"use client";

import React, { useState, useEffect } from "react";
import { productsDb } from "@/lib/firebase";
import { collection, doc, setDoc, onSnapshot, deleteDoc, query, orderBy } from "firebase/firestore";
import { useLanguage } from "@/context/LanguageContext";
import { showIsland } from "@/components/MobileUX/DynamicIsland";
import { Barcode, FileText, Hash, Tag, PlusCircle, Trash2, Edit2, CheckCircle, XCircle, Search } from "lucide-react";

const CATEGORIES = [
  { en: "Coffee", ar: "قهوة" },
  { en: "Sandwiches", ar: "ساندوتشات" },
  { en: "Salads", ar: "سلطات" },
  { en: "Bakery", ar: "مخبوزات" },
  { en: "Wraps", ar: "راب" },
  { en: "Pizza", ar: "بيتزا" },
  { en: "Raw Materials", ar: "مواد خام" },
  { en: "General", ar: "عام" },
];

export default function AdminFoodCodesPage() {
  const { language: lang } = useLanguage();
  const isEn = lang === "en";

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    itemId: "",
    itemCode: "",
    nameEn: "",
    nameAr: "",
    categoryEn: "Coffee",
  });

  useEffect(() => {
    const q = query(collection(productsDb, "food_codes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setItems(data);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemId || !formData.nameEn || !formData.nameAr) {
      showIsland(isEn ? "Please fill all required fields" : "يرجى تعبئة الحقول المطلوبة", { type: "error" });
      return;
    }

    setLoading(true);
    try {
      const selectedCat = CATEGORIES.find(c => c.en === formData.categoryEn) || CATEGORIES[0];
      
      const docData = {
        itemId: formData.itemId,
        itemCode: formData.itemCode || "",
        nameEn: formData.nameEn,
        nameAr: formData.nameAr,
        categoryEn: selectedCat.en,
        categoryAr: selectedCat.ar,
        createdAt: isEditing ? (items.find(i => i.id === formData.itemId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        isActive: true
      };

      const foodCodesCollection = collection(productsDb, "food_codes");
      await setDoc(doc(foodCodesCollection, formData.itemId), docData, { merge: true });

      showIsland(isEn ? "Item saved successfully!" : "تم حفظ الصنف بنجاح", { type: "success" });
      setFormData({ itemId: "", itemCode: "", nameEn: "", nameAr: "", categoryEn: "Coffee" });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showIsland(isEn ? "Failed to save item" : "فشل حفظ الصنف", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isEn ? "Are you sure you want to delete this item?" : "هل أنت متأكد من حذف هذا الصنف؟")) return;
    try {
      await deleteDoc(doc(productsDb, "food_codes", id));
      showIsland(isEn ? "Item deleted" : "تم حذف الصنف", { type: "success" });
    } catch (err) {
      console.error(err);
      showIsland(isEn ? "Error deleting item" : "حدث خطأ أثناء الحذف", { type: "error" });
    }
  };

  const toggleActive = async (item: any) => {
    try {
      const currentState = item.isActive !== false; // default true if undefined
      await setDoc(doc(productsDb, "food_codes", item.id), { isActive: !currentState }, { merge: true });
      showIsland(isEn ? `Item ${!currentState ? 'activated' : 'deactivated'}` : `تم ${!currentState ? 'تفعيل' : 'تعطيل'} الصنف`, { type: "success" });
    } catch (err) {
      console.error(err);
      showIsland(isEn ? "Error updating status" : "حدث خطأ أثناء تحديث الحالة", { type: "error" });
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      itemId: item.itemId || item.id,
      itemCode: item.itemCode || "",
      nameEn: item.nameEn || "",
      nameAr: item.nameAr || "",
      categoryEn: item.categoryEn || "Coffee",
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setFormData({ itemId: "", itemCode: "", nameEn: "", nameAr: "", categoryEn: "Coffee" });
    setIsEditing(false);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.nameEn || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.nameAr || "").includes(searchTerm) || 
      (item.itemId || "").includes(searchTerm);
    
    const matchesCat = filterCategory === "All" || item.categoryEn === filterCategory;
    
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white" style={{ direction: isEn ? "ltr" : "rtl" }}>
      <div className="max-w-[1000px] mx-auto pb-32 pt-10 px-5 relative z-10">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black m-0 text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Barcode size={32} className="text-cyan-600 dark:text-cyan-400" />
            {isEn ? "Manage Food Codes" : "إدارة أكواد الفود"}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {isEn ? "Add, edit, or remove items for the POS scanning system." : "إضافة، تعديل، أو إزالة أصناف ماسح الباركود."}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-10">
          <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden rounded-2xl shadow-sm">
            {isEditing && (
              <div className="absolute top-0 left-0 w-full bg-amber-50 dark:bg-amber-500/20 border-b border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-4 py-2 flex justify-between items-center z-10">
                <span>{isEn ? "EDIT MODE ACTIVE" : "وضع التعديل مفعل"}</span>
                <button type="button" onClick={cancelEdit} className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-white underline">
                  {isEn ? "Cancel" : "إلغاء"}
                </button>
              </div>
            )}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isEditing ? 'mt-6' : ''}`}>
              
              {/* Item ID */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest text-cyan-600 dark:text-cyan-400 uppercase flex items-center gap-2">
                  <Barcode size={14} /> {isEn ? "Barcode / Item ID *" : "الباركود / الكود التعريفي *"}
                </label>
                <input
                  type="text"
                  name="itemId"
                  value={formData.itemId}
                  onChange={handleChange}
                  placeholder="e.g. 777800"
                  disabled={isEditing}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-colors ${isEditing ? 'opacity-50 cursor-not-allowed' : 'focus:border-cyan-500'}`}
                />
              </div>

              {/* Item Code */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                  <Hash size={14} /> {isEn ? "System Code (Optional)" : "كود النظام (اختياري)"}
                </label>
                <input
                  type="text"
                  name="itemCode"
                  value={formData.itemCode}
                  onChange={handleChange}
                  placeholder="e.g. FG-000001"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Name EN */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                  <FileText size={14} /> {isEn ? "English Name *" : "الاسم بالإنجليزي *"}
                </label>
                <input
                  type="text"
                  name="nameEn"
                  value={formData.nameEn}
                  onChange={handleChange}
                  placeholder="e.g. Turkey Sandwich"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Name AR */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                  <FileText size={14} /> {isEn ? "Arabic Name *" : "الاسم بالعربي *"}
                </label>
                <input
                  type="text"
                  name="nameAr"
                  value={formData.nameAr}
                  onChange={handleChange}
                  placeholder="مثال: ساندوتش تركي"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                  <Tag size={14} /> {isEn ? "Category *" : "التصنيف *"}
                </label>
                <select
                  name="categoryEn"
                  value={formData.categoryEn}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.en} value={cat.en}>
                      {isEn ? cat.en : cat.ar}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}
          >
            {loading ? (
              isEn ? "Saving..." : "جاري الحفظ..."
            ) : isEditing ? (
              <>
                <Edit2 size={20} />
                {isEn ? "Update Item" : "تحديث الصنف"}
              </>
            ) : (
              <>
                <PlusCircle size={20} />
                {isEn ? "Add Item" : "إضافة الصنف"}
              </>
            )}
          </button>
        </form>

        {/* LIST SECTION */}
        <div className="mt-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <span className="w-2 h-6 bg-cyan-500 rounded-full inline-block mr-2" />
              {isEn ? "Available Codes" : "الأكواد المتاحة"}
              <span className="bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 px-3 py-1 rounded-full text-xs ml-2 border border-slate-200 dark:border-slate-700">{items.length}</span>
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full sm:w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors appearance-none shadow-sm"
              >
                <option value="All">{isEn ? "All Categories" : "كل التصنيفات"}</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.en} value={cat.en}>
                    {isEn ? cat.en : cat.ar}
                  </option>
                ))}
              </select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder={isEn ? "Search items..." : "بحث عن صنف..."}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 ${isEn ? 'pl-10 pr-4' : 'pr-10 pl-4'} text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 shadow-sm`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map(item => {
              const isActive = item.isActive !== false;
              return (
                <div key={item.id} className={`p-4 rounded-xl border transition-all ${isActive ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 border-red-200 dark:border-red-500/30 opacity-70'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">{isEn ? item.nameEn : item.nameAr}</h3>
                        {!isActive && (
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/30">
                            {isEn ? "Inactive" : "معطل"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mb-2 flex items-center gap-1.5">
                        <Barcode size={12} /> {item.itemId || item.id}
                        {item.itemCode && <span className="text-slate-500 ml-2">({item.itemCode})</span>}
                      </div>
                      <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        {isEn ? item.categoryEn : item.categoryAr}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 transition-colors"
                        title={isEn ? "Edit" : "تعديل"}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => toggleActive(item)}
                        className={`p-2 rounded-lg border transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border-amber-200 dark:border-amber-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/20'}`}
                        title={isActive ? (isEn ? "Deactivate" : "تعطيل") : (isEn ? "Activate" : "تفعيل")}
                      >
                        {isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 transition-colors"
                        title={isEn ? "Delete" : "حذف"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredItems.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                <p className="text-slate-500 dark:text-slate-400">{isEn ? "No food codes found." : "لا توجد أكواد."}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
