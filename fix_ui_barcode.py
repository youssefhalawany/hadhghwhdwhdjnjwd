import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('<label className="text-xs font-bold text-muted-foreground mb-1 block">Barcode</label>', '<label className="text-xs font-bold text-muted-foreground mb-1 block">{language === "ar" ? "الباركود" : "Barcode"}</label>')
content = content.replace('<th className="p-3 font-semibold">Barcode</th>', '<th className="p-3 font-semibold">{language === "ar" ? "الباركود" : "Barcode"}</th>')

content = content.replace('<label className="text-xs font-bold text-muted-foreground mb-1 block">Qty</label>', '<label className="text-xs font-bold text-muted-foreground mb-1 block">{language === "ar" ? "الكمية" : "Qty"}</label>')
content = content.replace('<th className="p-3 font-semibold text-center">Qty</th>', '<th className="p-3 font-semibold text-center">{language === "ar" ? "الكمية" : "Qty"}</th>')

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
