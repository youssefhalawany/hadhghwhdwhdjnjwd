import os
import re

def fix_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    original_content = content

    # Fix safe_drops to safe_balance
    content = content.replace('dbService.onSnapshot("safe_drops"', 'dbService.onSnapshot("safe_balance"')

    # Simple regex to fix .toFixed crashes
    # Example match: `sale.total.toFixed(2)` -> `(Number(sale.total) || 0).toFixed(2)`
    content = re.sub(r'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\.toFixed\((.*?)\)', r'(Number(\1) || 0).toFixed(\2)', content)

    # Remove nested Number if we accidentally did it multiple times
    content = content.replace("Number(Number(", "Number(")

    if content != original_content:
        with open(file_path, "w") as f:
            f.write(content)
        print(f"Fixed {file_path}")

src_dir = "/Users/youssefhalawanyy/Documents/anhreports/src"
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            fix_file(os.path.join(root, file))

print("Fixed toFixed issues and safe_drops across codebase")
