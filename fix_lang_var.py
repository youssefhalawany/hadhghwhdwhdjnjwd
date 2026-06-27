import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('{language ===', '{lang ===')
content = content.replace('placeholder={language ===', 'placeholder={lang ===')

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

