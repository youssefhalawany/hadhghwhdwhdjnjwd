"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { 
  ChevronLeft, Search, Barcode, Coffee, Pizza, Croissant, Hash
} from "lucide-react";
import BarcodeComponent from "react-barcode";
import { productsDb } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const D = {
  bg: "#0B1121",        
  surface: "#151E32",   
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
};

interface FoodCode {
  id: string;
  itemId: string;
  itemCode: string;
  nameEn: string;
  nameAr: string;
  categoryEn: string;
  categoryAr: string;
}

export default function FoodCodesPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [items, setItems] = useState<FoodCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(["All"]);

  useEffect(() => {
    async function fetchData() {
      try {
        const q = query(collection(productsDb, "food_codes"), orderBy("nameEn"));
        const snapshot = await getDocs(q);
        const docs: FoodCode[] = [];
        const cats = new Set<string>(["All"]);

        snapshot.forEach(doc => {
          const data = doc.data() as FoodCode;
          docs.push({ ...data, id: doc.id });
          if (data.categoryEn) {
            cats.add(data.categoryEn);
          }
        });

        setItems(docs);
        setCategories(Array.from(cats));
      } catch (error) {
        console.error("Error fetching food codes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter logic
  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.categoryEn === activeCategory;
    const queryStr = searchQuery.toLowerCase();
    const matchesSearch = 
      (item.nameEn && item.nameEn.toLowerCase().includes(queryStr)) ||
      (item.nameAr && item.nameAr.toLowerCase().includes(queryStr)) ||
      (item.itemId && item.itemId.toLowerCase().includes(queryStr)) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(queryStr));

    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: D.bg, fontFamily: "sans-serif" }} dir={isEn ? "ltr" : "rtl"}>
      {/* Header */}
      <div style={{ 
        position: "sticky", top: 0, zIndex: 50, backgroundColor: "rgba(11, 17, 33, 0.8)",
        backdropFilter: "blur(12px)", borderBottom: `1px solid ${D.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
          <button 
            onClick={() => router.push("/cashier")}
            style={{ 
              width: 40, height: 40, borderRadius: 12, backgroundColor: D.surface, 
              border: `1px solid ${D.borderMid}`, color: D.textPrimary,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            <ChevronLeft size={24} style={{ transform: isEn ? "none" : "rotate(180deg)" }} />
          </button>
          
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: D.textPrimary, margin: 0 }}>
              {isEn ? "Food & Coffee Codes" : "أكواد الفود والقهوة"}
            </h1>
            <p style={{ fontSize: 12, color: D.textSecondary, margin: "4px 0 0 0" }}>
              {isEn ? "Scan directly from screen" : "يمكنك المسح مباشرة من الشاشة"}
            </p>
          </div>
          
          <div style={{ width: 40 }} />
        </div>

        {/* Search */}
        <div style={{ padding: "0 20px 16px 20px", position: "relative" }}>
          <div style={{ position: "absolute", top: 12, [isEn ? "left" : "right"]: 36, color: D.textSecondary }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? "Search items, codes..." : "ابحث عن الأصناف، الأكواد..."}
            style={{
              width: "100%", padding: `12px ${isEn ? "44px" : "16px"} 12px ${isEn ? "16px" : "44px"}`,
              backgroundColor: D.surfaceHigh, border: `1px solid ${D.borderMid}`, borderRadius: 16,
              color: D.textPrimary, fontSize: 15, outline: "none", transition: "all 0.2s"
            }}
            onFocus={(e) => e.target.style.borderColor = D.cyan}
            onBlur={(e) => e.target.style.borderColor = D.borderMid}
          />
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 16px 20px", scrollbarWidth: "none" }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            let displayCat = cat;
            if (!isEn) {
              if (cat === "All") displayCat = "الكل";
              else if (cat === "Sandwiches") displayCat = "ساندوتشات";
              else if (cat === "Salads") displayCat = "سلطات";
              else if (cat === "Coffee") displayCat = "قهوة";
              else if (cat === "Bakery") displayCat = "مخبوزات";
              else if (cat === "Wraps") displayCat = "راب";
              else if (cat === "Pizza") displayCat = "بيتزا";
              else if (cat === "Raw Materials") displayCat = "مواد خام";
              else if (cat === "General") displayCat = "عام";
            }
            
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 20px", borderRadius: 20, whiteSpace: "nowrap", fontSize: 14, fontWeight: 600,
                  backgroundColor: isActive ? D.cyanDim : D.surfaceHigh,
                  color: isActive ? D.cyan : D.textSecondary,
                  border: `1px solid ${isActive ? D.cyanBorder : "transparent"}`,
                  transition: "all 0.2s", cursor: "pointer"
                }}
              >
                {displayCat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, paddingBottom: 100 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: D.textSecondary, gridColumn: "1 / -1" }}>
            <Coffee size={40} style={{ opacity: 0.2, margin: "0 auto 16px auto" }} />
            <p>{isEn ? "Loading codes..." : "جاري تحميل الأكواد..."}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: D.textSecondary, gridColumn: "1 / -1" }}>
            <Barcode size={40} style={{ opacity: 0.2, margin: "0 auto 16px auto" }} />
            <p>{isEn ? "No items found matching your search." : "لم يتم العثور على أي صنف مطابق لبحثك."}</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} style={{ 
              backgroundColor: D.surface, border: `1px solid ${D.borderMid}`, 
              borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column"
            }}>
              {/* Header: Names */}
              <div style={{ padding: "16px", borderBottom: `1px solid ${D.border}`, backgroundColor: D.surfaceHigh }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: D.textPrimary, margin: "0 0 4px 0", lineHeight: 1.4 }}>
                  {item.nameAr || item.nameEn}
                </h3>
                <p style={{ fontSize: 13, color: D.textSecondary, margin: 0, lineHeight: 1.4 }}>
                  {item.nameEn}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: D.cyan, backgroundColor: D.cyanDim, padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                    {isEn ? item.categoryEn : item.categoryAr}
                  </span>
                  {item.itemCode && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: D.textSecondary, backgroundColor: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      <Hash size={12} />
                      {item.itemCode}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Barcode Section */}
              <div style={{ 
                padding: "24px 16px", display: "flex", flexDirection: "column", 
                alignItems: "center", justifyContent: "center", backgroundColor: "#fff"
              }}>
                <div style={{ transform: "scale(1.1)", transformOrigin: "center" }}>
                  <BarcodeComponent 
                    value={item.itemId || "00000"} 
                    format="CODE128"
                    width={2}
                    height={60}
                    displayValue={false}
                    margin={0}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                </div>
                <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, letterSpacing: "0.2em", color: "#000", textAlign: "center" }}>
                  {item.itemId}
                </div>
                <p style={{ fontSize: 10, color: "#666", margin: "4px 0 0 0", textAlign: "center" }}>
                  {isEn ? "Scan this barcode at the POS" : "قم بمسح هذا الباركود على جهاز الكاشير"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
