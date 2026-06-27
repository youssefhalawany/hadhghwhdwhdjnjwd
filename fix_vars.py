import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('{language === "ar" ? "الباركود" : "Barcode"}', 'Barcode')
content = content.replace('{language === "ar" ? "الكمية" : "Qty"}', 'Qty')

# Now selectively replace ONLY the UI text.
# The UI text is in the HTML.
# Barcode -> <label className="text-xs font-bold text-muted-foreground mb-1 block">{language === "ar" ? "الباركود" : "Barcode"}</label>
# Qty -> <label className="text-xs font-bold text-muted-foreground mb-1 block">{language === "ar" ? "الكمية" : "Qty"}</label>

# Let's do it using regex to find only the specific labels or text.
with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
    
print("Reverted blind variable replacements.")
