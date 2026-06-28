import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

calc_logic = '''
  const totalPendingMoney = pendingSettlementEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);
  const totalSettledMoney = returnHistoryEvents.reduce((sum, ev) => sum + (Number(ev[0].totalPrice) || 0), 0);

  return (
'''

content = content.replace("  return (", calc_logic, 1)

# Redesign the tabs area (around line 374 in original)
old_tabs = '''        {/* TABS */}
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border w-full md:w-fit overflow-x-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "pending" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending Returns
            {pendingReturns.length > 0 && <span className="ml-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingReturns.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("settlements")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "settlements" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending Settlements
            {pendingSettlements.length > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingSettlements.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            Return History
          </button>
        </div>'''

new_tabs = '''        {/* CORPORATE STATS & TABS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-amber-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Returns</p>
              <h3 className="text-3xl font-black">{pendingReturns.length} <span className="text-base font-medium opacity-80">items</span></h3>
            </div>
            <Truck className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-100 font-semibold text-sm uppercase tracking-wider mb-1">Pending Settlements</p>
              <h3 className="text-3xl font-black">{totalPendingMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <FileText className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-emerald-100 font-semibold text-sm uppercase tracking-wider mb-1">Settled History</p>
              <h3 className="text-3xl font-black">{totalSettledMoney.toLocaleString()} <span className="text-base font-medium opacity-80">EGP</span></h3>
            </div>
            <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 text-white opacity-10" />
          </div>
        </div>

        <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border w-full shadow-sm overflow-x-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "pending" ? "bg-background text-blue-600 shadow-md border-b-2 border-blue-600" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Returns
          </button>
          <button 
            onClick={() => setActiveTab("settlements")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "settlements" ? "bg-background text-amber-600 shadow-md border-b-2 border-amber-500" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Pending Settlements
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-background text-emerald-600 shadow-md border-b-2 border-emerald-500" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Return History
          </button>
        </div>'''

if old_tabs in content:
    content = content.replace(old_tabs, new_tabs)
else:
    print("Could not find old tabs block")

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

