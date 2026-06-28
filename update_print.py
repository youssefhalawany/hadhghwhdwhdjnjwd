import sys
import re

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Define the start and end of the block we want to replace
start_str = "        {printData && ("
end_str = "        <style dangerouslySetInnerHTML={{__html: `"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find print block boundaries")
    sys.exit(1)

new_print_block = '''        {printData && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print-only-container">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative">
              <div className="p-6 border-b sticky top-0 bg-white/80 backdrop-blur-sm z-10 flex justify-between items-center no-print">
                <h3 className="text-xl font-bold text-black">{lang === "ar" ? "إيصال المرتجع" : "Return Receipt"}</h3>
                <div className="space-x-2">
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm("Mark all items as paid?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData({...printData, isSettled: true});
                      }}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                    >
                      {lang === "ar" ? "تأكيد الدفع" : "Mark as Paid"}
                    </button>
                  )}
                  <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors">{lang === "ar" ? "طباعة" : "Print"}</button>
                  <button onClick={() => setPrintData(null)} className="px-6 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors">{lang === "ar" ? "إغلاق" : "Close"}</button>
                </div>
              </div>

              {/* Printable Area - Corporate Style */}
              <div id="print-area" className="p-12 text-black bg-white" dir={lang === "ar" ? "rtl" : "ltr"}>
                
                {/* Corporate Header */}
                <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-600 text-white p-3 rounded-xl font-black text-4xl tracking-tighter w-16 h-16 flex items-center justify-center">K</div>
                    <div>
                      <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Circle K</h1>
                      <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-widest">{currentBranch === "all" ? "HQ Portal" : (currentBranch === "ola" ? "Ola El Koronfol" : "Alamein 4")}</p>
                    </div>
                  </div>
                  <div className="text-right" dir="ltr">
                    <h2 className="text-4xl font-black text-gray-900 tracking-tighter">RTV RECEIPT</h2>
                    <p className="text-xl font-bold text-red-600 mt-1"># {printData.returnNumber}</p>
                    <p className="text-sm font-semibold text-gray-500 mt-1">{printData.date}</p>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8 border-b-2 border-gray-200 pb-8">
                  {/* Supplier Box */}
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{lang === "ar" ? "بيانات المورد" : "Supplier Information"}</h3>
                    <p className="text-2xl font-black text-gray-900 mb-4">{printData.supplier}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</span>
                        <span className="text-sm font-bold text-gray-900">{printData.agentName}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "رقم الهاتف" : "Mobile"}</span>
                        <span className="text-sm font-bold text-gray-900">{printData.agentMobile}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "الرقم القومي" : "National ID"}</span>
                        <span className="text-sm font-black tracking-widest text-gray-900">{printData.agentNationalId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financials Box */}
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{lang === "ar" ? "تفاصيل التسوية" : "Settlement Details"}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "طريقة التسوية" : "Method"}</span>
                          <span className="text-xs font-black uppercase bg-gray-200 px-3 py-1.5 rounded-md text-gray-800">
                            {printData.settlementMethod === 'money' ? (lang === "ar" ? 'نقدى/تحويل' : 'Money/Transfer') : (lang === "ar" ? 'استبدال بضاعة' : 'Products Exchange')}
                          </span>
                        </div>
                        {printData.settlementMethod === 'money' && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "موعد الدفع" : "Timing"}</span>
                              <span className="text-sm font-bold text-gray-900">{printData.paymentTiming === 'now' ? (lang === "ar" ? 'فوري' : 'Immediate') : (lang === "ar" ? 'آجل' : 'Later')}</span>
                            </div>
                            {printData.paymentTiming === 'later' && printData.expectedPaymentDate && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</span>
                                <span className="text-sm font-bold text-red-600">{new Date(printData.expectedPaymentDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "الحالة" : "Status"}</span>
                          <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-md ${printData.isSettled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {printData.isSettled ? (lang === "ar" ? "تمت التسوية" : "Settled") : (lang === "ar" ? "قيد الانتظار" : "Pending")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 text-left" dir="ltr">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Total Value</span>
                      <div className="flex items-end gap-2">
                        <span className="text-5xl font-black text-gray-900 leading-none">{printData.totalPrice || 0}</span>
                        <span className="text-xl font-bold text-gray-500 mb-1">EGP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Block */}
                <div className="mb-12">
                  <h3 className="text-lg font-black mb-4 uppercase tracking-tight text-gray-800">{lang === "ar" ? "تفاصيل الأصناف المرتجعة" : "Returned Items Inventory"}</h3>
                  
                  {printData.items.length === 1 && printData.items[0].barcode === "N/A" ? (
                    <div className="border-4 border-gray-200 border-dashed rounded-3xl p-10 text-center bg-gray-50 my-8">
                      <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-2xl font-black text-gray-800 mb-3">{lang === "ar" ? "مطابق لمستند التحويل الصادر من النظام" : "ALL ITEMS MATCH SYSTEM TRANSFER OUT EXACTLY"}</p>
                      <p className="text-base font-bold text-gray-500">{lang === "ar" ? "لا يوجد إدخال يدوي للعناصر - تم استلام البضاعة كما هي في مستند التحويل المرفق" : "No items manually appended - goods received exactly as per system transfer document"}</p>
                    </div>
                  ) : (
                    <div className="border-2 border-black rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                          <tr className="border-b-2 border-black">
                            <th className="py-4 px-4 font-black text-xs text-gray-500 uppercase tracking-wider w-16 text-center border-r-2 border-black">#</th>
                            <th className="py-4 px-4 font-black text-xs text-gray-500 uppercase tracking-wider w-48 border-r-2 border-black">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                            <th className="py-4 px-4 font-black text-xs text-gray-500 uppercase tracking-wider border-r-2 border-black">{lang === "ar" ? "الصنف" : "Item Description"}</th>
                            <th className="py-4 px-4 font-black text-xs text-gray-500 uppercase tracking-wider w-24 text-center">{lang === "ar" ? "الكمية" : "Qty"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y border-black">
                          {printData.items.map((it: any, i: number) => (
                            <tr key={it.id || i}>
                              <td className="py-3 px-4 font-bold text-gray-500 text-center border-r-2 border-black">{i + 1}</td>
                              <td className="py-3 px-4 font-mono font-bold text-sm text-gray-800 border-r-2 border-black tracking-wider">{it.barcode}</td>
                              <td className="py-3 px-4 font-black text-gray-900 border-r-2 border-black text-lg">{it.itemName}</td>
                              <td className="py-3 px-4 font-black text-gray-900 text-center text-xl">{it.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-black">
                          <tr>
                            <td colSpan={3} className="py-4 px-6 text-right font-black text-gray-600 uppercase tracking-wider border-r-2 border-black">
                              {lang === "ar" ? "إجمالي عدد الوحدات المرتجعة" : "Total Units Returned"}
                            </td>
                            <td className="py-4 px-4 text-center font-black text-3xl text-gray-900">
                              {printData.items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Signatures & Approvals */}
                <div className="mt-16 pt-8 border-t-4 border-gray-100 break-inside-avoid">
                  <div className="text-center mb-12">
                    <p className="font-black text-lg text-gray-900 mb-1">{lang === "ar" ? "* مرفق صورة البطاقة الخاصة بالمندوب *" : "* Copy of Agent ID is attached *"}</p>
                    <p className="text-sm font-bold text-gray-500">Document valid only with authorized signatures and ID copy attached.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-24 px-12">
                    <div className="text-center relative">
                      <div className="absolute -top-10 left-0 right-0 opacity-10 font-black text-6xl pointer-events-none text-gray-400">AGENT</div>
                      <p className="font-black text-gray-400 text-xs uppercase tracking-widest mb-16">{lang === "ar" ? "توقيع المندوب" : "Supplier Agent Signature"}</p>
                      <div className="border-t-2 border-black pt-3">
                        <p className="font-black text-gray-900 text-lg uppercase">{printData.agentName}</p>
                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Delivered By</p>
                      </div>
                    </div>
                    <div className="text-center relative">
                      <div className="absolute -top-10 left-0 right-0 opacity-10 font-black text-6xl pointer-events-none text-gray-400">STORE</div>
                      <p className="font-black text-gray-400 text-xs uppercase tracking-widest mb-16">{lang === "ar" ? "توقيع المدير / المستلم" : "Store Manager Signature"}</p>
                      <div className="border-t-2 border-black pt-3">
                        <p className="font-black text-gray-900 text-lg uppercase">{printData.items[0]?.createdBy || "Store Manager"}</p>
                        <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Received By</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-12 pt-8 border-t border-gray-200">
                  <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Generated by Circle K Franchise Operations System</p>
                </div>

              </div>
            </div>
          </div>
        )}

'''

content = content[:start_idx] + new_print_block + content[end_idx:]

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

