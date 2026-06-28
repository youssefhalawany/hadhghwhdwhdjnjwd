                      Confirm & Generate Receipt
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE RECEIPT MODAL */}
        {printData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center no-print">
                <h3 className="font-bold flex items-center gap-2 text-blue-500"><Printer className="h-5 w-5"/> Print Ready</h3>
                <div className="flex gap-2">
                  {!printData.isSettled && printData.eventIds && (
                    <button 
                      onClick={() => {
                        if (!confirm("Confirm that you have received the pending payment/products for ALL items in this return?")) return;
                        printData.eventIds.forEach((id: string) => handleSettlePayment(id));
                        setPrintData(null);
                      }}
                      className="px-4 py-2 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"
                    >
                      Mark as Paid
                    </button>
                  )}
                  <button onClick={() => setPrintData(null)} className="px-4 py-2 text-sm font-bold border border-border rounded-lg hover:bg-muted">Close</button>
                  <button onClick={triggerPrint} className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                    <Printer className="h-4 w-4" /> Print Invoice
                  </button>
                </div>
              </div>
              
              <div className="p-8 overflow-y-auto bg-white text-black print:p-0 print:block w-full" id="print-area" dir="ltr">
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    @page { size: A4; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  }
                `}} />
                
                {/* Header: Logo & Title */}
                <div className="text-center mb-8 border-b-2 border-black pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                      <span className="text-white font-black text-3xl">K</span>
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-black mb-1">نموذج استلام مرتجعات</h1>
                  <h2 className="text-xl font-bold text-gray-700">Return Receipt Form</h2>
                </div>

                {/* Return Information Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">بيانات المرتجع</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Return Information</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6">
                    <div className="grid grid-cols-3 gap-6 text-center text-black">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Company</span><span>الشركة</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg">{printData.supplier}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Return Number</span><span>رقم المرتجع</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.returnNumber}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Date</span><span>التاريخ</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.date}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Declaration Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">إقرار الاستلام</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Declaration</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6 text-center">
                    <p className="font-bold text-xl text-black mb-1">والكميات الموجوده صحيحه ومطابقه للنظام وهذا إقرار منا بذلك</p>
                    <p className="font-bold text-lg text-gray-700">All quantities are correct and match the system records</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                  <table className="w-full text-center border-collapse border-2 border-black text-black">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-black">
                        <th className="py-2 border-r-2 border-black font-bold">
                          <div>الصنف</div>
                          <div className="text-xs text-gray-600">{lang === "ar" ? "اسم الصنف" : "Item Name"}</div>
                        </th>
                        <th className="py-2 border-r-2 border-black font-bold">
                          <div>الباركود</div>
                          <div className="text-xs text-gray-600">{lang === "ar" ? "الباركود" : "Barcode"}</div>
                        </th>
                        <th className="py-2 font-bold w-32">
                          <div>الكمية</div>
                          <div className="text-xs text-gray-600">Quantity</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black">
                      {printData.items.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className="py-3 border-r-2 border-black font-bold text-lg">{item.itemName}</td>
                          <td className="py-3 border-r-2 border-black font-mono font-bold tracking-wider">{item.barcode}</td>
                          <td className="py-3 font-black text-2xl">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-black font-black">
                        <td colSpan={2} className="py-3 border-r-2 border-black text-xl">
                          <div className="flex justify-between px-8">
                            <span>Total Items Returned</span>
                            <span>إجمالي المرتجعات</span>
                          </div>
                        </td>
                        <td className="py-3 text-2xl">
                          {printData.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Agent Information Section */}
                <div className="mb-8 relative">
                  <div className="absolute top-0 right-0 left-0 flex justify-between items-center -mt-3">
                    <span className="bg-white pr-4 font-bold text-red-600 text-lg" dir="rtl">بيانات المندوب</span>
                    <span className="bg-white pl-4 font-bold text-red-600 text-lg">Agent Information</span>
                  </div>
                  <div className="border-t-2 border-red-600 pt-6">
                    <div className="grid grid-cols-3 gap-6 text-center text-black mb-4">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>{lang === "ar" ? "اسم المندوب" : "Agent Name"}</span><span>اسم المندوب</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg">{printData.agentName}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>{lang === "ar" ? "الرقم القومي" : "National ID"}</span><span>رقم البطاقة</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-widest">{printData.agentNationalId}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-gray-500 mb-1"><span>Mobile</span><span>رقم الموبايل</span></div>
                        <div className="border-b-2 border-black pb-1 font-bold text-lg tracking-wider">{printData.agentMobile}</div>
                      </div>
                    </div>
                    <div className="text-center mt-6">
                      <p className="font-bold text-lg text-black" dir="rtl">* مرفق صورة البطاقة الخاصة بالمندوب *</p>
                      <p className="font-bold text-md text-gray-700">* Copy of Agent ID is attached *</p>
                    </div>
                  </div>
                </div>

                {/* Signatures Section */}
                <div className="mt-8 grid grid-cols-2 gap-16 text-black pt-4">
                  <div className="text-center px-8">
                    <div className="flex justify-between text-sm font-bold text-gray-500 mb-16">
                      <span>Agent Signature</span>
                      <span>توقيع المندوب</span>
                    </div>
                    <div className="border-b-2 border-black w-full"></div>
                  </div>
                  <div className="text-center px-8">
                    <div className="flex justify-between text-sm font-bold text-gray-500 mb-16">
                      <span>Receiver Signature</span>
                      <span>توقيع المستلم</span>
                    </div>
                    <div className="border-b-2 border-black w-full"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}} />

      </div>
    </div>
  );
}
