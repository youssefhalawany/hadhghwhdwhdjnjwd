const fs = require('fs');

function patchFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Add queries for "bank"
  content = content.replace(
    /let cashPaymentsBankTransferQ: any = query\(collection\(db, "cash_payments"\), where\("method", "==", "bank_transfer"\)\);/g,
    'let cashPaymentsBankTransferQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank_transfer"));\n        let cashPaymentsBankQ: any = query(collection(db, "cash_payments"), where("method", "==", "bank"));'
  );

  content = content.replace(
    /let creditPaymentsBankTransferQ: any = query\(collection\(db, "credit_payments"\), where\("method", "==", "bank_transfer"\)\);/g,
    'let creditPaymentsBankTransferQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank_transfer"));\n        let creditPaymentsBankQ: any = query(collection(db, "credit_payments"), where("method", "==", "bank"));'
  );

  // Add storeId filter for "bank"
  content = content.replace(
    /cashPaymentsBankTransferQ = query\(cashPaymentsBankTransferQ, where\("storeId", "in", branchIds\)\);/g,
    'cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("storeId", "in", branchIds));\n          cashPaymentsBankQ = query(cashPaymentsBankQ, where("storeId", "in", branchIds));'
  );

  content = content.replace(
    /creditPaymentsBankTransferQ = query\(creditPaymentsBankTransferQ, where\("storeId", "in", branchIds\)\);/g,
    'creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("storeId", "in", branchIds));\n          creditPaymentsBankQ = query(creditPaymentsBankQ, where("storeId", "in", branchIds));'
  );

  // Add date filter for "bank" (historical)
  content = content.replace(
    /cashPaymentsBankTransferQ = query\(cashPaymentsBankTransferQ, where\("date", "<", startDateStr\)\);/g,
    'cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", "<", startDateStr));\n          cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", "<", startDateStr));'
  );

  content = content.replace(
    /creditPaymentsBankTransferQ = query\(creditPaymentsBankTransferQ, where\("date", "<", startDateStr\)\);/g,
    'creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", "<", startDateStr));\n          creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", "<", startDateStr));'
  );

  // Add date filter for "bank" (period)
  content = content.replace(
    /cashPaymentsBankTransferQ = query\(cashPaymentsBankTransferQ, where\("date", ">=", startDateStr\), where\("date", "<=", endDateStr\)\);/g,
    'cashPaymentsBankTransferQ = query(cashPaymentsBankTransferQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));\n          cashPaymentsBankQ = query(cashPaymentsBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));'
  );

  content = content.replace(
    /creditPaymentsBankTransferQ = query\(creditPaymentsBankTransferQ, where\("date", ">=", startDateStr\), where\("date", "<=", endDateStr\)\);/g,
    'creditPaymentsBankTransferQ = query(creditPaymentsBankTransferQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));\n          creditPaymentsBankQ = query(creditPaymentsBankQ, where("date", ">=", startDateStr), where("date", "<=", endDateStr));'
  );

  // Add to Promise.all in inputs/page.tsx
  content = content.replace(
    /bankTransferCreditsData,\n\s*depositsToBankData, depositsFromBankData, visaTaxData, bankTransferTaxData, cashTaxData\n\s*\] = await Promise\.all\(\[/g,
    'bankTransferCreditsData, depositsToBankData, depositsFromBankData, visaTaxData, bankTransferTaxData, cashTaxData, cashPaymentsBankData, creditPaymentsBankData, bankTaxData] = await Promise.all(['
  );

  content = content.replace(
    /safeSumAgg\(cashPaymentsQ, \{ val: sum\("tax"\) \}\),\n\s*\]\);/g,
    'safeSumAgg(cashPaymentsQ, { val: sum("tax") }),\n          safeSumAgg(cashPaymentsBankQ, { val: sum("amount") }),\n          safeSumAgg(creditPaymentsBankQ, { val: sum("amount") }),\n          safeSumAgg(cashPaymentsBankQ, { val: sum("tax") })\n        ]);'
  );

  // Add to Promise.all in safe-report/page.tsx
  content = content.replace(
    /bankTransferCreditsData,\n\s*depositsToBankData, depositsFromBankData\n\s*\] = await Promise\.all\(\[/g,
    'bankTransferCreditsData, depositsToBankData, depositsFromBankData, cashPaymentsBankData, creditPaymentsBankData] = await Promise.all(['
  );

  content = content.replace(
    /safeSumAgg\(depositsFromBankQ, \{ val: sum\("amount"\) \}\),\n\s*\]\);/g,
    'safeSumAgg(depositsFromBankQ, { val: sum("amount") }),\n          safeSumAgg(cashPaymentsBankQ, { val: sum("amount") }),\n          safeSumAgg(creditPaymentsBankQ, { val: sum("amount") })\n        ]);'
  );

  // Sum them up
  content = content.replace(
    /const totalBankTransferPayments = bankTransferPaymentsData\?\.val \|\| 0;/g,
    'const totalBankTransferPayments = bankTransferPaymentsData?.val || 0;\n        const totalBankOnlyPayments = cashPaymentsBankData?.val || 0;'
  );

  content = content.replace(
    /const totalBankPayments = totalVisaPayments \+ totalBankTransferPayments;/g,
    'const totalBankPayments = totalVisaPayments + totalBankTransferPayments + totalBankOnlyPayments;'
  );
  
  content = content.replace(
    /const bankPayments = totalVisaPayments \+ totalBankTransferPayments;/g,
    'const bankPayments = totalVisaPayments + totalBankTransferPayments + totalBankOnlyPayments;'
  );

  content = content.replace(
    /const totalBankTransferCredits = bankTransferCreditsData\?\.val \|\| 0;/g,
    'const totalBankTransferCredits = bankTransferCreditsData?.val || 0;\n        const totalBankOnlyCredits = creditPaymentsBankData?.val || 0;'
  );

  content = content.replace(
    /const totalBankCredits = totalVisaCredits \+ totalBankTransferCredits;/g,
    'const totalBankCredits = totalVisaCredits + totalBankTransferCredits + totalBankOnlyCredits;'
  );

  content = content.replace(
    /const bankCredits = totalVisaCredits \+ totalBankTransferCredits;/g,
    'const bankCredits = totalVisaCredits + totalBankTransferCredits + totalBankOnlyCredits;'
  );

  content = content.replace(
    /const totalBankTransferTax = bankTransferTaxData\?\.val \|\| 0;/g,
    'const totalBankTransferTax = bankTransferTaxData?.val || 0;\n        const totalBankOnlyTax = bankTaxData?.val || 0;'
  );

  content = content.replace(
    /const totalBankTaxPaid = totalVisaTax \+ totalBankTransferTax;/g,
    'const totalBankTaxPaid = totalVisaTax + totalBankTransferTax + totalBankOnlyTax;'
  );

  fs.writeFileSync(path, content, 'utf8');
}

patchFile('/Users/youssefhalawanyy/Documents/anhreports/src/app/financials/inputs/page.tsx');
patchFile('/Users/youssefhalawanyy/Documents/anhreports/src/app/financials/inputs/safe-report/page.tsx');
