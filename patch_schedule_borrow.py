import sys

with open("src/app/admin/schedule/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Insert the matching helper function after `const storeId` definition
target_storeId = 'const storeId = currentBranch === "all" ? "eL-alamein-4" : (currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4");'

helper_function = '''
  const isStoreMatch = (id: string | undefined | null) => {
    if (!id) return false;
    if (currentBranch === "all") return true;
    const lowerId = id.toLowerCase();
    if (currentBranch === "alamein4" && (lowerId.includes("alamein") || lowerId === "el-alamein-4")) return true;
    if (currentBranch === "ola" && (lowerId.includes("ola") || lowerId.includes("koronfol"))) return true;
    return id === storeId || id === currentBranch;
  };
'''

content = content.replace(target_storeId, target_storeId + "\n" + helper_function)

# Replace the exact filtering loops
content = content.replace('r.sourceStoreId === storeId', 'isStoreMatch(r.sourceStoreId)')
content = content.replace('r.targetStoreId === storeId', 'isStoreMatch(r.targetStoreId)')

with open("src/app/admin/schedule/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

