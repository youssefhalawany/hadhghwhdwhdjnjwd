"use client";

import React, { useState } from "react";
import { PageTransition } from "@/components/PageTransition";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Target, DollarSign, Activity, CheckCircle } from "lucide-react";

const mockHistoricalData = [
  { name: 'Mon', ratio: 7.2 },
  { name: 'Tue', ratio: 8.1 },
  { name: 'Wed', ratio: 7.8 },
  { name: 'Thu', ratio: 9.5 },
  { name: 'Fri', ratio: 11.2 },
  { name: 'Sat', ratio: 10.5 },
  { name: 'Sun', ratio: 8.9 },
];

export default function MarginCalculatorPage() {
  const [totalSales, setTotalSales] = useState<number>(50000);
  const [cigSales, setCigSales] = useState<number>(4500);
  const [packPrice, setPackPrice] = useState<number>(80);
  const [whatIfPacks, setWhatIfPacks] = useState<number>(0);
  const targetRatio = 0.10; // 10%

  // Current Math
  const currentRatio = totalSales > 0 ? (cigSales / totalSales) * 100 : 0;
  
  const fillData = [
    { name: "Current", value: currentRatio },
    { name: "Remaining", value: Math.max(0, 15 - currentRatio) } // Cap the gauge at 15% for visual scale
  ];

  // What-If Math
  const whatIfCigSales = cigSales + (whatIfPacks * packPrice);
  const whatIfTotalSales = totalSales + (whatIfPacks * packPrice);
  const whatIfRatio = whatIfTotalSales > 0 ? (whatIfCigSales / whatIfTotalSales) * 100 : 0;

  // How much non-cig sales needed to offset What-If and stay at 10%?
  const neededOffset = (whatIfCigSales - (targetRatio * whatIfTotalSales)) / targetRatio;
  
  const getStatusColor = (ratio: number) => {
    if (ratio < 8) return "text-emerald-500";
    if (ratio <= 10) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-8 pb-20 p-4 lg:p-8">
        <div className="border-b border-border pb-4">
          <h1 className="text-3xl font-black flex items-center gap-3 text-foreground">
            <Activity className="h-8 w-8 text-blue-500" />
            Real-Time Margin Strategy
          </h1>
          <p className="text-muted-foreground mt-2">
            Predictive intelligence for cigarette sales vs. total margin targets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs Section */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-foreground">
              <DollarSign className="h-5 w-5 text-slate-400" /> Current Metrics
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Total Sales (EGP)
                </label>
                <input
                  type="number"
                  value={totalSales || ''}
                  onChange={(e) => setTotalSales(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Cigarette Sales (EGP)
                </label>
                <input
                  type="number"
                  value={cigSales || ''}
                  onChange={(e) => setCigSales(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Avg. Pack Price (EGP)
                </label>
                <input
                  type="number"
                  value={packPrice || ''}
                  onChange={(e) => setPackPrice(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Speedometer & Status Section */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm lg:col-span-2 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-20"></div>
            
            <h2 className="text-2xl font-black mb-8 text-foreground">Current Cigarette Margin Ratio</h2>
            
            <div className="relative w-full max-w-md h-48 flex flex-col items-center justify-end">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fillData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={110}
                    outerRadius={140}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={true}
                  >
                    <Cell fill={currentRatio < 8 ? '#10b981' : currentRatio <= 10 ? '#f59e0b' : '#ef4444'} />
                    <Cell fill="var(--color-slate-800)" className="opacity-10 dark:opacity-20" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-4">
                <div className={`text-6xl font-black tracking-tighter ${getStatusColor(currentRatio)}`}>
                  {currentRatio.toFixed(1)}%
                </div>
                <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Target &le; 10.0%
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4 w-full max-w-md">
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <span className="block text-emerald-500 font-black text-lg">0-8%</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Optimal</span>
              </div>
              <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <span className="block text-amber-500 font-black text-lg">8-10%</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Warning</span>
              </div>
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <span className="block text-red-500 font-black text-lg">&gt;10%</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Critical</span>
              </div>
            </div>
          </div>
        </div>

        {/* What-If Scenario Modeler */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4"></div>
          
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-foreground">
            <Target className="h-5 w-5 text-blue-500" /> Scenario Modeler: "What-If"
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-6">
                Drag the slider to predict the impact of selling additional cigarette packs on your store's margin target.
              </p>
              
              <div className="mb-4 flex justify-between items-end">
                <label className="font-bold text-foreground">Additional Packs Sold</label>
                <span className="text-3xl font-black text-blue-500">+{whatIfPacks}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="200" 
                step="5"
                value={whatIfPacks} 
                onChange={(e) => setWhatIfPacks(Number(e.target.value))}
                className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-bold mt-2">
                <span>0</span>
                <span>200 packs</span>
              </div>
            </div>

            <div className={`rounded-2xl p-6 border ${whatIfPacks === 0 ? 'bg-muted/50 border-transparent' : neededOffset > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} transition-all`}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Projection</h3>
              
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-foreground">Predicted Ratio:</span>
                <span className={`text-2xl font-black ${getStatusColor(whatIfRatio)}`}>{whatIfRatio.toFixed(1)}%</span>
              </div>

              {whatIfPacks > 0 ? (
                <>
                  <div className="w-full h-[1px] bg-border my-4"></div>
                  {neededOffset > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-foreground leading-relaxed">
                        To offset these packs and stay &le; 10%, you <strong className="text-red-500">MUST</strong> sell an additional:
                      </p>
                      <div className="text-4xl font-black text-red-500 mt-2">
                        +{neededOffset.toFixed(0)} <span className="text-xl">EGP</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 font-bold uppercase tracking-wider">
                        in high-margin items (Coffee, Food)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        You are still in the safe zone! No immediate non-tobacco offsets required for this volume.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Move the slider to simulate additional sales.</p>
              )}
            </div>
          </div>
        </div>

        {/* Actionable Goals & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 blur-3xl rounded-full"></div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Shift Directive
            </h2>
            
            <p className="text-lg font-medium leading-relaxed mb-6">
              For every <strong className="text-red-400">1 pack</strong> of cigarettes sold right now, cashiers should upsell...
            </p>
            
            <div className="text-4xl font-black text-white">
              {Math.max(0, (packPrice / targetRatio) - packPrice).toFixed(0)} EGP
            </div>
            <p className="text-sm text-slate-400 mt-2 font-semibold">in general merchandise to maintain margins.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-foreground">
              <Activity className="h-5 w-5 text-slate-400" /> 7-Day Trend (Mock Data)
            </h2>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockHistoricalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} dx={-10} domain={[0, 15]} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: any) => [`${value}%`, 'Ratio']}
                  />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ position: 'top', value: '10% Limit', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="ratio" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-background)' }} activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </PageTransition>
  );
}
