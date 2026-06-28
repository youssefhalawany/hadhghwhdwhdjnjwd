with open("update_print.py", "r") as f:
    content = f.read()
    
# Extract new_print_block
start = content.find("new_print_block = '''") + len("new_print_block = '''")
end = content.find("'''", start)
block = content[start:end]

open_divs = block.count("<div")
close_divs = block.count("</div")

print(f"Open divs: {open_divs}")
print(f"Close divs: {close_divs}")

