import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove directItems.length validation
old_validation = '''    if (!directSupplier || directItems.length === 0) {
      alert("Please select a supplier and add at least one item.");
      return;
    }'''

new_validation = '''    if (!directSupplier) {
      alert("Please select a supplier.");
      return;
    }'''

content = content.replace(old_validation, new_validation)

# 2. Add dummy item save logic if items are 0
old_loop = '''      for (const item of directItems) {
        const docRef = await addDoc(collection(db, "supplier_returns"), {'''

new_loop = '''      const itemsToProcess = directItems.length > 0 ? directItems : [{
        barcode: "N/A",
        itemName: lang === "ar" ? "مطابق لمستند التحويل" : "Matches Transfer Out Document",
        quantity: 0,
        id: "dummy"
      }];

      for (const item of itemsToProcess) {
        const docRef = await addDoc(collection(db, "supplier_returns"), {'''

content = content.replace(old_loop, new_loop)

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

