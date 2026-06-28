import sys

with open("src/app/layout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update icons metadata
content = content.replace('icon: "/icons/icon-192x192.png",', 'icon: "/icons8-circled-k-50.png",')

# Update head tags
content = content.replace('href="/icons/icon-192x192.png"', 'href="/icons8-circled-k-50.png"')

with open("src/app/layout.tsx", "w", encoding="utf-8") as f:
    f.write(content)

