import re

with open('src/app/shift-reports/manager/page.tsx', 'r') as f:
    content = f.read()

# We want to find the exact block from `return (` after `shiftGrade = "D";` to `})()}`
start_marker = "          return (\n            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>"
end_marker = "            </div>\n          );\n        })()}"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker) + len(end_marker)
    
    original_block = content[start_idx:end_idx]
    
    # We will rebuild the block
    new_block = """          const securityBorders = (
            <>
              {/* Micro-Typography Security Borders */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px', overflow: 'hidden' }}>
                <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
                <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {Array(25).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>
              <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', padding: '4px', overflow: 'hidden', writingMode: 'vertical-rl' }}>
                <div style={{ fontSize: '6px', color: '#cbd5e1', fontFamily: 'monospace', letterSpacing: '3px', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {Array(35).fill("ANH REPORTS INTERNAL USE ONLY • ").join("")}
                </div>
              </div>

              {/* Automated Digital Audit Stamp (Giant Watermark) */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', fontSize: '90px', fontWeight: '900', color: (shiftGrade === "F" || shiftGrade === "C" || shiftGrade === "D") ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.06)', zIndex: 5, whiteSpace: 'nowrap', pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '5px' }}>
                {(shiftGrade === "F" || shiftGrade === "C" || shiftGrade === "D") ? "AUDIT REQUIRED" : "VERIFIED: BALANCED"}
              </div>
            </>
          );

          const renderHeader = (title: string) => (
            <div style={{ padding: '20px 40px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #1e293b', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '70px', height: '70px', backgroundColor: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '42px', fontWeight: '900', color: '#ffffff', lineHeight: 1 }}>K</span>
                </div>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>CIRCLE K EL-ALAMEIN 4</h1>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '2px 0 0', fontWeight: '600' }}>{title}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: gradeBg, border: `3px solid ${gradeBorder}`, borderRadius: '12px', padding: '10px 15px', minWidth: '70px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Grade</p>
                  <p style={{ margin: 0, fontSize: '34px', fontWeight: '900', color: gradeText, lineHeight: 1 }}>{shiftGrade}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px' }}>
                  <Barcode value={selectedReport.id.substring(0, 10).toUpperCase()} width={1.5} height={35} fontSize={10} displayValue={true} margin={0} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px' }}>
                  {typeof window !== 'undefined' && (
                    <QRCode value={window.location.origin + '/shift-reports/view?id=' + selectedReport.id} size={54} level="M" />
                  )}
                </div>
              </div>
            </div>
          );

          const signatures = (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <div style={{ width: '33%' }}>
                <p style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.4 }}>
                  I, the undersigned cashier, declare that the physical counts provided above are accurate, and I have surrendered the declared funds to the manager.
                </p>
                {selectedReport.cashierSignature ? (
                  <img src={selectedReport.cashierSignature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '50px', objectFit: 'contain', marginBottom: '5px' }} />
                ) : (
                  <div style={{ height: '50px', marginBottom: '5px' }}></div>
                )}
                <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: '8px' }}></div>
                <p style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>{selectedReport.cashierDetails.name}</p>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', margin: '2px 0 0', textTransform: 'uppercase' }}>Declaring Cashier</p>
              </div>

              <div style={{ width: '33%' }}>
                <p style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.4 }}>
                  I, the undersigned manager, declare that I have physically counted the funds and verified the variances against the system expectations.
                </p>
                {selectedReport.managerAudit?.signature ? (
                  <img src={selectedReport.managerAudit.signature} alt="Signature" style={{ display: 'block', maxWidth: '100%', height: '50px', objectFit: 'contain', marginBottom: '5px' }} />
                ) : (
                  <div style={{ height: '50px', marginBottom: '5px' }}></div>
                )}
                <div style={{ borderBottom: '2px solid #1e293b', width: '100%', marginBottom: '8px' }}></div>
                <p style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>{managerName}</p>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b', margin: '2px 0 0', textTransform: 'uppercase' }}>Auditing Manager</p>
              </div>

              <div style={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: '90px', border: '2px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '20px', color: '#cbd5e1', marginBottom: '4px' }}></span>
                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.5px' }}>Official Branch<br />Stamp / Seal</span>
                </div>
              </div>
            </div>
          );

          const footer = (
            <div style={{ marginTop: 'auto', marginBottom: '20px', marginLeft: '40px', marginRight: '40px', borderTop: '2px solid #1e293b', paddingTop: '10px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
              <p style={{ fontSize: '9px', color: '#475569', fontFamily: 'monospace', margin: 0, letterSpacing: '0.5px', fontWeight: 'bold' }}>
                DOCUMENT SHIFT-{selectedReport.id.substring(0, 10).toUpperCase()} | PRINTED: {formatTimeMinus2Hours(new Date().toISOString())} | AUTHORIZED BY: MANAGER_{managerName.replace(/\s+/g, '_').toUpperCase() || "PENDING"} | SYSTEM: ANH PORTAL V2.0
              </p>
            </div>
          );

          return (
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
              {/* PAGE 1: FINANCIAL AUDIT */}
              <div id="pdf-page-1" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
                {securityBorders}
                {renderHeader(selectedReport.cashierRole === 2 ? "SHIFT REPORT" : "SHIFT REPORT (FINANCIALS)")}

                <div style={{ padding: '10px 40px', position: 'relative', zIndex: 10 }}>
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRight: '4px solid #3b82f6', borderRadius: '8px', padding: '4px 10px', direction: 'rtl', textAlign: 'right', marginBottom: '8px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#1e293b', lineHeight: 1.5, fontWeight: 'bold' }}><span style={{ color: '#3b82f6', marginLeft: '6px' }}>✦</span>{generateEgyptianSummary()}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#1e293b', lineHeight: 1.5, fontWeight: 'bold' }}><span style={{ color: '#3b82f6', marginLeft: '6px' }}>✦</span>{generateVolumeContext()}</p>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '8px', padding: '8px 20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected System Cash</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>EGP {Number(expectedCash).toLocaleString()}</p>
                    </div>
                    <div style={{ width: '2px', backgroundColor: '#e2e8f0', alignSelf: 'stretch' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actual Cashier Cash</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>EGP {selectedReport?.cashierCounts?.cash?.toLocaleString()}</p>
                    </div>
                    <div style={{ width: '2px', backgroundColor: '#e2e8f0', alignSelf: 'stretch' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total System Visa</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>EGP {Number(expectedVisa).toLocaleString()}</p>
                    </div>
                    <div style={{ width: '2px', backgroundColor: '#e2e8f0', alignSelf: 'stretch' }}></div>
                    <div style={{ textAlign: 'center', backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 20px', borderRadius: '6px', margin: '-5px 0' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Net Sales (Sys)</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>EGP {(Number(expectedCash) + Number(expectedVisa)).toLocaleString()}</p>
                    </div>
                  </div>

                  <div style={{ border: '2px solid #e2e8f0', marginBottom: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '6px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      1. Shift & Branch Information
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '6px' }}>
                        <div><p style={{ margin: '0 0 5px', color: '#64748b' }}>Audited By</p><p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{managerName || "Pending"}</p></div>
                        <div><p style={{ margin: '0 0 5px', color: '#64748b' }}>Date Audited</p><p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{formatTimeMinus2Hours(selectedReport.managerAudit?.auditedAt || new Date().toISOString())}</p></div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0' }}>
                      <div style={{ padding: '10px 15px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Branch / Store ID</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.storeId}</p></div>
                      <div style={{ padding: '10px 15px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Shift Period</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.shift} Shift</p></div>
                      <div style={{ padding: '10px 15px', borderBottom: '1px solid #e2e8f0' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Cashier Name</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.name}</p></div>
                      <div style={{ padding: '10px 15px', borderRight: '1px solid #e2e8f0' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Operating Date</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport?.cashierDetails?.date}</p></div>
                      <div style={{ padding: '10px 15px', borderRight: '1px solid #e2e8f0' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Cashier Role</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{selectedReport.cashierRole === 2 ? 'Cashier 2 (Money Only)' : 'Cashier 1 (Full)'}</p></div>
                      <div style={{ padding: '10px 15px' }}><p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px', fontWeight: 'bold' }}>Submission Timestamp</p><p style={{ fontSize: '16px', color: '#0f172a', fontWeight: 'bold', margin: 0 }}>{formatTimeMinus2Hours(selectedReport.createdAt)}</p></div>
                    </div>
                  </div>

                  <div style={{ border: '2px solid #e2e8f0', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '4px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>2. Financial Audit & Variance</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                      <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr><th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1' }}>Tender Type</th><th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1' }}>Cashier Declared</th><th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1' }}>Manager / POS Expected</th><th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', textAlign: 'right' }}>Variance</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Cash</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>EGP {selectedReport?.cashierCounts?.cash?.toLocaleString()}</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(expectedCash).toLocaleString() || "0"}</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px', textAlign: 'right', fontWeight: 'bold', color: calculateCashVariance() < 0 ? '#dc2626' : '#16a34a' }}>{calculateCashVariance() < 0 ? '-' : '+'}EGP {Math.abs(calculateCashVariance()).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Visa</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>EGP {selectedReport?.cashierCounts?.visa?.toLocaleString()}</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>EGP {Number(expectedVisa).toLocaleString() || "0"}</td>
                          <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '13px', textAlign: 'right', fontWeight: 'bold', color: calculateVisaVariance() < 0 ? '#dc2626' : '#16a34a' }}>{calculateVisaVariance() < 0 ? '-' : '+'}EGP {Math.abs(calculateVisaVariance()).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* The Z-Report Staple Box */}
                  <div style={{ marginTop: '30px', marginBottom: '20px', width: '80mm', height: '100px', border: '2px dashed #94a3b8', borderRadius: '6px', margin: '30px auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                    <div style={{ width: '40px', height: '8px', backgroundColor: '#cbd5e1', borderRadius: '4px', marginBottom: '8px' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Staple Z-Report Here</span>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', marginTop: '4px' }}>(80mm Receipt Width)</span>
                  </div>

                  {/* Manager Notes on Page 1 if Cashier 2 */}
                  {selectedReport.cashierRole === 2 && (
                    <div style={{ border: '2px solid #e2e8f0', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '4px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Manager Comments</div>
                      <div style={{ padding: '6px 15px', fontSize: '11px', color: '#334155', fontStyle: selectedReport.managerAudit?.comments ? 'normal' : 'italic' }}>
                        {selectedReport.managerAudit?.comments || "No additional comments provided."}
                      </div>
                    </div>
                  )}

                  {signatures}
                </div>
                {footer}
              </div>

              {/* PAGE 2: INVENTORY AUDIT (Only for Cashier 1) */}
              {selectedReport.cashierRole !== 2 && (
                <div id="pdf-page-2" style={{ width: '794px', minHeight: '1123px', backgroundColor: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', marginTop: '20px' }}>
                  {securityBorders}
                  {renderHeader("SHIFT REPORT (INVENTORY)")}
                  
                  <div style={{ padding: '10px 40px', position: 'relative', zIndex: 10 }}>
                    <div style={{ border: '2px solid #e2e8f0', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '4px 15px', borderBottom: '2px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        3. Inventory Counts & Shrinkage
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                        <thead style={{ backgroundColor: '#f1f5f9' }}>
                          <tr>
                            <th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Item</th>
                            <th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Start</th>
                            <th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>Delivery</th>
                            <th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>End</th>
                            <th style={{ padding: '4px 15px', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'right' }}>Calculated Sold</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.inventoryCounts?.cigarettes && (
                            <tr>
                              <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Cigarettes</td>
                              <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.start || 0}</td>
                              <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.delivery || 0}</td>
                              <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.cigarettes?.end || 0}</td>
                              <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{selectedReport.inventoryCounts?.cigarettes?.sold || 0}</td>
                            </tr>
                          )}
                          {selectedReport.inventoryCounts?.cigaretteCounts && Object.entries(selectedReport.inventoryCounts.cigaretteCounts).map(([type, count]) => {
                            const isObj = typeof count === 'object' && count !== null;
                            const start = isObj ? (count as any).start || "0" : "-";
                            const delivery = isObj ? (count as any).delivery || "0" : "-";
                            const end = isObj ? (count as any).end || "0" : String(count || "0");
                            const s = Number(start) || 0;
                            const d = Number(delivery) || 0;
                            const e = Number(end) || 0;
                            const sold = isObj ? String(s + d - e) : "-";
                            return (
                              <tr key={type}>
                                <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '10px' }}>{type}</td>
                                <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{start}</td>
                                <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{delivery}</td>
                                <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>{end}</td>
                                <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{sold}</td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Lighters</td>
                            <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.start || 0}</td>
                            <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.delivery || 0}</td>
                            <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0' }}>{selectedReport.inventoryCounts?.lighters?.end || 0}</td>
                            <td style={{ padding: '6px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{selectedReport.inventoryCounts?.lighters?.sold || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                        <div style={{ padding: '6px 15px' }}><span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginRight: '10px' }}>Coffee Shrink</span><span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>{Number(coffeePercent) || 0}%</span></div>
                      </div>
                    </div>

                    <div style={{ border: '2px solid #e2e8f0', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '4px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>4. Manager Comments & Review</div>
                      <div style={{ padding: '6px 15px', fontSize: '11px', color: '#334155' }}>
                        {selectedReport.managerAudit?.rejectReason && (
                          <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #cbd5e1' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '9px', fontWeight: 'bold', color: '#dc2626', textTransform: 'uppercase' }}>Previous Rejection Reason (Corrected by Cashier)</p>
                            <p style={{ margin: 0, fontStyle: 'italic', color: '#dc2626' }}>"{selectedReport.managerAudit.rejectReason}"</p>
                          </div>
                        )}
                        <div style={{ fontStyle: selectedReport.managerAudit?.comments ? 'normal' : 'italic' }}>
                          {selectedReport.managerAudit?.comments || "No additional comments provided by the auditing manager."}
                        </div>
                      </div>
                    </div>

                    {signatures}
                  </div>
                  {footer}
                </div>
              )}
            </div>
          );
        })()}"""
    
    with open('src/app/shift-reports/manager/page.tsx', 'w') as f:
        f.write(content[:start_idx] + new_block + content[end_idx:])
    print("Success")
else:
    print("Failed to find markers")

