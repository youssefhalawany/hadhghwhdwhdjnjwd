import sys

with open("src/components/ClientLayoutWrapper.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Translate the Portal text
target_1 = "{currentBranch === 'alamein4' ? 'El Alamein 4 Portal' : currentBranch === 'ola' ? 'Ola El Koronfol Portal' : 'All Branches Portal'}"
replace_1 = "{currentBranch === 'alamein4' ? (language === 'ar' ? 'بوابة العلمين 4' : 'El Alamein 4 Portal') : currentBranch === 'ola' ? (language === 'ar' ? 'بوابة علا القرنفل' : 'Ola El Koronfol Portal') : (language === 'ar' ? 'بوابة جميع الفروع' : 'All Branches Portal')}"
content = content.replace(target_1, replace_1)

# 2. Fix margins to logical properties (ms/me instead of ml/mr)
content = content.replace("ml-4", "ms-4")
content = content.replace("mr-2", "me-2")
content = content.replace("ml-1", "ms-1")
content = content.replace("mr-1", "me-1")

# 3. Translate Welcome
target_2 = "<span>Welcome, <span className=\"text-foreground\">{userDoc.displayName || user?.email?.split('@')[0]}</span></span>"
replace_2 = "<span>{language === 'ar' ? 'مرحباً، ' : 'Welcome, '}<span className=\"text-foreground\">{userDoc.displayName || user?.email?.split('@')[0]}</span></span>"
content = content.replace(target_2, replace_2)

# 4. Fix CIRCLE K text alignment in RTL by explicitly setting text-start
target_3 = "className=\"flex flex-col\""
replace_3 = "className=\"flex flex-col text-start\""
content = content.replace(target_3, replace_3)

# 5. Translate "Select Branch" inside the switcher?
target_4 = 'title="Select Branch"'
replace_4 = 'title={language === "ar" ? "اختر الفرع" : "Select Branch"}'
content = content.replace(target_4, replace_4)

target_5 = '<option key={b.id} value={b.id} className="bg-card">{b.name}</option>'
replace_5 = '<option key={b.id} value={b.id} className="bg-card">{language === "ar" && b.id === "alamein4" ? "العلمين 4" : language === "ar" && b.id === "ola" ? "علا القرنفل" : b.name}</option>'
content = content.replace(target_5, replace_5)

# 6. Translate "Toggle Dark/Light Mode" etc
target_6 = 'title="Toggle Language"'
replace_6 = 'title={language === "ar" ? "تغيير اللغة" : "Toggle Language"}'
content = content.replace(target_6, replace_6)

target_7 = 'title="Toggle Dark/Light Mode"'
replace_7 = 'title={language === "ar" ? "تبديل المظهر" : "Toggle Dark/Light Mode"}'
content = content.replace(target_7, replace_7)

target_8 = 'title="Sign Out"'
replace_8 = 'title={language === "ar" ? "تسجيل الخروج" : "Sign Out"}'
content = content.replace(target_8, replace_8)

# 7. Translate Nav items
# "navItems" array is defined as objects. Wait, the actual nav items are drawn using `item.name`. 
# We should translate the text displayed inside the links.
target_9 = "{!item.isIconOnly && <span>{item.name}</span>}"
replace_9 = "{!item.isIconOnly && <span>{language === 'ar' && item.name === 'Returns' ? 'مرتجعات' : language === 'ar' && item.name === 'Expired' ? 'منتهية الصلاحية' : language === 'ar' && item.name === 'Admin' ? 'الإدارة' : language === 'ar' && item.name === 'Checklists' ? 'قوائم المراجعة' : language === 'ar' && item.name === 'Financials' ? 'الماليات' : item.name}</span>}"
content = content.replace(target_9, replace_9)

target_10 = "<span>{item.name}</span>"
replace_10 = "<span>{language === 'ar' && item.name === 'Returns' ? 'مرتجعات' : language === 'ar' && item.name === 'Expired' ? 'منتهية الصلاحية' : language === 'ar' && item.name === 'Admin' ? 'الإدارة' : language === 'ar' && item.name === 'Checklists' ? 'قوائم المراجعة' : language === 'ar' && item.name === 'Financials' ? 'الماليات' : item.name}</span>"
# replace exactly inside the <nav> children maps
# Let's do it using generic replacement for specific lines.

with open("src/components/ClientLayoutWrapper.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("ClientLayoutWrapper patched.")
