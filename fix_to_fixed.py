import re

file_path = "/Users/youssefhalawanyy/Documents/anhreports/src/app/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Fix safe_drops to safe_balance
content = content.replace('dbService.onSnapshot("safe_drops"', 'dbService.onSnapshot("safe_balance"')

# Simple regex to fix .toFixed crashes
# Example match: `sale.total.toFixed(2)` -> `(Number(sale.total) || 0).toFixed(2)`
# We use `[a-zA-Z0-9_\.]+` to match variables
content = re.sub(r'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\.toFixed\((.*?)\)', r'(Number(\1) || 0).toFixed(\2)', content)

# Remove nested Number if we accidentally did it multiple times (which we didn't, but just in case)
content = content.replace("Number(Number(", "Number(")

with open(file_path, "w") as f:
    f.write(content)

print("Fixed toFixed issues and safe_drops in page.tsx")
