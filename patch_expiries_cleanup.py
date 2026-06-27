import sys
import re

with open("src/app/dashboard/expiries-audit/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove Supplier Returns tab
tab_old = """            <button 
              onClick={() => setActiveTab("reports")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "reports" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("expiries_audit.tab_reports")}
            </button>
            <button 
              onClick={() => setActiveTab("returns")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "returns" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              Supplier Returns
            </button>
          </div>"""
tab_new = """            <button 
              onClick={() => setActiveTab("reports")}
              className={`flex-1 py-3 px-4 text-center font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === "reports" 
                  ? "bg-foreground text-background shadow-md" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("expiries_audit.tab_reports")}
            </button>
          </div>"""
content = content.replace(tab_old, tab_new)

# 2. Remove states
states_to_remove = """  const [handoverSupplier, setHandoverSupplier] = useState<string | null>(null);
  const [handoverItems, setHandoverItems] = useState<any[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentNationalId, setAgentNationalId] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [printData, setPrintData] = useState<any | null>(null);
  const [totalPrice, setTotalPrice] = useState<number | "">("");
  const [settlementMethod, setSettlementMethod] = useState<"money" | "products">("money");
  const [paymentTiming, setPaymentTiming] = useState<"now" | "later">("now");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [showManualReturn, setShowManualReturn] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualSupplier, setManualSupplier] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);"""
content = content.replace(states_to_remove, "")

# 3. Remove `processHandover`, `handleSettlePayment`, `handleSearchProduct`, `handleManualReturnSubmit`
# These are pretty big. I will use regex or find strings.
import re

content = re.sub(r"const handleSearchProduct = async.*?finally {\s*setIsSearchingProduct\(false\);\s*}\s*};", "", content, flags=re.DOTALL)
content = re.sub(r"const handleManualReturnSubmit = async.*?finally {\s*setProcessing\(null\);\s*}\s*};", "", content, flags=re.DOTALL)
content = re.sub(r"const processHandover = async.*?finally {\s*setProcessing\(null\);\s*}\s*};", "", content, flags=re.DOTALL)
content = re.sub(r"const handleSettlePayment = async.*?alert\(\"Failed to mark settlement\.\"\);\s*}\s*};", "", content, flags=re.DOTALL)

# 4. Remove activeTab === "returns" block
# It starts with `{activeTab === "returns" && (` and ends with `)}`
content = re.sub(r"\{\s*activeTab === \"returns\" && \(.*?\}\)\s*\}\s*<\/div>\s*\)\s*\}", "", content, flags=re.DOTALL)

# 5. Remove Modals (Manual Return, Handover, Print)
content = re.sub(r"\{\s*\/\* MANUAL RETURN MODAL \*\/\s*\}.*?\{\s*\/\* HANDOVER MODAL \*\/\s*\}", "{/* HANDOVER MODAL */}", content, flags=re.DOTALL)
content = re.sub(r"\{\s*\/\* HANDOVER MODAL \*\/\s*\}.*?\{\s*\/\* PRINTABLE RECEIPT MODAL \*\/\s*\}", "{/* PRINTABLE RECEIPT MODAL */}", content, flags=re.DOTALL)
content = re.sub(r"\{\s*\/\* PRINTABLE RECEIPT MODAL \*\/\s*\}.*?<style dangerouslySetInnerHTML", "<style dangerouslySetInnerHTML", content, flags=re.DOTALL)
content = re.sub(r"<style dangerouslySetInnerHTML.*?<\/style>\s*`\}\}\s*\/>", "", content, flags=re.DOTALL)

# remove lingering comments
content = content.replace("{/* HANDOVER MODAL */}", "")
content = content.replace("{/* PRINTABLE RECEIPT MODAL */}", "")

with open("src/app/dashboard/expiries-audit/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
