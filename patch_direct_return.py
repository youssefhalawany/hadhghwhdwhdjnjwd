import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the old Manual Return state
target_1 = """  // Manual Return state
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualSupplier, setManualSupplier] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);"""

replace_1 = """  // Direct/Manual Return state
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [directSupplier, setDirectSupplier] = useState("");
  const [directItems, setDirectItems] = useState<{barcode: string, itemName: string, quantity: number, id: string}[]>([]);
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  
  useEffect(() => {
    // Fetch unique suppliers from products collection
    const fetchSuppliers = async () => {
      try {
        const snap = await getDocs(collection(db, "products"));
        const suppliers = new Set<string>();
        snap.forEach(doc => {
          if (doc.data().supplier) suppliers.add(doc.data().supplier);
        });
        setAllSuppliers(Array.from(suppliers).sort());
      } catch (e) {
        console.error("Error fetching suppliers:", e);
      }
    };
    fetchSuppliers();
  }, []);"""

content = content.replace(target_1, replace_1)

# 2. Update handleSearchProduct to handle `currentBarcode` instead of `manualBarcode`
target_2 = """  const handleSearchProduct = async (barcodeStr: string) => {
    if (!barcodeStr) return;
    setIsSearchingProduct(true);
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcodeStr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setManualName(snap.docs[0].data().name || "");
      } else {
        setManualName("Unknown Item (Not in DB)");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingProduct(false);
    }
  };"""

replace_2 = """  const handleSearchProduct = async (barcodeStr: string) => {
    if (!barcodeStr) return;
    setIsSearchingProduct(true);
    try {
      const q = query(collection(db, "products"), where("barcode", "==", barcodeStr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const productData = snap.docs[0].data();
        setCurrentName(productData.name || "");
        if (productData.supplier && !directSupplier) {
          setDirectSupplier(productData.supplier);
        }
      } else {
        setCurrentName("Unknown Item (Not in DB)");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingProduct(false);
    }
  };
  
  const handleAddDirectItem = () => {
    if (!currentBarcode || !currentName || currentQty <= 0) return;
    setDirectItems([...directItems, {
      barcode: currentBarcode,
      itemName: currentName,
      quantity: currentQty,
      id: Date.now().toString()
    }]);
    setCurrentBarcode("");
    setCurrentName("");
    setCurrentQty(1);
  };"""

content = content.replace(target_2, replace_2)

# 3. Replace handleManualReturnSubmit to act as a Full Handover Event
target_3 = """  const handleManualReturnSubmit = async () => {
    if (!manualBarcode || !manualName || !manualSupplier || manualQty <= 0) {
      alert("Please fill in all fields correctly.");
      return;
    }
    try {
      setProcessing("manual_return");
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let managerEmail = "Unknown Manager";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
      }

      await addDoc(collection(db, "supplier_returns"), {
        barcode: manualBarcode,
        itemName: manualName,
        category: "manual",
        supplier: manualSupplier,
        quantity: manualQty,
        storeId: currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
        branchId: currentBranch === "all" ? "alamein4" : currentBranch,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: managerEmail
      });
      setShowManualReturn(false);
      setManualBarcode("");
      setManualName("");
      setManualQty(1);
      setManualSupplier("");
      alert("Manual return added successfully!");
    } catch (err: any) {
      alert("Failed to add manual return: " + err.message);
    } finally {
      setProcessing(null);
    }
  };"""

replace_3 = """  const handleDirectReturnSubmit = async () => {
    if (!directSupplier || directItems.length === 0) {
      alert("Please select a supplier and add at least one item.");
      return;
    }
    if (!agentName.trim() || !agentNationalId.trim() || !agentMobile.trim()) {
      alert("Please fill in all Agent Information fields.");
      return;
    }

    try {
      setProcessing("direct_return");
      const savedUserStr = localStorage.getItem("active_cashier_session");
      let managerEmail = "Unknown Manager";
      if (savedUserStr) {
        const sessionData = JSON.parse(savedUserStr);
        managerEmail = sessionData.email || sessionData.name || "Unknown Manager";
      }

      const generatedReturnNumber = `RTV-${Date.now().toString().slice(-6)}`;
      const generatedReturnedAt = new Date().toISOString();
      const finalItems = [];

      for (const item of directItems) {
        const docRef = await addDoc(collection(db, "supplier_returns"), {
          barcode: item.barcode,
          itemName: item.itemName,
          category: "manual",
          supplier: directSupplier,
          quantity: item.quantity,
          storeId: currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"),
          branchId: currentBranch === "all" ? "alamein4" : currentBranch,
          status: "returned",
          createdAt: generatedReturnedAt,
          createdBy: managerEmail,
          returnedAt: generatedReturnedAt,
          returnNumber: generatedReturnNumber,
          agentName,
          agentNationalId,
          agentMobile,
          totalPrice: Number(totalPrice) || 0,
          settlementMethod,
          paymentTiming: settlementMethod === "money" ? paymentTiming : null,
          expectedPaymentDate: settlementMethod === "money" && paymentTiming === "later" ? expectedPaymentDate : null,
          isSettled: settlementMethod === "products" || paymentTiming === "now"
        });
        finalItems.push({
          ...item,
          id: docRef.id
        });
      }

      const receiptData = {
        supplier: directSupplier,
        date: new Date(generatedReturnedAt).toLocaleDateString('en-GB'),
        returnNumber: generatedReturnNumber,
        agentName,
        agentNationalId,
        agentMobile,
        items: finalItems,
        totalPrice: Number(totalPrice) || 0,
        settlementMethod,
        paymentTiming,
        expectedPaymentDate,
        isSettled: settlementMethod === "products" || paymentTiming === "now",
        eventIds: finalItems.map(i => i.id)
      };

      setPrintData(receiptData);
      
      setShowManualReturn(false);
      setDirectSupplier("");
      setDirectItems([]);
      setCurrentBarcode("");
      setCurrentName("");
      setCurrentQty(1);
      setAgentName("");
      setAgentNationalId("");
      setAgentMobile("");
      setTotalPrice("");
      setSettlementMethod("money");
      setPaymentTiming("now");
      setExpectedPaymentDate("");
    } catch (err: any) {
      alert("Failed to submit direct return: " + err.message);
    } finally {
      setProcessing(null);
    }
  };"""

content = content.replace(target_3, replace_3)

# 4. Replace the Manual Return Modal JSX
target_4_start = "{/* MANUAL RETURN MODAL */}"
target_4_end = "{/* HANDOVER MODAL */}"

idx_start = content.find(target_4_start)
idx_end = content.find(target_4_end)

if idx_start != -1 and idx_end != -1:
    new_modal = """{/* DIRECT (MANUAL) RETURN MODAL */}
        {showManualReturn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[95vh]">
              <div className="p-6 border-b border-border bg-muted/30">
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Truck className="h-6 w-6 text-blue-500" />
                  Direct Supplier Return (Manual)
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Input all items and supplier data to generate a return receipt immediately.</p>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                {/* 1. Supplier Selection */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">1. Select Supplier</h4>
                  <div className="flex gap-2">
                    <select 
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full md:w-1/2 p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 font-bold"
                    >
                      <option value="" disabled>-- Select a Supplier --</option>
                      {allSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Or type new supplier name..."
                      value={directSupplier}
                      onChange={e => setDirectSupplier(e.target.value)}
                      className="w-full md:w-1/2 p-3 border border-border rounded-xl bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* 2. Items List */}
                <div>
                  <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">2. Add Return Items</h4>
                  
                  <div className="flex flex-col md:flex-row gap-2 mb-4 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Barcode</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={currentBarcode}
                          onChange={e => setCurrentBarcode(e.target.value)}
                          onBlur={() => handleSearchProduct(currentBarcode)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSearchProduct(currentBarcode);
                          }}
                          placeholder="Scan or type..."
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 font-mono text-sm"
                        />
                        <button 
                          onClick={() => handleSearchProduct(currentBarcode)}
                          disabled={isSearchingProduct || !currentBarcode}
                          className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 rounded-lg text-sm font-bold disabled:opacity-50"
                        >
                          {isSearchingProduct ? "..." : "Find"}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Item Name</label>
                      <input 
                        type="text" 
                        value={currentName}
                        onChange={e => setCurrentName(e.target.value)}
                        placeholder="Item Name"
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Qty</label>
                      <input 
                        type="number" 
                        min="1"
                        value={currentQty}
                        onChange={e => setCurrentQty(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddDirectItem();
                        }}
                        className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-center font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={handleAddDirectItem}
                        disabled={!currentBarcode || !currentName || currentQty <= 0}
                        className="h-[38px] px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {directItems.length > 0 ? (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 font-semibold">Item Name</th>
                            <th className="p-3 font-semibold">Barcode</th>
                            <th className="p-3 font-semibold text-center">Qty</th>
                            <th className="p-3 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {directItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="p-3 font-medium">{item.itemName}</td>
                              <td className="p-3 font-mono text-muted-foreground">{item.barcode}</td>
                              <td className="p-3 text-center font-black text-lg">{item.quantity}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setDirectItems(directItems.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-600 font-bold text-xs bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr>
                            <td colSpan={2} className="p-3 font-bold text-right uppercase text-xs">Total Items:</td>
                            <td className="p-3 text-center font-black text-xl">{directItems.reduce((sum, item) => sum + item.quantity, 0)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
                      No items added yet. Scan a barcode above to add items to this return.
                    </div>
                  )}
                </div>

                {/* 3. Agent Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-muted/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">3. Delivery Agent Info</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Agent Name</label>
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">National ID</label>
                    <input 
                      type="text" 
                      value={agentNationalId}
                      onChange={e => setAgentNationalId(e.target.value)}
                      placeholder="14-digit ID"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Mobile Number</label>
                    <input 
                      type="text" 
                      value={agentMobile}
                      onChange={e => setAgentMobile(e.target.value)}
                      placeholder="E.g. 01012345678"
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>

                {/* 4. Settlement Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-amber-500/5 border-amber-500/20">
                  <div className="col-span-1 md:col-span-2">
                    <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500 uppercase tracking-wider">4. Settlement Details & Payment</h4>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Total Expected Value (EGP)</label>
                    <input 
                      type="number" 
                      value={totalPrice}
                      onChange={e => setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Total EGP Value of Return"
                      className="w-full p-2 border border-amber-500/30 rounded-lg bg-background outline-none focus:border-amber-500 font-bold text-amber-600 text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Settlement Method</label>
                    <select
                      value={settlementMethod}
                      onChange={e => setSettlementMethod(e.target.value as "money" | "products")}
                      className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="money">Money (Cash/Transfer)</option>
                      <option value="products">Products (Exchange)</option>
                    </select>
                  </div>
                  {settlementMethod === "money" && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Payment Timing</label>
                        <select
                          value={paymentTiming}
                          onChange={e => setPaymentTiming(e.target.value as "now" | "later")}
                          className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                        >
                          <option value="now">Received Now (Settled)</option>
                          <option value="later">Will Pay Later (Pending)</option>
                        </select>
                      </div>
                      {paymentTiming === "later" && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">Expected Date</label>
                          <input 
                            type="date" 
                            value={expectedPaymentDate}
                            onChange={e => setExpectedPaymentDate(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg bg-background outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
              
              <div className="p-6 bg-muted/50 flex justify-end gap-3 border-t border-border shrink-0">
                <button 
                  onClick={() => setShowManualReturn(false)}
                  className="px-6 py-3 rounded-xl font-bold bg-background text-foreground hover:bg-muted border border-border transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDirectReturnSubmit}
                  disabled={processing === "direct_return"}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2 text-lg shadow-lg"
                >
                  {processing === "direct_return" ? "Processing..." : "Complete Return & Print Receipt"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HANDOVER MODAL */}"""
    content = content[:idx_start] + new_modal + content[idx_end + len(target_4_end):]

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied for Direct Manual Return.")

