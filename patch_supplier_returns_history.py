import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update processHandover to generate returnNumber and returnedAt OUTSIDE the loop and save them.
# We look for: `setProcessing("handover");\n    try {\n      const finalItems = [];\n\n      for (const item of handoverItems) {`
target_1 = """setProcessing("handover");
    try {
      const finalItems = [];

      for (const item of handoverItems) {"""
replace_1 = """setProcessing("handover");
    try {
      const finalItems = [];
      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();

      for (const item of handoverItems) {"""
content = content.replace(target_1, replace_1)

# Inside the loop, replace returnedAt: new Date().toISOString(), with returnedAt: generatedReturnedAt, returnNumber: generatedReturnNumber,
target_2 = """            status: "returned",
            quantity: item.handoverQty,
            returnedAt: new Date().toISOString(),"""
replace_2 = """            status: "returned",
            quantity: item.handoverQty,
            returnedAt: generatedReturnedAt,
            returnNumber: generatedReturnNumber,"""
content = content.replace(target_2, replace_2)

# Also update receiptData in processHandover to use generated ones
target_3 = """        date: new Date().toLocaleDateString('en-GB'),
        returnNumber: `RTV-${Date.now().toString().slice(-6)}`,"""
replace_3 = """        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,"""
content = content.replace(target_3, replace_3)

# 2. Add a helper function to group events and format them
target_4 = """  // Group pending returns by supplier
  const returnsBySupplier = pendingReturns.reduce((acc: any, item) => {
    if (!acc[item.supplier]) acc[item.supplier] = [];
    acc[item.supplier].push(item);
    return acc;
  }, {});"""

replace_4 = """  // Group pending returns by supplier
  const returnsBySupplier = pendingReturns.reduce((acc: any, item) => {
    if (!acc[item.supplier]) acc[item.supplier] = [];
    acc[item.supplier].push(item);
    return acc;
  }, {});

  // Group settlements and history by Return Event
  const groupReturnEvents = (items: any[]) => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      // Use returnNumber if available, otherwise fallback to legacy grouping by supplier + agent + minute
      const key = item.returnNumber || `${item.supplier}_${item.agentName}_${item.totalPrice}_${item.returnedAt ? item.returnedAt.slice(0, 16) : 'legacy'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Convert to array and sort by latest returnedAt
    return Object.values(groups).sort((a, b) => {
      const dateA = a[0].returnedAt || "";
      const dateB = b[0].returnedAt || "";
      return dateB.localeCompare(dateA);
    });
  };

  const pendingSettlementEvents = groupReturnEvents(pendingSettlements);
  const returnHistoryEvents = groupReturnEvents(returnHistory);

  const viewReturnDetails = (eventItems: any[]) => {
    const first = eventItems[0];
    setPrintData({
      supplier: first.supplier,
      date: new Date(first.returnedAt || new Date()).toLocaleDateString('en-GB'),
      returnNumber: first.returnNumber || "LEGACY-RTV",
      agentName: first.agentName,
      agentNationalId: first.agentNationalId || "N/A",
      agentMobile: first.agentMobile || "N/A",
      items: eventItems,
      totalPrice: first.totalPrice || 0,
      settlementMethod: first.settlementMethod,
      paymentTiming: first.paymentTiming,
      expectedPaymentDate: first.expectedPaymentDate,
      isSettled: first.isSettled,
      eventIds: eventItems.map(i => i.id) // keep track of ids in case we need to settle them all
    });
  };
"""
content = content.replace(target_4, replace_4)

# 3. Replace pendingSettlements.map((item) => with pendingSettlementEvents.map((eventItems) =>
target_5 = """                ) : (
                  pendingSettlements.map((item) => (
                    <div key={item.id} className="bg-card border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-lg">{item.supplier}</h4>
                          <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground text-base">{item.totalPrice} EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Handed over to: <span className="font-medium text-foreground">{item.agentName}</span> • 
                          Expected: <span className="font-medium text-foreground">{item.expectedPaymentDate || "Not set"}</span>
                        </p>
                      </div>
                      <button 
                        onClick={() => handleSettlePayment(item.id)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  ))
                )}"""

replace_5 = """                ) : (
                  pendingSettlementEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className="bg-card border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-amber-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Awaiting Payment</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground text-base">{first.totalPrice} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Handed over to: <span className="font-medium text-foreground">{first.agentName}</span> • 
                            Expected: <span className="font-medium text-foreground">{first.expectedPaymentDate || "Not set"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              viewReturnDetails(eventItems);
                            }}
                            className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            View Details
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!confirm("Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                              eventItems.forEach(item => {
                                handleSettlePayment(item.id);
                              });
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                          >
                            Mark as Paid
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}"""
content = content.replace(target_5, replace_5)


# 4. Replace returnHistory.map((item) => with returnHistoryEvents.map((eventItems) =>
target_6 = """                ) : (
                  returnHistory.map((item) => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-75 hover:opacity-100 transition-opacity">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-lg">{item.supplier}</h4>
                          <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Settled</span>
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground">{item.totalPrice || 0} EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Method: {item.settlementMethod === 'money' ? 'Cash/Transfer' : 'Products Exchange'} • 
                          Settled on: {new Date(item.settledAt || item.returnedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}"""

replace_6 = """                ) : (
                  returnHistoryEvents.map((eventItems, idx) => {
                    const first = eventItems[0];
                    return (
                      <div key={idx} onClick={() => viewReturnDetails(eventItems)} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 opacity-80 hover:opacity-100 hover:bg-muted/30 cursor-pointer transition-all">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg">{first.supplier}</h4>
                            <span className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">Settled</span>
                            <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border border-border">{first.returnNumber || "Legacy Return"}</span>
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground">Amount: <span className="text-foreground">{first.totalPrice || 0} EGP</span> • <span className="text-foreground">{eventItems.length} items</span></p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Method: {first.settlementMethod === 'money' ? 'Cash/Transfer' : 'Products Exchange'} • 
                            Settled on: {new Date(first.settledAt || first.returnedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            viewReturnDetails(eventItems);
                          }}
                          className="bg-background border border-border hover:bg-muted text-foreground font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shrink-0 shadow-sm"
                        >
                          View Receipt
                        </button>
                      </div>
                    );
                  })
                )}"""
content = content.replace(target_6, replace_6)

# 5. Make sure the Settle Payment inside the modal also works if needed, but wait, the modal doesn't have a Settle Payment button.
# Let's add a Settle Payment button to the Print Modal if the event is NOT settled!
target_7 = """                <div className="flex gap-2">
                  <button onClick={() => setPrintData(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted">Close</button>
                  <button onClick={triggerPrint} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                </div>"""

replace_7 = """                <div className="flex gap-2">
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm("Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData(null);
                      }}
                      className="px-4 py-2 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"
                    >
                      Mark as Paid
                    </button>
                  )}
                  <button onClick={() => setPrintData(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted">Close</button>
                  <button onClick={triggerPrint} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                </div>"""
content = content.replace(target_7, replace_7)

# Remove the confirmation from handleSettlePayment because we moved it to the bulk actions
target_8 = """  const handleSettlePayment = async (id: string) => {
    if (!confirm("Confirm that you have received the pending payment/products for this return?")) return;
    try {"""
replace_8 = """  const handleSettlePayment = async (id: string) => {
    try {"""
content = content.replace(target_8, replace_8)


with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied")

