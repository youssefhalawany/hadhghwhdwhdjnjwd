"use client";

import React, { useState, useEffect } from "react";
import { dbService } from "@/lib/firebase";
import { 
  FileText, Plus, Save, Trash2, Eye, Copy, 
  ArrowLeftRight, FileCode, Check, Settings, 
  FileDown, Landmark, Signature, Heading, Footprints, RotateCcw
} from "lucide-react";

interface ReportTemplate {
  id: string;
  name: string;
  type: string;
  fields: string[];
  qrPosition: string;
  qrSize: number;
  marginMm: number;
  pageOrientation: "Portrait" | "Landscape";
  vatRate: number;
  currency: string;
  watermarkText: string;
  customHeader: string;
  customFooter: string;
  version: number;
  updatedBy: string;
  lastUpdated: string;
}

export default function ReportBuilderPage() {
  const [role, setRole] = useState("owner");
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("invoice");
  const [fields, setFields] = useState<string[]>([]);
  const [qrPosition, setQrPosition] = useState("Bottom Right");
  const [qrSize, setQrSize] = useState(80);
  const [marginMm, setMarginMm] = useState(15);
  const [pageOrientation, setPageOrientation] = useState<"Portrait" | "Landscape">("Portrait");
  const [vatRate, setVatRate] = useState(8);
  const [currency, setCurrency] = useState("USD");
  const [watermarkText, setWatermarkText] = useState("CIRCLE K CONFIDENTIAL");
  const [customHeader, setCustomHeader] = useState("Circle K Franchise Corporation");
  const [customFooter, setCustomFooter] = useState("Thank you for shopping with us! Standard verification applies.");

  useEffect(() => {
    // Read simulation role
    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);

    const handleRoleChange = (e: any) => {
      setRole(e.detail);
    };
    window.addEventListener("circlek_role_changed", handleRoleChange);

    // Subscribe to templates updates
    const unsubscribe = dbService.onSnapshot("templates", (data) => {
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        handleSelectTemplate(data[0]);
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener("circlek_role_changed", handleRoleChange);
      unsubscribe();
    };
  }, []);

  function handleSelectTemplate(temp: ReportTemplate) {
    setSelectedTemplate(temp);
    setName(temp.name);
    setType(temp.type);
    setFields(temp.fields || []);
    setQrPosition(temp.qrPosition || "Bottom Right");
    setQrSize(temp.qrSize || 80);
    setMarginMm(temp.marginMm || 15);
    setPageOrientation(temp.pageOrientation || "Portrait");
    setVatRate(temp.vatRate || 8);
    setCurrency(temp.currency || "USD");
    setWatermarkText(temp.watermarkText || "CIRCLE K CONFIDENTIAL");
    setCustomHeader(temp.customHeader || "");
    setCustomFooter(temp.customFooter || "");
    
    // Simulate retrieving version history
    setVersionHistory([
      { version: temp.version, date: temp.lastUpdated || new Date().toISOString(), updatedBy: temp.updatedBy || "karim@circlek.com", action: "Current Active Version" },
      { version: temp.version - 1 > 0 ? temp.version - 1 : 1, date: new Date(Date.now() - 86400000).toISOString(), updatedBy: "ahmed@circlek.com", action: "Added automatic discount formulas" }
    ].filter(v => v.version > 0));
  }

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setName("New Report Template");
    setType("sales");
    setFields(["company_logo", "company_info", "totals_table", "qr_code"]);
    setQrPosition("Bottom Right");
    setQrSize(80);
    setMarginMm(15);
    setPageOrientation("Portrait");
    setVatRate(8);
    setCurrency("USD");
    setWatermarkText("INTERNAL AUDIT");
    setCustomHeader("Circle K Retail Store Division");
    setCustomFooter("Proprietary document for compliance monitoring only.");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Template name is required");
      return;
    }

    // Role restrictions switcher test
    if (role === "viewer" || role === "cashier" || role === "warehouse") {
      alert(`Access Denied: Role "${role.toUpperCase()}" does not have permissions to modify layouts.`);
      return;
    }

    const tData: Partial<ReportTemplate> = {
      name,
      type,
      fields,
      qrPosition,
      qrSize: Number(qrSize),
      marginMm: Number(marginMm),
      pageOrientation,
      vatRate: Number(vatRate),
      currency,
      watermarkText,
      customHeader,
      customFooter,
      version: selectedTemplate ? selectedTemplate.version + 1 : 1,
      updatedBy: role === "owner" ? "karim@circlek.com" : "ahmed@circlek.com",
      lastUpdated: new Date().toISOString()
    };

    if (selectedTemplate) {
      await dbService.updateDoc("templates", selectedTemplate.id, tData);
      alert(`Template "${name}" upgraded to Version ${tData.version} successfully!`);
    } else {
      const newDoc = await dbService.addDoc("templates", tData);
      handleSelectTemplate(newDoc);
      alert(`New Template "${name}" registered successfully!`);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (role === "viewer" || role === "cashier" || role === "warehouse") {
      alert(`Access Denied: Role "${role.toUpperCase()}" cannot delete template designs.`);
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${selectedTemplate.name}"?`)) {
      await dbService.deleteDoc("templates", selectedTemplate.id);
      setSelectedTemplate(null);
      setName("");
      alert("Template deleted successfully");
    }
  };

  const toggleField = (field: string) => {
    if (fields.includes(field)) {
      setFields(fields.filter(f => f !== field));
    } else {
      setFields([...fields, field]);
    }
  };

  // Reusable Variables Library
  const variables = [
    { label: "Company Title", var: "{{companyName}}" },
    { label: "Branch Name", var: "{{branchName}}" },
    { label: "Employee Name", var: "{{employeeName}}" },
    { label: "Date/Time Generated", var: "{{dateTime}}" },
    { label: "Transaction Subtotal", var: "{{subtotal}}" },
    { label: "Tax Amount", var: "{{taxAmount}}" },
    { label: "Grand Total Value", var: "{{grandTotal}}" },
    { label: "Cryptographic SHA Hash", var: "{{integrityHash}}" },
    { label: "Validation Short Link", var: "{{verificationLink}}" }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent uppercase">
            Document Report Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Design, duplicate, and manage corporate PDF/A4 printable invoice templates.
          </p>
        </div>

        <button
          id="btn-create-template"
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-semibold hover:scale-[1.02] transition-transform text-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create New Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Template Selection list */}
        <div className="glass-panel p-4 rounded-xl lg:col-span-3 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Active Layouts</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading layouts...</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No templates registered.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(temp => (
                <button
                  key={temp.id}
                  id={`temp-select-${temp.id}`}
                  onClick={() => {
                    handleSelectTemplate(temp);
                    setIsEditing(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-between ${
                    selectedTemplate?.id === temp.id
                      ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-500"
                      : "bg-muted/30 border-border text-foreground hover:bg-muted/80"
                  }`}
                >
                  <span className="truncate">{temp.name}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                    v{temp.version}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick variables helper panel */}
          <div className="pt-4 border-t border-border space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <FileCode className="h-3.5 w-3.5" /> Variables Library
            </h4>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Click any placeholder below to auto-inject dynamic properties:
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {variables.map(v => (
                <button
                  key={v.var}
                  onClick={() => {
                    navigator.clipboard.writeText(v.var);
                    alert(`Copied "${v.var}" to clipboard!`);
                  }}
                  className="w-full text-left px-2 py-1 bg-muted rounded font-mono text-[9px] hover:bg-red-500/10 hover:text-red-500 transition-colors truncate"
                  title="Click to copy variable"
                >
                  <span className="font-bold text-foreground mr-1">{v.label}:</span>
                  {v.var}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Configuration Panel */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings className="h-4 w-4" /> Layout Settings
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                title="Version History"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              {selectedTemplate && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 border border-red-500/30 hover:border-red-500 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete Template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {showHistory ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-red-500">Version History</h4>
                <button onClick={() => setShowHistory(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Back
                </button>
              </div>
              <div className="space-y-3">
                {versionHistory.map((v, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-lg border border-border space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Version {v.version}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(v.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Modified by: {v.updatedBy}</p>
                    <p className="text-xs italic text-foreground mt-1">"{v.action}"</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Template Name</label>
                <input
                  id="input-template-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Orientation</label>
                  <select
                    id="select-template-orientation"
                    value={pageOrientation}
                    onChange={(e) => setPageOrientation(e.target.value as any)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                  >
                    <option value="Portrait">Portrait (A4)</option>
                    <option value="Landscape">Landscape (A4)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Margin (mm)</label>
                  <input
                    id="input-template-margin"
                    type="number"
                    value={marginMm}
                    onChange={(e) => setMarginMm(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">VAT Rate (%)</label>
                  <input
                    id="input-template-vat"
                    type="number"
                    value={vatRate}
                    onChange={(e) => setVatRate(Number(e.target.value))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Currency</label>
                  <select
                    id="select-template-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EGP">EGP (LE)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Watermark Text</label>
                <input
                  id="input-template-watermark"
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-muted-foreground">Conditional Sections</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: "company_logo", label: "Corporate Logo" },
                    { key: "company_info", label: "Store Info Header" },
                    { key: "totals_table", label: "Dynamic Totals" },
                    { key: "qr_code", label: "Secure QR Link" },
                    { key: "terms", label: "Terms & Policies" },
                    { key: "signatures", label: "Sign-off Blocks" }
                  ].map(item => (
                    <label 
                      key={item.key} 
                      className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/60 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(item.key)}
                        onChange={() => toggleField(item.key)}
                        className="rounded accent-red-500"
                      />
                      <span className="font-medium text-foreground">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Custom Header Banner Text</label>
                <input
                  id="input-template-header"
                  type="text"
                  value={customHeader}
                  onChange={(e) => setCustomHeader(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Footer Notes</label>
                <textarea
                  id="input-template-footer"
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground outline-none h-16 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  id="btn-save-template"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Save Draft (v{selectedTemplate ? selectedTemplate.version + 1 : 1})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live A4 Mockup Preview */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-4 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-4 w-4" /> Live Document Mockup
          </h3>

          <div className="w-full bg-zinc-800 p-4 rounded-xl flex items-center justify-center border border-border shadow-inner">
            {/* The simulated page sheet */}
            <div 
              className={`bg-white text-zinc-950 p-4 border border-zinc-300 shadow-md relative overflow-hidden transition-all duration-300 ${
                pageOrientation === "Portrait" 
                  ? "w-64 h-[360px]" 
                  : "w-[360px] h-64"
              }`}
              style={{ fontSize: "7px" }}
            >
              {/* Watermark overlay */}
              {watermarkText && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none select-none z-0">
                  <span className="text-[20px] font-black tracking-widest rotate-45 text-black">
                    {watermarkText}
                  </span>
                </div>
              )}

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  {/* Header */}
                  {fields.includes("company_logo") && (
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-1 mb-2">
                      <div className="h-5 w-5 bg-red-600 flex items-center justify-center font-black text-white text-[8px] border-2 border-orange-500 rounded-full">
                        K
                      </div>
                      <span className="font-bold text-zinc-800 text-[6px]">{customHeader || "Circle K Franchise"}</span>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-zinc-100 pb-1">
                      <span className="font-bold uppercase">Store Audit Report</span>
                      <span className="text-zinc-500 font-mono">ID: CK-TEMP-v{selectedTemplate?.version || 1}</span>
                    </div>

                    <div className="space-y-1 text-zinc-500">
                      <p>Branch: Circle K #4702 - Downtown</p>
                      <p>Tax configuration: {vatRate}% VAT Included</p>
                      <p>Reporting Base currency: {currency}</p>
                    </div>

                    <div className="mt-3">
                      <div className="grid grid-cols-4 font-bold border-b border-zinc-200 pb-0.5">
                        <span className="col-span-2">Desc</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Total</span>
                      </div>
                      <div className="grid grid-cols-4 border-b border-zinc-100 py-0.5 text-zinc-600">
                        <span className="col-span-2">Unleaded 91 Fuel</span>
                        <span className="text-right">15.0G</span>
                        <span className="text-right">$52.35</span>
                      </div>
                      <div className="grid grid-cols-4 border-b border-zinc-100 py-0.5 text-zinc-600">
                        <span className="col-span-2">CK Premium Coffee</span>
                        <span className="text-right">2</span>
                        <span className="text-right">$4.58</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  {/* Summary Totals Table */}
                  {fields.includes("totals_table") && (
                    <div className="border-t border-zinc-300 pt-1 flex justify-end">
                      <div className="w-24 space-y-0.5 text-right font-semibold">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>$56.93</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-bold border-t border-zinc-500 pt-0.5 text-[8px]">
                          <span>Grand Total:</span>
                          <span>$61.48</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer & QR */}
                  <div className="flex items-end justify-between border-t border-zinc-200 pt-2 mt-2">
                    <div className="w-48 text-[5px] text-zinc-400 leading-tight">
                      <p className="truncate">{customFooter}</p>
                      <p className="mt-0.5 font-mono">Verification: verify.circlek-reports.com/verify/tok_...</p>
                    </div>

                    {fields.includes("qr_code") && (
                      <div className="h-7 w-7 bg-zinc-200 border border-zinc-300 flex items-center justify-center font-bold text-[5px]">
                        QR
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
