import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('import {language === "ar" ? "الباركود" : "Barcode"} from "react-barcode";', 'import Barcode from "react-barcode";')

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed")
