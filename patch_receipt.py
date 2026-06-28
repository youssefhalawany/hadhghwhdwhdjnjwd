import sys
import re

with open("src/app/dashboard/supplier-returns/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "{/* PRINT VIEW */}"
end_marker = "{/* Manual Direct Return Modal */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find print view block")
    sys.exit(1)

old_print_view = content[start_idx:end_idx]

new_print_view = '''{/* PRINT VIEW */}
            {printData && (
              <div className="fixed inset-0 z-50 bg-white print-only-container overflow-y-auto">
                <div className="max-w-4xl mx-auto p-12 bg-white min-h-screen text-black" dir={lang === "ar" ? "rtl" : "ltr"}>
                  
                  {/* Corporate Header */}
                  <div className="flex justify-between items-start border-b-4 border-gray-900 pb-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="bg-red-600 text-white p-3 rounded-lg font-black text-3xl tracking-tighter">K</div>
                      <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">Circle K</h1>
                        <p className="text-sm font-bold text-gray-500">{printData.items[0]?.storeId || "Branch"}</p>
                      </div>
                    </div>
                    <div className="text-right" dir="ltr">
                      <h2 className="text-4xl font-black text-gray-800 tracking-tighter">RTV RECEIPT</h2>
                      <p className="text-lg font-bold text-red-600 mt-1"># {printData.items[0]?.returnNumber || "N/A"}</p>
                      <p className="text-sm font-semibold text-gray-500 mt-1">{new Date(printData.items[0]?.returnedAt || Date.now()).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Meta Information Grid */}
                  <div className="grid grid-cols-2 gap-8 mb-8 border-b-2 border-gray-200 pb-8">
                    {/* Supplier Info */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">{lang === "ar" ? "بيانات المورد" : "Supplier Information"}</h3>
                      <p className="text-2xl font-black text-gray-900 mb-2">{printData.items[0]?.supplier}</p>
                      <div className="space-y-1 mt-4">
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                          <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "اسم المندوب" : "Agent Name"}</span>
                          <span className="text-sm font-bold text-gray-900">{printData.agentName}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                          <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "رقم الهاتف" : "Mobile"}</span>
                          <span className="text-sm font-bold text-gray-900">{printData.agentMobile}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                          <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "الرقم القومي" : "National ID"}</span>
                          <span className="text-sm font-black tracking-widest text-gray-900">{printData.agentNationalId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">{lang === "ar" ? "تفاصيل التسوية" : "Settlement Details"}</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "طريقة التسوية" : "Settlement Method"}</span>
                            <span className="text-sm font-black uppercase bg-gray-200 px-3 py-1 rounded-full text-gray-800">
                              {printData.settlementMethod === 'money' ? (lang === "ar" ? 'نقدى/تحويل' : 'Money/Transfer') : (lang === "ar" ? 'استبدال بضاعة' : 'Products')}
                            </span>
                          </div>
                          {printData.settlementMethod === 'money' && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "موعد الدفع" : "Payment Timing"}</span>
                                <span className="text-sm font-bold text-gray-900">{printData.paymentTiming === 'now' ? (lang === "ar" ? 'فوري' : 'Now') : (lang === "ar" ? 'آجل' : 'Later')}</span>
                              </div>
                              {printData.paymentTiming === 'later' && printData.expectedPaymentDate && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-500">{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</span>
                                  <span className="text-sm font-bold text-red-600">{new Date(printData.expectedPaymentDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 text-right">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">{lang === "ar" ? "القيمة الإجمالية" : "Total Value"}</span>
                        <span className="text-4xl font-black text-gray-900">{printData.totalPrice || 0} <span className="text-lg text-gray-500">EGP</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mb-8">
                    <h3 className="text-xl font-black mb-4 uppercase tracking-tight">{lang === "ar" ? "المرتجعات" : "Returned Items"}</h3>
                    
                    {printData.items.length === 1 && printData.items[0].barcode === "N/A" ? (
                      <div className="border-4 border-gray-200 border-dashed rounded-2xl p-8 text-center bg-gray-50">
                        <p className="text-2xl font-black text-gray-800 mb-2">{lang === "ar" ? "مطابق لمستند التحويل الصادر من النظام" : "ALL ITEMS MATCH SYSTEM TRANSFER OUT EXACTLY"}</p>
                        <p className="text-sm font-bold text-gray-500">{lang === "ar" ? "لا يوجد إدخال يدوي للعناصر - تم استلام البضاعة كما هي في مستند التحويل" : "No items manually appended - goods received exactly as per system transfer document"}</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-900">
                            <th className="py-3 px-2 font-bold text-sm text-gray-500 uppercase tracking-wider">#</th>
                            <th className="py-3 px-2 font-bold text-sm text-gray-500 uppercase tracking-wider">{lang === "ar" ? "الباركود" : "Barcode"}</th>
                            <th className="py-3 px-2 font-bold text-sm text-gray-500 uppercase tracking-wider w-1/2">{lang === "ar" ? "الصنف" : "Item"}</th>
                            <th className="py-3 px-2 font-bold text-sm text-gray-500 uppercase tracking-wider text-right">{lang === "ar" ? "الكمية" : "Qty"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printData.items.map((it: any, i: number) => (
                            <tr key={it.id || i} className="border-b border-gray-200">
                              <td className="py-3 px-2 font-semibold text-gray-500">{i + 1}</td>
                              <td className="py-3 px-2 font-mono text-sm text-gray-600">{it.barcode}</td>
                              <td className="py-3 px-2 font-bold text-gray-900">{it.itemName}</td>
                              <td className="py-3 px-2 font-black text-gray-900 text-right text-lg">{it.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Notice & Signatures */}
                  <div className="mt-16 pt-8 border-t-2 border-gray-200 break-inside-avoid">
                    <div className="text-center mb-12">
                      <p className="font-black text-lg text-gray-900 mb-1">{lang === "ar" ? "* مرفق صورة البطاقة الخاصة بالمندوب *" : "* Copy of Agent ID is attached *"}</p>
                      <p className="text-sm font-bold text-gray-500">Document valid only with authorized signatures and ID copy</p>
                    </div>

                    <div className="grid grid-cols-2 gap-24 px-12">
                      <div className="text-center">
                        <p className="font-bold text-gray-500 text-sm uppercase tracking-widest mb-16">{lang === "ar" ? "توقيع المندوب" : "Agent Signature"}</p>
                        <div className="border-t-2 border-gray-900 pt-2">
                          <p className="font-black text-gray-900">{printData.agentName}</p>
                          <p className="text-xs font-bold text-gray-500">Delivered By</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-500 text-sm uppercase tracking-widest mb-16">{lang === "ar" ? "توقيع المدير / المستلم" : "Manager Signature"}</p>
                        <div className="border-t-2 border-gray-900 pt-2">
                          <p className="font-black text-gray-900">{printData.items[0]?.createdBy || "Store Manager"}</p>
                          <p className="text-xs font-bold text-gray-500">Received By</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-12 pt-8 text-xs font-bold text-gray-400">
                    Generated by Circle K Franchise Operations System
                  </div>
                </div>
              </div>
            )}

            '''

content = content[:start_idx] + new_print_view + content[end_idx:]

with open("src/app/dashboard/supplier-returns/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

