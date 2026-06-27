import sys

with open("src/app/dashboard/expiries-audit/page.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

# find exact line indices
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "{/* Handover Modal */}" in line:
        start_idx = i
    if "/* Inject print styles */" in line:
        pass
    if "`}}" in line and "/>" in line and start_idx != -1:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + lines[end_idx+1:]
    with open("src/app/dashboard/expiries-audit/page.tsx", "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Modals removed")
else:
    print(f"Failed to find indices: start={start_idx}, end={end_idx}")

