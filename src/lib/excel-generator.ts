import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  isCurrency?: boolean;
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
}

export const exportToExcel = async (options: ExcelExportOptions) => {
  const {
    title,
    subtitle = "Generated Report",
    columns,
    data,
    filters = {},
    sheetName = "Report",
    creator = "Circle K Finance Engine",
    branchName = "Circle K #4702 - Downtown"
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator;
  workbook.lastModifiedBy = creator;
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { paperSize: 9, orientation: "portrait" } // 9 = A4
  });

  // Corporate Styling Palette (Circle K Brand: Red #E11937, Orange #FF8200, Gray #F3F4F6)
  const BRAND_RED = "FFE11937";
  const BRAND_ORANGE = "FFFF8200";
  const TEXT_WHITE = "FFFFFFFF";
  const GRAY_LIGHT = "FFF3F4F6";
  const GRAY_BORDER = "FFD1D5DB";

  // --- Title Block ---
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "CIRCLE K FRANCHISE SYSTEM";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: TEXT_WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 35;

  // --- Subtitle Block ---
  worksheet.mergeCells("A2:G2");
  const subtitleCell = worksheet.getCell("A2");
  subtitleCell.value = `${title.toUpperCase()} - ${subtitle}`;
  subtitleCell.font = { name: "Arial", size: 11, bold: true, color: { argb: BRAND_RED } };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 20;

  // --- Info Block (Metadata) ---
  worksheet.getCell("A4").value = "Branch:";
  worksheet.getCell("A4").font = { bold: true };
  worksheet.getCell("B4").value = branchName;

  worksheet.getCell("A5").value = "Date Generated:";
  worksheet.getCell("A5").font = { bold: true };
  worksheet.getCell("B5").value = new Date().toLocaleString();

  // Draw active filters
  let filterStr = "";
  Object.entries(filters).forEach(([key, val]) => {
    if (val) filterStr += `${key}: ${val} | `;
  });
  if (filterStr) {
    worksheet.getCell("D4").value = "Filters Applied:";
    worksheet.getCell("D4").font = { bold: true };
    worksheet.getCell("E4").value = filterStr.slice(0, -3);
  }

  // Border formatting helper
  const thinBorder: any = {
    top: { style: "thin", color: { argb: GRAY_BORDER } },
    left: { style: "thin", color: { argb: GRAY_BORDER } },
    bottom: { style: "thin", color: { argb: GRAY_BORDER } },
    right: { style: "thin", color: { argb: GRAY_BORDER } }
  };

  // --- Headers ---
  const headerRowIndex = 7;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 28;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: TEXT_WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ORANGE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });

  // --- Data Rows ---
  data.forEach((item, rIdx) => {
    const rowIdx = headerRowIndex + 1 + rIdx;
    const row = worksheet.getRow(rowIdx);
    row.height = 20;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const val = item[col.key];

      // Format currency or numbers
      if (col.isCurrency && typeof val === "number") {
        cell.value = val;
        cell.numFmt = col.numFmt || "EGP #,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (typeof val === "number") {
        cell.value = val;
        cell.numFmt = col.numFmt || "#,##0";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.value = val !== undefined && val !== null ? String(val) : "";
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }

      // Alternating row background for premium look
      if (rIdx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_LIGHT } };
      }
      cell.border = thinBorder;
      cell.font = { name: "Arial", size: 9 };
    });
  });

  // --- Summary / Totals Row ---
  const totalRowIdx = headerRowIndex + 1 + data.length;
  const totalRow = worksheet.getRow(totalRowIdx);
  totalRow.height = 24;

  let hasTotal = false;
  columns.forEach((col, cIdx) => {
    const cell = totalRow.getCell(cIdx + 1);
    cell.border = {
      top: { style: "thin", color: { argb: BRAND_ORANGE } },
      bottom: { style: "double", color: { argb: BRAND_ORANGE } }
    };
    cell.font = { name: "Arial", size: 10, bold: true };

    if (cIdx === 0) {
      cell.value = "TOTALS";
      cell.alignment = { horizontal: "left", vertical: "middle" };
      hasTotal = true;
    } else if (col.isCurrency || col.key.toLowerCase().includes("total") || col.key.toLowerCase().includes("amount") || col.key.toLowerCase().includes("gallons")) {
      const colLetter = worksheet.getColumn(cIdx + 1).letter;
      const startCell = `${colLetter}${headerRowIndex + 1}`;
      const endCell = `${colLetter}${totalRowIdx - 1}`;
      
      // Auto-insert formula for sums
      cell.value = { formula: `SUM(${startCell}:${endCell})` };
      cell.numFmt = col.isCurrency ? (col.numFmt || "EGP #,##0.00") : "#,##0.00";
      cell.alignment = { horizontal: "right", vertical: "middle" };
      hasTotal = true;
    }
  });

  // Auto-fit column widths
  columns.forEach((col, cIdx) => {
    const column = worksheet.getColumn(cIdx + 1);
    let maxLength = col.header.length;
    data.forEach(item => {
      const val = item[col.key];
      if (val) {
        let textVal = String(val);
        if (col.isCurrency) textVal = `EGP ${textVal}`;
        if (textVal.length > maxLength) maxLength = textVal.length;
      }
    });
    column.width = col.width ? col.width : Math.max(maxLength + 3, 12);
  });

  // Write file out and download it
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
