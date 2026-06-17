import jsPDF from "jspdf";
import { toJpeg } from "html-to-image";

export interface PDFExportOptions {
  title: string;
  filename?: string;
  watermarkText?: string;
  orientation?: "p" | "l"; // portrait or landscape
}

export const generatePDF = async (elementId: string, options: PDFExportOptions): Promise<Blob> => {
  const {
    title,
    filename = "report.pdf",
    watermarkText = "CIRCLE K CONFIDENTIAL",
    orientation = "p"
  } = options;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  // Capture image using html-to-image (supports modern CSS like lab/oklch colors)
  const imgData = await toJpeg(element, {
    quality: 0.95,
    backgroundColor: "#ffffff",
    pixelRatio: 2
  });
  
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  
  // A4 dimensions in mm
  const a4Width: number = orientation === "p" ? 210 : 297;
  const a4Height: number = orientation === "p" ? 297 : 210;
  
  const imgWidth: number = a4Width;
  const imgHeight: number = width > 0 ? (height * imgWidth) / width : 0;
  
  if (imgHeight === 0 || imgWidth === 0) {
    throw new Error("Captured canvas has zero dimensions");
  }
  
  let heightLeft = imgHeight;
  let position = 0;
  
  const doc = new jsPDF({
    orientation: orientation === "p" ? "portrait" : "landscape",
    unit: "mm",
    format: "a4"
  });

  // Page 1
  doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  
  // Add watermark and page decorations on the first page
  addPageDecorations(doc, 1, watermarkText, a4Width, a4Height);

  heightLeft -= a4Height;
  let pageNum = 1;

  // Multi-page stitching
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    doc.addPage();
    doc.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    
    pageNum++;
    addPageDecorations(doc, pageNum, watermarkText, a4Width, a4Height);
    
    heightLeft -= a4Height;
  }

  // Return Blob for Firebase storage uploads or download directly
  const pdfBlob = doc.output("blob");
  return pdfBlob;
};

// Helper to add watermark, header/footer, and page numbers to each page
function addPageDecorations(doc: jsPDF, pageNum: number, watermarkText: string, width: number, height: number) {
  // Save graphics state
  doc.saveGraphicsState();

  // Watermark
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  
  // Angle rotation for watermark text
  const angle = 45;
  doc.text(watermarkText, width / 2, height / 2, {
    align: "center",
    angle: angle
  });

  // Footer: Page Number & Date
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  
  const footerText = `Circle K Financial Verification System  |  Page ${pageNum}`;
  doc.text(footerText, width / 2, height - 10, { align: "center" });
  
  // Top thin line for header
  doc.setDrawColor(225, 25, 55); // Brand Red
  doc.setLineWidth(0.5);
  doc.line(10, 8, width - 10, 8);
  
  // Restore state
  doc.restoreGraphicsState();
}

export const downloadPDFBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};
