import sys

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Only replace specific visible string literals in the code.
replacements = {
    'SUPPLIER RETURNS': '{language === "ar" ? "مرتجعات الموردين" : "SUPPLIER RETURNS"}',
    'Manage return handovers, pending financial settlements, and history.': '{language === "ar" ? "إدارة عمليات تسليم المرتجعات، والتسويات المالية المعلقة، والتاريخ." : "Manage return handovers, pending financial settlements, and history."}',
    '>Return History<': '>{language === "ar" ? "سجل المرتجعات" : "Return History"}<',
    '>Pending Settlements<': '>{language === "ar" ? "التسويات المعلقة" : "Pending Settlements"}<',
    '>Pending Returns<': '>{language === "ar" ? "المرتجعات المعلقة" : "Pending Returns"}<',
    '+ Manual Return': '+ {language === "ar" ? "مرتجع يدوي" : "Manual Return"}',
    
    # Modal titles
    'Direct Supplier Return (Manual)': '{language === "ar" ? "مرتجع مورد مباشر (يدوي)" : "Direct Supplier Return (Manual)"}',
    'Input all items and supplier data to generate a return receipt immediately.': '{language === "ar" ? "أدخل جميع الأصناف وبيانات المورد لإنشاء إيصال المرتجع فوراً." : "Input all items and supplier data to generate a return receipt immediately."}',
    
    # Modal Labels
    '>1. Select Supplier<': '>{language === "ar" ? "1. اختر المورد" : "1. Select Supplier"}<',
    '-- Select a Supplier --': '{language === "ar" ? "-- اختر المورد --" : "-- Select a Supplier --"}',
    'Or type new supplier name...': '{language === "ar" ? "أو اكتب اسم مورد جديد..." : "Or type new supplier name..."}',
    
    '>2. Add Return Items<': '>{language === "ar" ? "2. إضافة أصناف المرتجع" : "2. Add Return Items"}<',
    '>Barcode<': '>{language === "ar" ? "الباركود" : "Barcode"}<',
    'Scan or type...': '{language === "ar" ? "امسح أو اكتب..." : "Scan or type..."}',
    '>Item Name<': '>{language === "ar" ? "اسم الصنف" : "Item Name"}<',
    '>Qty<': '>{language === "ar" ? "الكمية" : "Qty"}<',
    '>Add<': '>{language === "ar" ? "إضافة" : "Add"}<',
    
    '>Action<': '>{language === "ar" ? "إجراء" : "Action"}<',
    '>Remove<': '>{language === "ar" ? "حذف" : "Remove"}<',
    '>Total Items:<': '>{language === "ar" ? "إجمالي الأصناف:" : "Total Items:"}<',
    'No items added yet. Scan a barcode above to add items to this return.': '{language === "ar" ? "لم تتم إضافة أصناف بعد. قم بمسح باركود لإضافة أصناف لهذا المرتجع." : "No items added yet. Scan a barcode above to add items to this return."}',
    
    '>3. Delivery Agent Info<': '>{language === "ar" ? "3. بيانات المندوب" : "3. Delivery Agent Info"}<',
    '>Agent Name<': '>{language === "ar" ? "اسم المندوب" : "Agent Name"}<',
    'placeholder="Full Name"': 'placeholder={language === "ar" ? "الاسم الكامل" : "Full Name"}',
    '>National ID<': '>{language === "ar" ? "الرقم القومي" : "National ID"}<',
    'placeholder="14-digit ID"': 'placeholder={language === "ar" ? "الرقم القومي المكون من 14 رقم" : "14-digit ID"}',
    '>Mobile Number<': '>{language === "ar" ? "رقم الموبايل" : "Mobile Number"}<',
    'placeholder="E.g. 01012345678"': 'placeholder={language === "ar" ? "مثال: 01012345678" : "E.g. 01012345678"}',
    
    '>4. Settlement Details & Payment<': '>{language === "ar" ? "4. تفاصيل التسوية والدفع" : "4. Settlement Details & Payment"}<',
    '>Total Expected Value (EGP)<': '>{language === "ar" ? "إجمالي القيمة المتوقعة (ج.م)" : "Total Expected Value (EGP)"}<',
    'placeholder="Total EGP Value of Return"': 'placeholder={language === "ar" ? "إجمالي قيمة المرتجع" : "Total EGP Value of Return"}',
    '>Settlement Method<': '>{language === "ar" ? "طريقة التسوية" : "Settlement Method"}<',
    '>Money (Cash/Transfer)<': '>{language === "ar" ? "نقدي (كاش/تحويل)" : "Money (Cash/Transfer)"}<',
    '>Products (Exchange)<': '>{language === "ar" ? "بضاعة (استبدال)" : "Products (Exchange)"}<',
    '>Payment Timing<': '>{language === "ar" ? "وقت الدفع" : "Payment Timing"}<',
    '>Received Now (Settled)<': '>{language === "ar" ? "تم الاستلام الآن (مسدد)" : "Received Now (Settled)"}<',
    '>Will Pay Later (Pending)<': '>{language === "ar" ? "الدفع لاحقاً (معلق)" : "Will Pay Later (Pending)"}<',
    '>Expected Date<': '>{language === "ar" ? "التاريخ المتوقع" : "Expected Date"}<',
    
    '>Cancel<': '>{language === "ar" ? "إلغاء" : "Cancel"}<',
    '>Complete Return & Print Receipt<': '>{language === "ar" ? "إتمام المرتجع وطباعة الإيصال" : "Complete Return & Print Receipt"}<',
    
    # Handover modal titles
    'Supplier Return Handover': '{language === "ar" ? "تسليم مرتجع المورد" : "Supplier Return Handover"}',
    'Review items and complete the financial settlement for this return.': '{language === "ar" ? "قم بمراجعة الأصناف وإتمام التسوية المالية لهذا المرتجع." : "Review items and complete the financial settlement for this return."}',
    '>Complete Handover & Print<': '>{language === "ar" ? "إتمام التسليم والطباعة" : "Complete Handover & Print"}<',

    # Receipt Button
    '>View Receipt<': '>{language === "ar" ? "عرض الإيصال" : "View Receipt"}<',
    '>Mark as Paid<': '>{language === "ar" ? "تحديد كمدفوع" : "Mark as Paid"}<',
    
    # Empty states
    'No Pending Returns': '{language === "ar" ? "لا توجد مرتجعات معلقة" : "No Pending Returns"}',
    'All supplier returns have been settled.': '{language === "ar" ? "تمت تسوية جميع مرتجعات الموردين." : "All supplier returns have been settled."}',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Safe translations applied.")
