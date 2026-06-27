import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix quotes around placeholder/title with { }
content = content.replace('placeholder="{language', 'placeholder={language')
content = content.replace('name..."}"', 'name..."}')
content = content.replace('Name"}"', 'Name"}')
content = content.replace('ID"}"', 'ID"}')
content = content.replace('01012345678"}"', '01012345678"}')
content = content.replace('Return"}"', 'Return"}')
content = content.replace('type..."}"', 'type..."}')

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

