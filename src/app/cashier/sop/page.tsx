"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Search, ArrowLeft, BookOpen, ChefHat, AlertTriangle, Info, ListChecks, Pizza } from "lucide-react";
import { SOP_DATA, SOPCategory } from "@/data/sopData";

const D = {
  bg: "#0B1121",        
  surface: "#151E32",   
  surfaceHigh: "#1C2841",
  border: "rgba(34, 211, 238, 0.15)",
  borderMid: "rgba(34, 211, 238, 0.25)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.15)",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  cyan: "#22d3ee",
  cyanDim: "rgba(34, 211, 238, 0.1)",
  cyanBorder: "rgba(34, 211, 238, 0.25)",
};

export default function CashierSOPPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SOPCategory | "All">("All");

  // Extract unique categories from data
  const categories = ["All", ...Array.from(new Set(SOP_DATA.map(item => item.categoryEn)))] as (SOPCategory | "All")[];

  // Filter logic
  const filteredSOPs = SOP_DATA.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.categoryEn === activeCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      item.titleEn.toLowerCase().includes(query) ||
      item.titleAr.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ backgroundColor: D.bg, minHeight: "100vh", color: D.textPrimary, fontFamily: "'Inter', sans-serif" }} dir={isEn ? "ltr" : "rtl"}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", backgroundColor: D.surface, borderBottom: `1px solid ${D.border}`, position: "sticky", top: 0, zIndex: 50, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button 
            onClick={() => router.push("/cashier")}
            style={{ 
              width: 40, height: 40, borderRadius: "50%", backgroundColor: D.surfaceHigh, border: `1px solid ${D.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", color: D.cyan, cursor: "pointer",
              transform: isEn ? "none" : "rotate(180deg)"
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={24} color={D.cyan} />
              {isEn ? "Food SOP" : "إجراءات التشغيل القياسية"}
            </h1>
            <p style={{ fontSize: 13, color: D.textSecondary, margin: "2px 0 0 0" }}>
              {isEn ? "Standard Operating Procedures & Recipes" : "التعليمات والوصفات القياسية للمطعم"}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [isEn ? "left" : "right"]: 16, color: D.textSecondary }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? "Search recipes, ingredients, instructions..." : "ابحث عن الوصفات، المكونات، التعليمات..."}
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
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            let displayCat = cat;
            if (!isEn) {
              if (cat === "All") displayCat = "الكل";
              if (cat === "Bakery") displayCat = "البيكري";
              if (cat === "Pizza") displayCat = "البيتزا";
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
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 100 }}>
        {filteredSOPs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: D.textSecondary }}>
            <ChefHat size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>
              {isEn ? "No SOPs found matching your search." : "لم يتم العثور على نتائج تطابق بحثك."}
            </p>
          </div>
        ) : (
          filteredSOPs.map((item) => (
            <div key={item.id} style={{ 
              backgroundColor: D.surface, borderRadius: 24, border: `1px solid ${D.border}`, overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}>
              {/* Card Header */}
              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${D.border}`, backgroundColor: D.surfaceHigh }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ padding: "4px 10px", borderRadius: 8, backgroundColor: D.cyanDim, color: D.cyan, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {isEn ? item.categoryEn : item.categoryAr}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: D.textPrimary, lineHeight: 1.4 }}>
                  {isEn ? item.titleEn : item.titleAr}
                </h2>
              </div>

              {/* Card Blocks */}
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
                {item.blocks.map((block, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    
                    {/* Block Title if exists */}
                    {(block.titleEn || block.titleAr) && (
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: block.type === 'warning' ? D.red : D.cyan, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        {block.type === 'warning' && <AlertTriangle size={18} />}
                        {block.type === 'highlight' && <Info size={18} />}
                        {block.type === 'recipe-table' && <Pizza size={18} />}
                        {block.type === 'list' && <ListChecks size={18} />}
                        {isEn ? block.titleEn : block.titleAr}
                      </h3>
                    )}

                    {/* Content Rendering based on type */}
                    {block.type === 'warning' && (
                      <div style={{ backgroundColor: D.redDim, border: `1px solid ${D.redBorder}`, borderRadius: 16, padding: 16 }}>
                        <ul style={{ margin: 0, paddingInlineStart: 24, display: "flex", flexDirection: "column", gap: 10, color: D.textPrimary }}>
                          {(isEn ? block.itemsEn : block.itemsAr)?.map((li, i) => (
                            <li key={i} style={{ fontSize: 14, lineHeight: 1.6, fontWeight: 500 }}>{li}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {block.type === 'highlight' && (
                      <div style={{ backgroundColor: D.cyanDim, border: `1px solid ${D.cyanBorder}`, borderRadius: 16, padding: 16 }}>
                        <ul style={{ margin: 0, paddingInlineStart: 24, display: "flex", flexDirection: "column", gap: 10, color: D.cyan }}>
                          {(isEn ? block.itemsEn : block.itemsAr)?.map((li, i) => (
                            <li key={i} style={{ fontSize: 14, lineHeight: 1.6, fontWeight: 600 }}>{li}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {block.type === 'list' && (
                      <ol style={{ margin: 0, paddingInlineStart: 24, display: "flex", flexDirection: "column", gap: 12, color: D.textSecondary }}>
                        {(isEn ? block.itemsEn : block.itemsAr)?.map((li, i) => (
                          <li key={i} style={{ fontSize: 15, lineHeight: 1.6, color: D.textPrimary }}>
                            <span style={{ opacity: 0.9 }}>{li}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {block.type === 'text' && (
                      <p style={{ fontSize: 15, lineHeight: 1.6, color: D.textPrimary, margin: 0 }}>
                        {isEn ? block.textEn : block.textAr}
                      </p>
                    )}

                    {block.type === 'recipe-table' && block.tableData && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {block.tableData.map((recipe: any, rIdx: number) => (
                          <div key={rIdx} style={{ overflow: "hidden", borderRadius: 16, border: `1px solid ${D.borderMid}`, backgroundColor: D.surfaceHigh }}>
                            <div style={{ padding: "12px 16px", backgroundColor: "rgba(0,0,0,0.2)", borderBottom: `1px solid ${D.borderMid}`, fontSize: 15, fontWeight: 700, color: D.cyan }}>
                              {isEn ? recipe.nameEn : recipe.nameAr}
                            </div>
                            <div style={{ padding: 16 }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ color: D.textSecondary, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${D.border}` }}>
                                    <th style={{ textAlign: isEn ? "left" : "right", paddingBottom: 8 }}>{isEn ? "Ingredient" : "المكونات"}</th>
                                    <th style={{ textAlign: "center", paddingBottom: 8 }}>{isEn ? "Qty" : "الكمية"}</th>
                                    <th style={{ textAlign: "center", paddingBottom: 8 }}>{isEn ? "Unit" : "الوحدة"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recipe.ingredients.map((ing: any, iIdx: number) => (
                                    <tr key={iIdx} style={{ borderBottom: iIdx === recipe.ingredients.length - 1 ? "none" : `1px solid rgba(255,255,255,0.05)` }}>
                                      <td style={{ padding: "10px 0", fontSize: 14, color: D.textPrimary }}>{isEn ? ing.nameEn : ing.nameAr}</td>
                                      <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 700, color: D.textPrimary, textAlign: "center" }}>{ing.qty}</td>
                                      <td style={{ padding: "10px 0", fontSize: 13, color: D.textSecondary, textAlign: "center" }}>{isEn ? ing.unit : "جرام"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
