import { jsPDF } from "jspdf";
import { formatDateLong, formatPence } from "./money";
import type { Receipt, ReceiptItem } from "./api";

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const GOLD: [number, number, number] = [176, 141, 74];
const INK: [number, number, number] = [26, 25, 23];
const MUTED: [number, number, number] = [120, 116, 108];

async function loadImageDataUrl(url: string): Promise<{ data: string; ratio: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width && img.height ? img.width / img.height : 1);
      img.onerror = () => resolve(1);
      img.src = dataUrl;
    });
    return { data: dataUrl, ratio };
  } catch {
    return null;
  }
}

export async function buildReceiptPdf(args: {
  receipt: Receipt;
  items: ReceiptItem[];
  logoUrl?: string | null;
}): Promise<Blob> {
  const { receipt, items } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const logo = args.logoUrl ? await loadImageDataUrl(args.logoUrl) : null;
  if (logo) {
    // Top logo
    const h = 16;
    const w = Math.min(48, h * logo.ratio);
    try {
      doc.addImage(logo.data, MARGIN, y, w, h, undefined, "FAST");
    } catch {
      /* ignore unsupported image */
    }
    
    // Watermark in the center of the page
    try {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
      const wmWidth = Math.min(PAGE_WIDTH - 80, 120);
      const wmHeight = wmWidth / logo.ratio;
      doc.addImage(
        logo.data,
        (PAGE_WIDTH - wmWidth) / 2,
        (PAGE_HEIGHT - wmHeight) / 2 - 20,
        wmWidth,
        wmHeight,
        undefined,
        "FAST"
      );
      doc.restoreGraphicsState();
    } catch {
      /* ignore if GState fails */
    }

    y += h + 6;
  }

  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(receipt.business_name_snapshot || "Receipt", MARGIN, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("RECEIPT", PAGE_WIDTH - MARGIN, y - 4, { align: "right" });
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.receipt_number, PAGE_WIDTH - MARGIN, y + 2, { align: "right" });

  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("ISSUED TO", MARGIN, y);
  doc.text("ISSUE DATE", PAGE_WIDTH / 2 + 10, y);
  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(receipt.customer_name || "—", MARGIN, y);
  doc.text(formatDateLong(receipt.issue_date), PAGE_WIDTH / 2 + 10, y);
  if (receipt.customer_email) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(receipt.customer_email, MARGIN, y);
  }
  if (receipt.service_name_snapshot) {
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Service: ${receipt.service_name_snapshot}`, MARGIN, y);
  }

  y += 12;
  doc.setFillColor(245, 242, 235);
  doc.rect(MARGIN, y - 5, PAGE_WIDTH - MARGIN * 2, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("DESCRIPTION", MARGIN, y);
  doc.text("QTY", PAGE_WIDTH - MARGIN - 50, y, { align: "right" });
  doc.text("UNIT", PAGE_WIDTH - MARGIN - 25, y, { align: "right" });
  doc.text("AMOUNT", PAGE_WIDTH - MARGIN - 3, y, { align: "right" });
  y += 9;

  doc.setTextColor(...INK);
  for (const item of items) {
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const nameLines = doc.splitTextToSize(item.name, 110) as string[];
    doc.text(nameLines, MARGIN, y);
    let blockHeight = nameLines.length * 4.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(item.quantity), PAGE_WIDTH - MARGIN - 50, y, { align: "right" });
    doc.text(formatPence(item.unit_price_pence), PAGE_WIDTH - MARGIN - 25, y, { align: "right" });
    doc.text(formatPence(item.line_total_pence), PAGE_WIDTH - MARGIN - 3, y, { align: "right" });
    if (item.description) {
      doc.setTextColor(...MUTED);
      const descLines = doc.splitTextToSize(item.description, 110) as string[];
      doc.text(descLines, MARGIN + 3, y + blockHeight + 0.5);
      blockHeight += descLines.length * 4.2 + 1;
      doc.setTextColor(...INK);
    }
    y += blockHeight + 5;
    doc.setDrawColor(232, 228, 220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 2.5, PAGE_WIDTH - MARGIN, y - 2.5);
  }

  y += 4;
  const labelX = PAGE_WIDTH - MARGIN - 45;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", labelX, y, { align: "right" });
  doc.setTextColor(...INK);
  doc.text(formatPence(receipt.subtotal_pence), PAGE_WIDTH - MARGIN - 3, y, { align: "right" });
  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(labelX - 22, y - 4.5, PAGE_WIDTH - MARGIN, y - 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total (GBP)", labelX, y + 1, { align: "right" });
  doc.text(formatPence(receipt.total_pence), PAGE_WIDTH - MARGIN - 3, y + 1, { align: "right" });

  if (receipt.notes) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("NOTES", MARGIN, y);
    y += 5;
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const noteLines = doc.splitTextToSize(receipt.notes, PAGE_WIDTH - MARGIN * 2) as string[];
    doc.text(noteLines, MARGIN, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${receipt.business_name_snapshot || ""} · ${receipt.receipt_number} · All amounts in GBP`.trim(),
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 12,
    { align: "center" },
  );

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
