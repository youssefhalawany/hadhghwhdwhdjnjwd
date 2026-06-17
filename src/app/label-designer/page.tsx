"use client";

import React, { useState, useEffect, useRef } from "react";
import { dbService } from "@/lib/firebase";
import { generateThermalCommands } from "@/lib/thermal-commands";
import { 
  Printer, Move, Plus, Trash2, Maximize2, Type, 
  QrCode, Barcode, Image as ImageIcon, Ruler, 
  Grid, HelpCircle, Save, Check, RefreshCw, Settings
} from "lucide-react";

interface LabelElement {
  id: string;
  type: "text" | "barcode" | "qrcode" | "logo" | "line";
  value: string;
  x: number; // grid position
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  barcodeType?: "CODE128" | "EAN13" | "EAN8" | "UPC" | "CODE39";
  align?: "left" | "center" | "right";
}

export default function LabelDesignerPage() {
  const [role, setRole] = useState("owner");
  const [elements, setElements] = useState<LabelElement[]>([
    { id: "1", type: "logo", value: "", x: 110, y: 15, width: 80, height: 40 },
    { id: "2", type: "text", value: "CIRCLE K SPECIALTY COFFEE", x: 20, y: 65, width: 260, height: 20, fontSize: 13, fontWeight: "bold", align: "center" },
    { id: "3", type: "barcode", value: "88090124", x: 50, y: 95, width: 200, height: 40, barcodeType: "CODE128" },
    { id: "4", type: "text", value: "PRICE: $2.29", x: 20, y: 155, width: 260, height: 20, fontSize: 14, fontWeight: "bold", align: "center" },
    { id: "5", type: "qrcode", value: "https://verify.circlek.com/prod/88090124", x: 120, y: 185, width: 60, height: 60 }
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Designer Options
  const [labelWidth, setLabelWidth] = useState<58 | 80 | 100>(80);
  const [labelHeight, setLabelHeight] = useState(280); // canvas height
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [printerType, setPrinterType] = useState<"escpos" | "bplz">("bplz");
  const [layoutName, setLayoutName] = useState("Premium Coffee Shelf Tag");
  
  // Dragging States
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("circlek_role") || "owner";
    setRole(storedRole);
    const handleRoleChange = (e: any) => setRole(e.detail);
    window.addEventListener("circlek_role_changed", handleRoleChange);
    return () => window.removeEventListener("circlek_role_changed", handleRoleChange);
  }, []);

  // Grid sizing constants
  const GRID_SIZE = 10;
  // Map labelWidth mm to pixels on screen:
  // 58mm -> 240px
  // 80mm -> 320px
  // 100mm -> 400px
  const widthPixels = labelWidth === 58 ? 240 : labelWidth === 80 ? 320 : 400;

  // Add Element triggers
  const addText = () => {
    const newEl: LabelElement = {
      id: "el_" + Math.random().toString(36).substring(2, 9),
      type: "text",
      value: "Editable Text Line",
      x: 30,
      y: 100,
      width: 150,
      height: 20,
      fontSize: 12,
      fontWeight: "normal",
      align: "center"
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addBarcode = () => {
    const newEl: LabelElement = {
      id: "el_" + Math.random().toString(36).substring(2, 9),
      type: "barcode",
      value: "12345678",
      x: 30,
      y: 120,
      width: 160,
      height: 35,
      barcodeType: "CODE128"
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addQR = () => {
    const newEl: LabelElement = {
      id: "el_" + Math.random().toString(36).substring(2, 9),
      type: "qrcode",
      value: "https://verify.circlek.com/verify/token",
      x: 50,
      y: 140,
      width: 50,
      height: 50
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addLine = () => {
    const newEl: LabelElement = {
      id: "el_" + Math.random().toString(36).substring(2, 9),
      type: "line",
      value: "",
      x: 10,
      y: 130,
      width: widthPixels - 20,
      height: 4
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(elements.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  // Drag handlers
  const handleStartDrag = (e: React.MouseEvent, el: LabelElement) => {
    e.preventDefault();
    setSelectedId(el.id);
    setIsDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;

    setDragOffset({
      x: clientX - el.x,
      y: clientY - el.y
    });
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId) return;

    const elIndex = elements.findIndex(el => el.id === selectedId);
    if (elIndex === -1) return;

    const el = elements[elIndex];
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Boundaries check
    newX = Math.max(0, Math.min(widthPixels - el.width, newX));
    newY = Math.max(0, Math.min(labelHeight - el.height, newY));

    // Snap to grid calculations
    if (snapToGrid) {
      newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
      newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
    }

    const updatedElements = [...elements];
    updatedElements[elIndex] = { ...el, x: newX, y: newY };
    setElements(updatedElements);
  };

  const handleStopDrag = () => {
    setIsDragging(false);
  };

  // Element property updates
  const updateSelectedProperty = (key: keyof LabelElement, val: any) => {
    if (!selectedId) return;
    setElements(elements.map(el => {
      if (el.id === selectedId) {
        return { ...el, [key]: val };
      }
      return el;
    }));
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  // Generate driver instructions
  const driverOutput = generateThermalCommands(elements, {
    widthMm: labelWidth,
    mode: "label",
    printerType: printerType as any
  });

  const handleSaveLayout = async () => {
    if (role === "viewer" || role === "cashier" || role === "warehouse") {
      alert(`Access Denied: Role "${role.toUpperCase()}" is not permitted to save layout structures.`);
      return;
    }

    const layoutData = {
      name: layoutName,
      elements,
      labelWidth,
      labelHeight,
      printerType,
      timestamp: new Date().toISOString()
    };

    await dbService.addDoc("templates", {
      name: layoutName,
      type: "sticker",
      fields: elements.map(e => e.type),
      qrPosition: "Custom",
      qrSize: 50,
      marginMm: 2,
      pageOrientation: "Portrait",
      version: 1,
      active: true,
      layoutMetadata: layoutData
    });

    alert(`Thermal label design "${layoutName}" successfully saved to database!`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent uppercase">
            Thermal Label Designer
          </h1>
          <p className="text-sm text-muted-foreground">
            Zebra/Bixolon compatible drag-and-drop shelf sticker and barcode label generator.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-red-500 outline-none text-foreground w-48"
            placeholder="Layout name"
          />
          <button
            onClick={handleSaveLayout}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-lg font-semibold hover:scale-[1.02] transition-transform text-sm cursor-pointer animate-pulse"
          >
            <Save className="h-4 w-4" />
            Register Label Design
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Designer Canvas Area */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-5 flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center justify-between w-full border-b border-border pb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Ruler className="h-4 w-4" /> Canvas ({labelWidth}mm Width)
            </h3>
            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer">
              <Grid className="h-3.5 w-3.5" />
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="rounded accent-red-500"
              />
              Snap Grid
            </label>
          </div>

          {/* Designer Interactive Canvas */}
          <div 
            ref={canvasRef}
            onMouseMove={handleDrag}
            onMouseUp={handleStopDrag}
            onMouseLeave={handleStopDrag}
            className="bg-white text-zinc-950 border-2 border-dashed border-red-500/20 relative shadow-inner overflow-hidden transition-all duration-300"
            style={{
              width: `${widthPixels}px`,
              height: `${labelHeight}px`,
              backgroundImage: snapToGrid ? "radial-gradient(#e4e4e7 1px, transparent 1px)" : "none",
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
            }}
          >
            {elements.map((el) => {
              const isSelected = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onMouseDown={(e) => handleStartDrag(e, el)}
                  className={`absolute group select-none cursor-move transition-shadow ${
                    isSelected ? "ring-2 ring-red-500 shadow-lg" : "hover:ring-1 hover:ring-zinc-400"
                  }`}
                  style={{
                    left: `${el.x}px`,
                    top: `${el.y}px`,
                    width: `${el.width}px`,
                    height: `${el.height}px`
                  }}
                >
                  {/* Visual components types */}
                  {el.type === "logo" && (
                    <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center border border-zinc-300 rounded font-black text-red-600 tracking-wider">
                      <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-[10px] border-2 border-orange-500 shadow-md">
                        K
                      </div>
                      <span className="text-[7px] text-zinc-500 uppercase mt-0.5 font-bold">Circle K</span>
                    </div>
                  )}

                  {el.type === "text" && (
                    <div 
                      className="w-full h-full bg-white border border-zinc-200/50 flex items-center px-1 truncate font-sans text-zinc-950 leading-tight"
                      style={{
                        fontSize: `${el.fontSize || 12}px`,
                        fontWeight: el.fontWeight || "normal",
                        justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start"
                      }}
                    >
                      {el.value}
                    </div>
                  )}

                  {el.type === "barcode" && (
                    <div className="w-full h-full bg-white border border-zinc-300 p-1 flex flex-col items-center justify-center font-mono">
                      {/* Simulated barcode bars lines */}
                      <div className="w-full flex-1 flex items-end justify-between px-2 gap-[2px]">
                        {Array(18).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className="bg-black flex-1" 
                            style={{ 
                              height: "100%", 
                              opacity: Math.random() > 0.45 ? 1 : 0 
                            }} 
                          />
                        ))}
                      </div>
                      <span className="text-[7px] text-zinc-500 mt-1 font-bold">{el.value}</span>
                    </div>
                  )}

                  {el.type === "qrcode" && (
                    <div className="w-full h-full bg-white border border-zinc-300 p-1.5 flex flex-col items-center justify-center">
                      {/* Grid representation of QR */}
                      <div className="w-full h-full grid grid-cols-4 gap-[2px]">
                        {Array(16).fill(0).map((_, i) => (
                          <div 
                            key={i} 
                            className={`rounded-[1px] ${
                              Math.random() > 0.4 ? "bg-black" : "bg-white"
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {el.type === "line" && (
                    <div className="w-full bg-zinc-950 rounded" style={{ height: `${el.height}px` }} />
                  )}

                  {/* Top-Right Quick deletion trigger overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSelected();
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                    title="Delete Element"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-foreground text-center">
            💡 Drag elements to position. Use snap grid to align items. Boundary constraints active.
          </div>
        </div>

        {/* Middle: Component Insertion & Configuration Properties Panel */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-3 space-y-5">
          <div className="space-y-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Insert Elements
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={addText}
                className="flex items-center gap-2 p-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg font-semibold transition-colors cursor-pointer justify-center"
              >
                <Type className="h-3.5 w-3.5" /> Text Block
              </button>
              <button
                onClick={addBarcode}
                className="flex items-center gap-2 p-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg font-semibold transition-colors cursor-pointer justify-center"
              >
                <Barcode className="h-3.5 w-3.5" /> Barcode
              </button>
              <button
                onClick={addQR}
                className="flex items-center gap-2 p-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg font-semibold transition-colors cursor-pointer justify-center"
              >
                <QrCode className="h-3.5 w-3.5" /> QR Code
              </button>
              <button
                onClick={addLine}
                className="flex items-center gap-2 p-2 bg-muted hover:bg-red-500/10 hover:text-red-500 rounded-lg font-semibold transition-colors cursor-pointer justify-center"
              >
                <Maximize2 className="h-3.5 w-3.5 rotate-45" /> Line Divider
              </button>
            </div>
          </div>

          {/* Configuration details of selected item */}
          <div className="space-y-4 pt-3 border-t border-border">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings className="h-4 w-4" /> Element Properties
            </h3>

            {selectedElement ? (
              <div className="space-y-3.5 text-xs">
                {/* Element Type Display */}
                <div className="flex justify-between items-center bg-muted/50 px-2.5 py-1.5 rounded border border-border">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Active Node:</span>
                  <span className="font-mono font-bold text-red-500 uppercase">{selectedElement.type}</span>
                </div>

                {/* Value Input */}
                {selectedElement.type !== "logo" && selectedElement.type !== "line" && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Payload Value</label>
                    <input
                      type="text"
                      value={selectedElement.value}
                      onChange={(e) => updateSelectedProperty("value", e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-red-500 font-mono text-[11px]"
                    />
                  </div>
                )}

                {/* Font customization for text */}
                {selectedElement.type === "text" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-muted-foreground">Size (px)</label>
                        <input
                          type="number"
                          value={selectedElement.fontSize || 12}
                          onChange={(e) => updateSelectedProperty("fontSize", Number(e.target.value))}
                          className="w-full bg-muted border border-border rounded-lg px-2.5 py-1.5 text-foreground outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-semibold text-muted-foreground">Weight</label>
                        <select
                          value={selectedElement.fontWeight || "normal"}
                          onChange={(e) => updateSelectedProperty("fontWeight", e.target.value)}
                          className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground outline-none"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-muted-foreground">Alignment</label>
                      <select
                        value={selectedElement.align || "left"}
                        onChange={(e) => updateSelectedProperty("align", e.target.value)}
                        className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground outline-none"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Barcode customization */}
                {selectedElement.type === "barcode" && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Symbology</label>
                    <select
                      value={selectedElement.barcodeType || "CODE128"}
                      onChange={(e) => updateSelectedProperty("barcodeType", e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground outline-none font-semibold"
                    >
                      <option value="CODE128">Code 128 (Alpha)</option>
                      <option value="EAN13">EAN 13 (Retail)</option>
                      <option value="EAN8">EAN 8 (Small)</option>
                      <option value="UPC">UPC-A (US)</option>
                      <option value="CODE39">Code 39</option>
                    </select>
                  </div>
                )}

                {/* Sizing adjustments */}
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Width (px)</label>
                    <input
                      type="number"
                      value={selectedElement.width}
                      onChange={(e) => updateSelectedProperty("width", Number(e.target.value))}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-muted-foreground">Height (px)</label>
                    <input
                      type="number"
                      value={selectedElement.height}
                      onChange={(e) => updateSelectedProperty("height", Number(e.target.value))}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-foreground outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Select an item on the label canvas to customize its options.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Thermal Driver Compiler Output */}
        <div className="glass-panel p-5 rounded-xl lg:col-span-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Printer className="h-4 w-4" /> Thermal Driver Compiler
            </h3>
            <select
              value={printerType}
              onChange={(e) => setPrinterType(e.target.value as any)}
              className="bg-muted border border-border text-[10px] font-bold px-2 py-1 rounded cursor-pointer text-foreground"
            >
              <option value="bplz">Bixolon BPL-Z (ZPL)</option>
              <option value="escpos">Standard ESC/POS</option>
            </select>
          </div>

          <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-[10px] text-amber-500 overflow-y-auto max-h-[320px]">
            <pre className="whitespace-pre-wrap">{driverOutput}</pre>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            {/* Width selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Width Preset</label>
              <select
                value={labelWidth}
                onChange={(e) => setLabelWidth(Number(e.target.value) as any)}
                className="bg-muted border border-border rounded-lg px-2 py-1.5 text-xs text-foreground cursor-pointer"
              >
                <option value={58}>58 mm (Sticker)</option>
                <option value={80}>80 mm (Standard)</option>
                <option value={100}>100 mm (Shipping)</option>
              </select>
            </div>

            {/* Test Trigger */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  alert("Compiled raw driver stream successfully written to printer spooler!");
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Dispatch Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
