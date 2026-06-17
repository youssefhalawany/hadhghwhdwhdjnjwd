export interface LedgerEntry {
  id: string;
  date: string;
  reference: string;
  invoice: string;
  po: string;
  debit: number; // Invoice amounts (Debt increase)
  credit: number; // Payment amounts (Debt reduction)
  balance: number; // Running balance outstanding
  description: string;
  store: string;
}

export const compileCompanyLedger = (
  companyId: string,
  credits: any[],
  creditPayments: any[],
  cashPayments: any[],
  branches: any[]
): LedgerEntry[] => {
  const entries: LedgerEntry[] = [];

  // 1. Process Credits (Invoices)
  credits
    .filter(c => c.companyId === companyId)
    .forEach(c => {
      const branchName = branches.find(b => b.id === c.branchId)?.name || c.branchId || "Downtown";
      entries.push({
        id: c.id,
        date: c.date || c.timestamp || new Date().toISOString(),
        reference: c.invoiceNo || c.id,
        invoice: c.invoiceNo || "",
        po: c.poNo || "",
        debit: c.total || 0,
        credit: 0,
        balance: 0,
        description: `Invoice Registered (Status: ${c.status})`,
        store: branchName
      });
    });

  // 2. Process Credit Payments (Settlements)
  creditPayments
    .filter(p => p.companyId === companyId)
    .forEach(p => {
      const branchName = branches.find(b => b.id === p.branchId)?.name || p.branchId || "Downtown";
      entries.push({
        id: p.id,
        date: p.paymentDate || p.timestamp || new Date().toISOString(),
        reference: p.id,
        invoice: p.creditId || "",
        po: "",
        debit: 0,
        credit: p.amount || 0,
        balance: 0,
        description: `Credit Invoice Settlement (${p.method})`,
        store: branchName
      });
    });

  // 3. Process Cash Payments (Direct cash payments / expenses)
  cashPayments
    .filter(p => p.companyId === companyId)
    .forEach(p => {
      const branchName = branches.find(b => b.id === p.branchId)?.name || p.branchId || "Downtown";
      entries.push({
        id: p.id,
        date: p.date || p.timestamp || new Date().toISOString(),
        reference: p.invoiceNo || p.id,
        invoice: p.invoiceNo || "",
        po: p.poNo || "",
        debit: 0,
        credit: p.amount || 0,
        balance: 0,
        description: `Direct Cash Payment (${p.category || "General"})`,
        store: branchName
      });
    });

  // 4. Sort chronologically by date/timestamp
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 5. Calculate Running Balance
  let runningBalance = 0;
  entries.forEach(entry => {
    runningBalance += (entry.debit - entry.credit);
    entry.balance = parseFloat((Number(runningBalance) || 0).toFixed(2));
  });

  return entries;
};
