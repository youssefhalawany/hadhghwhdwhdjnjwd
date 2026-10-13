import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  isCurrency?: boolean;
  headerColor?: string; // ARGB hex e.g. "FFB45309"
  align?: "left" | "center" | "right";
}

export interface ExcelVendorDossier {
  companyName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  beneficiaryName?: string;
  contacts?: string[];
  totalCredits?: number;
  totalPaid?: number;
  totalReturns?: number;
  netBalance?: number;
}

export interface ExcelKpiCard {
  label: string;
  value: number | string;
  isCurrency?: boolean;
  color?: "amber" | "emerald" | "blue" | "crimson" | "slate";
}

export interface ExcelExportOptions {
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  data: any[];
  filters?: Record<string, string>;
  sheetName?: string;
  creator?: string;
  branchName?: string;
  vendorDossier?: ExcelVendorDossier;
  kpis?: ExcelKpiCard[];
}

export const exportToExcel = async (options: ExcelExportOptions) => {
  const {
    title,
    subtitle = "OFFICIAL STATEMENT OF ACCOUNT & VENDOR TRANSACTION DOSSIER",
    columns,
    data,
    filters = {},
    sheetName = "كشف حساب - Statement",
    creator = "Circle K Egypt - El Alamein 4",
    branchName = "Circle K - El Alamein 4",
    vendorDossier,
    kpis
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator;
  workbook.lastModifiedBy = creator;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Corporate Color Palette (Circle K Brand & Executive Accounting Palette)
  const NAVY_HERO = "FF0F172A";     // Slate 900
  const BRAND_RED = "FFDC2626";     // Circle K Crimson Red
  const BRAND_AMBER = "FFB45309";   // Amber 700 (Credit Money Column)
  const BRAND_EMERALD = "FF047857"; // Emerald 700 (Paid Money Column)
  const BRAND_BLUE = "FF1D4ED8";    // Blue 700 (Returns Column)
  const BRAND_DARK_NAVY = "FF090D16";// Midnight Navy (Running Balance Column)
  const BRAND_SLATE = "FF334155";   // Slate 700 (Standard Headers)
  const TEXT_WHITE = "FFFFFFFF";
  const TEXT_DARK = "FF0F172A";
  const TEXT_MUTED = "FF475569";
  const GRAY_LIGHT = "FFF8FAFC";    // Slate 50 Zebra row
  const GRAY_BORDER = "FFCBD5E1";   // Slate 300
  const CARD_BG = "FFF1F5F9";       // Slate 100

  // Valid ECMA-376 Accounting Currency format (Quotes ensure Excel opens without XML repair error, zero formats as clean dash '-')
  const CURRENCY_FMT = '#,##0.00 "EGP";(#,##0.00 "EGP");"-"';

  const totalCols = Math.max(columns.length, 11);

  // Border formatting helpers
  const thinBorder: any = {
    top: { style: "thin", color: { argb: GRAY_BORDER } },
    left: { style: "thin", color: { argb: GRAY_BORDER } },
    bottom: { style: "thin", color: { argb: GRAY_BORDER } },
    right: { style: "thin", color: { argb: GRAY_BORDER } }
  };

  const cardBorder: any = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    right: { style: "thin", color: { argb: "FF94A3B8" } }
  };

  // Determine starting row for the main data table
  const hasDossierOrKpis = !!vendorDossier || (kpis && kpis.length > 0);
  const headerRowIndex = hasDossierOrKpis ? 11 : 7;

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: headerRowIndex, showGridLines: true }],
    pageSetup: { paperSize: 9, orientation: "landscape" } // A4 Landscape for financial tables
  });

  const normBranch = (branchName || "").toUpperCase();
  const isAlamein =
    normBranch.includes("ALAMEIN") ||
    normBranch.includes("EL-ALAMEIN") ||
    normBranch.includes("EL ALAMEIN") ||
    !branchName;

  // --- 1. Top Brand Hero Banner (Row 1) ---
  worksheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = isAlamein
    ? "CIRCLE K EGYPT — EL-ALAMEIN 4 (سيركل كيه مصر - فرع العلمين 4)"
    : `CIRCLE K EGYPT — ${branchName.toUpperCase()}`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: TEXT_WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_HERO } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 36;

  // --- 2. Subtitle Banner (Row 2) ---
  worksheet.mergeCells(2, 1, 2, totalCols);
  const subtitleCell = worksheet.getCell("A2");
  subtitleCell.value = `${title} — ${subtitle}`;
  subtitleCell.font = { name: "Arial", size: 10, bold: true, color: { argb: TEXT_WHITE } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 22;

  // Row 3: Blank separator
  worksheet.getRow(3).height = 8;

  if (hasDossierOrKpis) {
    const midCol = Math.floor(totalCols / 2);

    // --- 3. Vendor Dossier Left Card (Rows 4-6, Cols 1 to midCol) ---
    worksheet.mergeCells(4, 1, 4, midCol);
    worksheet.mergeCells(5, 1, 5, midCol);
    worksheet.mergeCells(6, 1, 6, midCol);

    const c4_1 = worksheet.getCell(4, 1);
    c4_1.value = `الشركة الموردة (Vendor): ${vendorDossier?.companyName || title}`;
    c4_1.font = { name: "Arial", size: 10, bold: true, color: { argb: TEXT_DARK } };
    c4_1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c4_1.alignment = { horizontal: "left", vertical: "middle" };

    const c5_1 = worksheet.getCell(5, 1);
    const bankDetailsStr = vendorDossier?.bankName
      ? `${vendorDossier.bankName} | حساب / IBAN: ${vendorDossier.bankAccountNumber || "—"}`
      : "لا توجد بيانات بنكية مسجلة";
    c5_1.value = `البنك المعتمد (Bank Dossier): ${bankDetailsStr}`;
    c5_1.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0369A1" } };
    c5_1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c5_1.alignment = { horizontal: "left", vertical: "middle" };

    const c6_1 = worksheet.getCell(6, 1);
    c6_1.value = `اسم المستفيد (Beneficiary): ${vendorDossier?.beneficiaryName || vendorDossier?.companyName || "—"}`;
    c6_1.font = { name: "Arial", size: 9, color: { argb: TEXT_MUTED } };
    c6_1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c6_1.alignment = { horizontal: "left", vertical: "middle" };

    // --- 4. Branch & Audit Right Card (Rows 4-6, Cols midCol+1 to totalCols) ---
    worksheet.mergeCells(4, midCol + 1, 4, totalCols);
    worksheet.mergeCells(5, midCol + 1, 5, totalCols);
    worksheet.mergeCells(6, midCol + 1, 6, totalCols);

    const c4_r = worksheet.getCell(4, midCol + 1);
    c4_r.value = `الفرع المصدر (Issuing Branch): ${isAlamein ? "Circle K - El Alamein 4 (فرع العلمين 4)" : branchName}`;
    c4_r.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFB91C1C" } };
    c4_r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c4_r.alignment = { horizontal: "left", vertical: "middle" };

    const c5_r = worksheet.getCell(5, midCol + 1);
    c5_r.value = `تاريخ وتوقيت التقرير (Generated): ${new Date().toLocaleString("ar-EG")} | AUDIT: CERTIFIED`;
    c5_r.font = { name: "Arial", size: 9, bold: true, color: { argb: TEXT_MUTED } };
    c5_r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c5_r.alignment = { horizontal: "left", vertical: "middle" };

    const c6_r = worksheet.getCell(6, midCol + 1);
    const contactsStr = vendorDossier?.contacts && vendorDossier.contacts.length > 0
      ? vendorDossier.contacts.join(" | ")
      : "المندوب الرئيسي: مسجل بسندات السداد";
    c6_r.value = `مندوبو التسليم والتواصل (Contacts): ${contactsStr}`;
    c6_r.font = { name: "Arial", size: 9, color: { argb: TEXT_MUTED } };
    c6_r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CARD_BG } };
    c6_r.alignment = { horizontal: "left", vertical: "middle" };

    worksheet.getRow(4).height = 19;
    worksheet.getRow(5).height = 19;
    worksheet.getRow(6).height = 19;

    // Apply borders to metadata rows
    for (let r = 4; r <= 6; r++) {
      for (let c = 1; c <= totalCols; c++) {
        worksheet.getCell(r, c).border = cardBorder;
      }
    }

    // Row 7: Blank separator
    worksheet.getRow(7).height = 8;

    // --- 5. Executive KPI Metric Cards (Rows 8-9) ---
    const effectiveKpis: ExcelKpiCard[] = kpis && kpis.length > 0
      ? kpis
      : [
          {
            label: "إجمالي فواتير الآجل (Total Credits)",
            value: Number(vendorDossier?.totalCredits || 0),
            isCurrency: true,
            color: "amber"
          },
          {
            label: "إجمالي المسدد والمدفوعات (Total Paid)",
            value: Number(vendorDossier?.totalPaid || 0),
            isCurrency: true,
            color: "emerald"
          },
          {
            label: "إجمالي المرتجعات (Total Returns)",
            value: Number(vendorDossier?.totalReturns || 0),
            isCurrency: true,
            color: "blue"
          },
          {
            label: "صافي الرصيد المستحق (Net Due Balance)",
            value: Number(vendorDossier?.netBalance || 0),
            isCurrency: true,
            color: (vendorDossier?.netBalance || 0) > 0 ? "crimson" : "emerald"
          }
        ];

    const cardsCount = effectiveKpis.length;
    const baseSpan = Math.floor(totalCols / cardsCount);
    let remainder = totalCols % cardsCount;
    let currStart = 1;

    worksheet.getRow(8).height = 16;
    worksheet.getRow(9).height = 24;

    effectiveKpis.forEach((card) => {
      const span = baseSpan + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      const startC = currStart;
      const endC = currStart + span - 1;
      currStart += span;

      worksheet.mergeCells(8, startC, 8, endC);
      worksheet.mergeCells(9, startC, 9, endC);

      const colorMap: Record<string, { bg: string; text: string }> = {
        amber: { bg: "FFFEF3C7", text: "FF92400E" },
        emerald: { bg: "FFD1FAE5", text: "FF065F46" },
        blue: { bg: "FFDBEAFE", text: "FF1E40AF" },
        crimson: { bg: "FFFEE2E2", text: "FF991B1B" },
        slate: { bg: "FFF1F5F9", text: "FF334155" }
      };
      const theme = colorMap[card.color || "slate"];

      // Title cell
      const titleC = worksheet.getCell(8, startC);
      titleC.value = card.label;
      titleC.font = { name: "Arial", size: 8.5, bold: true, color: { argb: theme.text } };
      titleC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.bg } };
      titleC.alignment = { horizontal: "center", vertical: "middle" };

      // Value cell
      const valC = worksheet.getCell(9, startC);
      if (typeof card.value === "number") {
        valC.value = card.value;
        valC.numFmt = card.isCurrency ? CURRENCY_FMT : "#,##0.00";
      } else {
        valC.value = String(card.value);
      }
      valC.font = { name: "Arial", size: 12, bold: true, color: { argb: theme.text } };
      valC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.bg } };
      valC.alignment = { horizontal: "center", vertical: "middle" };

      // Borders for cards
      for (let c = startC; c <= endC; c++) {
        worksheet.getCell(8, c).border = cardBorder;
        worksheet.getCell(9, c).border = cardBorder;
      }
    });

    // Row 10: Blank separator
    worksheet.getRow(10).height = 10;
  } else {
    // Basic metadata block for standard exports
    worksheet.getCell("A4").value = "Branch:";
    worksheet.getCell("A4").font = { bold: true };
    worksheet.getCell("B4").value = isAlamein ? "Circle K - El Alamein 4" : branchName;

    worksheet.getCell("A5").value = "Date Generated:";
    worksheet.getCell("A5").font = { bold: true };
    worksheet.getCell("B5").value = new Date().toLocaleString("ar-EG");

    let filterStr = "";
    Object.entries(filters).forEach(([key, val]) => {
      if (val) filterStr += `${key}: ${val} | `;
    });
    if (filterStr) {
      worksheet.getCell("D4").value = "Filters Applied:";
      worksheet.getCell("D4").font = { bold: true };
      worksheet.getCell("E4").value = filterStr.slice(0, -3);
    }
  }

  // --- 6. Table Headers (headerRowIndex) ---
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 32;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: TEXT_WHITE } };

    // Intelligent color classification if not explicitly given
    let colColor = col.headerColor;
    if (!colColor) {
      const lower = col.key.toLowerCase();
      if (lower.includes("credit") || lower.includes("invoiced")) {
        colColor = BRAND_AMBER; // Warm Gold / Amber for Credit Money
      } else if (lower.includes("paid") || lower.includes("payment")) {
        colColor = BRAND_EMERALD; // Emerald for Paid Money
      } else if (lower.includes("return") || lower.includes("rtv")) {
        colColor = BRAND_BLUE; // Blue for Returns
      } else if (lower.includes("balance")) {
        colColor = BRAND_DARK_NAVY; // Deep Navy for Running Balance
      } else {
        colColor = BRAND_SLATE; // Standard Slate
      }
    }

    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colColor } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });

  // --- 7. Data Rows ---
  data.forEach((item, rIdx) => {
    const rowIdx = headerRowIndex + 1 + rIdx;
    const row = worksheet.getRow(rowIdx);
    row.height = 22;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const val = item[col.key];

      if (col.isCurrency && typeof val === "number") {
        cell.value = val;
        cell.numFmt = col.numFmt || CURRENCY_FMT;
        cell.alignment = { horizontal: col.align || "right", vertical: "middle" };
      } else if (typeof val === "number") {
        cell.value = val;
        cell.numFmt = col.numFmt || "#,##0";
        cell.alignment = { horizontal: col.align || "right", vertical: "middle" };
      } else {
        cell.value = val !== undefined && val !== null ? String(val) : "";
        const defaultAlign = (col.key === "date" || col.key === "index" || col.key.toLowerCase().includes("number") || col.key.toLowerCase().includes("id"))
          ? "center"
          : "left";
        cell.alignment = { horizontal: col.align || defaultAlign, vertical: "middle" };
      }

      // Zebra striping for ultra-professional contrast
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_LIGHT } };
      }
      cell.border = thinBorder;
      cell.font = { name: "Arial", size: 9 };

      // Highlight running balance column if negative or positive
      if (col.key === "runningBalance" && typeof val === "number") {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: val > 0 ? "FFDC2626" : "FF047857" } };
      }
    });
  });

  // --- 8. Summary / Totals Row ---
  if (data.length > 0) {
    const totalRowIdx = headerRowIndex + 1 + data.length;
    const totalRow = worksheet.getRow(totalRowIdx);
    totalRow.height = 28;

    // Find the first currency/amount column
    const firstAmountColIdx = columns.findIndex(
      (col) =>
        col.isCurrency ||
        col.key.toLowerCase().includes("amount") ||
        col.key.toLowerCase().includes("credit") ||
        col.key.toLowerCase().includes("paid") ||
        col.key.toLowerCase().includes("return") ||
        col.key.toLowerCase().includes("balance")
    );

    const descColsCount = firstAmountColIdx > 0 ? firstAmountColIdx : 1;

    // Merge description columns on the totals row
    if (descColsCount > 1) {
      worksheet.mergeCells(totalRowIdx, 1, totalRowIdx, descColsCount);
      const labelCell = worksheet.getCell(totalRowIdx, 1);
      labelCell.value = "الإجمالي العام المعتمد (TOTAL AUDITED BALANCE)";
      labelCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: TEXT_DARK } };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    } else {
      const labelCell = worksheet.getCell(totalRowIdx, 1);
      labelCell.value = "الإجمالي (TOTAL)";
      labelCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: TEXT_DARK } };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    }

    // Set borders for the label cells
    for (let c = 1; c <= descColsCount; c++) {
      const cCell = totalRow.getCell(c);
      cCell.border = {
        top: { style: "thin", color: { argb: NAVY_HERO } },
        bottom: { style: "double", color: { argb: NAVY_HERO } },
        left: { style: "thin", color: { argb: GRAY_BORDER } },
        right: { style: "thin", color: { argb: GRAY_BORDER } }
      };
    }

    // Populate remaining columns (from descColsCount onwards)
    columns.forEach((col, cIdx) => {
      const colNum = cIdx + 1;
      if (colNum <= descColsCount) return;

      const cell = totalRow.getCell(colNum);
      cell.border = {
        top: { style: "thin", color: { argb: NAVY_HERO } },
        bottom: { style: "double", color: { argb: NAVY_HERO } },
        left: { style: "thin", color: { argb: GRAY_BORDER } },
        right: { style: "thin", color: { argb: GRAY_BORDER } }
      };
      cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: TEXT_DARK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

      const lower = col.key.toLowerCase();
      if (
        col.isCurrency ||
        lower.includes("amount") ||
        lower.includes("credit") ||
        lower.includes("paid") ||
        lower.includes("return")
      ) {
        if (lower.includes("balance")) {
          // Final net balance from last row
          const lastBal = data.length > 0 ? Number(data[data.length - 1]?.runningBalance || 0) : 0;
          cell.value = lastBal;
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.font = {
            name: "Arial",
            size: 9.5,
            bold: true,
            color: { argb: lastBal > 0 ? "FFDC2626" : "FF047857" }
          };
        } else {
          const colLetter = worksheet.getColumn(colNum).letter;
          const startCell = `${colLetter}${headerRowIndex + 1}`;
          const endCell = `${colLetter}${totalRowIdx - 1}`;
          const colSum = data.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);

          cell.value = {
            formula: `SUM(${startCell}:${endCell})`,
            result: colSum
          };
          cell.numFmt = col.numFmt || CURRENCY_FMT;
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      } else {
        cell.value = "—";
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    });
  }

  // --- 9. Auto-fit Column Widths ---
  columns.forEach((col, cIdx) => {
    const column = worksheet.getColumn(cIdx + 1);
    let maxLength = col.header.length;
    data.forEach(item => {
      const val = item[col.key];
      if (val !== undefined && val !== null) {
        let textVal = String(val);
        if (col.isCurrency) textVal = `${textVal} EGP`;
        if (textVal.length > maxLength) maxLength = textVal.length;
      }
    });
    // Add safety padding so numbers never clip or show '###'
    column.width = col.width ? col.width : Math.min(Math.max(maxLength + 4, 14), 50);
  });

  // --- 10. Write Buffer & Download ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = window.URL.createObjectURL(blob);

  const cleanFileName = (vendorDossier?.companyName || title)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_");

  const a = document.createElement("a");
  a.href = url;
  a.download = `Circle_K_El_Alamein_4_كشف_حساب_${cleanFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
