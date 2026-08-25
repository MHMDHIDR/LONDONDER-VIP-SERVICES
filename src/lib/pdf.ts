import { jsPDF } from "jspdf";
import { formatDateLong, formatPence } from "./money";
import { fetchBusinessSettings } from "./api";
import type { Receipt, ReceiptItem } from "./api";
import type { Payout, PayoutItem } from "./payouts-api";

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

type InvoiceArgs = {
  type: "invoice";
  receipt: Receipt;
  items: ReceiptItem[];
  logoUrl?: string | null;
};

type PayoutArgs = {
  type: "payout";
  payout: Payout & { worker?: { name: string } | null };
  items: PayoutItem[];
  logoUrl?: string | null;
};

export async function buildDocumentPdf(args: InvoiceArgs | PayoutArgs): Promise<Blob> {
  const settings = await fetchBusinessSettings();
  const { type, items } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;
  const docData = type === "invoice" ? args.receipt : args.payout;
  const businessName = settings?.business_name || docData.business_name_snapshot || "Londoner VIP Services";

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

  const isInvoice = type === "invoice";

  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text(businessName || (isInvoice ? "Invoice" : "Payout"), MARGIN, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(isInvoice ? "INVOICE" : "PAYOUT", PAGE_WIDTH - MARGIN, y - 4, { align: "right" });
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  const topNumber = isInvoice ? args.receipt.receipt_number : args.payout.payout_number;
  doc.text(topNumber, PAGE_WIDTH - MARGIN, y + 2, { align: "right" });

  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(isInvoice ? "BILLED TO" : "WORKER", MARGIN, y);
  doc.text("ISSUE DATE", PAGE_WIDTH / 2 + 10, y);
  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const recipientName = isInvoice ? args.receipt.customer_name : (args.payout.worker?.name || "—");
  const recipientSubtitle = isInvoice ? args.receipt.customer_email : (args.payout.worker_nin_snapshot ? `NIN: ${args.payout.worker_nin_snapshot}` : "");

  doc.text(recipientName || "—", MARGIN, y);
  doc.text(formatDateLong(docData.issue_date), PAGE_WIDTH / 2 + 10, y);
  if (recipientSubtitle) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(recipientSubtitle, MARGIN, y);
  }
  if (docData.service_name_snapshot) {
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Service: ${docData.service_name_snapshot}`, MARGIN, y);
  }
  if (docData.pa_order_id) {
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(`PA Order: ${docData.pa_order_id}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
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
    if (y > PAGE_HEIGHT - 75) {
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
  doc.text(formatPence(docData.subtotal_pence), PAGE_WIDTH - MARGIN - 3, y, { align: "right" });
  y += 8;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(labelX - 22, y - 4.5, PAGE_WIDTH - MARGIN, y - 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total (GBP)", labelX, y + 1, { align: "right" });
  doc.text(formatPence(docData.total_pence), PAGE_WIDTH - MARGIN - 3, y + 1, { align: "right" });

  if (docData.notes) {
    const noteLines = doc.splitTextToSize(docData.notes, PAGE_WIDTH - MARGIN * 2) as string[];
    if (y + 21 + noteLines.length * 4.5 > PAGE_HEIGHT - 65) {
      doc.addPage();
      y = MARGIN;
    }
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("NOTES", MARGIN, y);
    y += 5;
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(noteLines, MARGIN, y);
    y += noteLines.length * 4.5;
  }

  if (isInvoice) {
    if (y > PAGE_HEIGHT - 65) {
      doc.addPage();
    }
    let by = PAGE_HEIGHT - 55;

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.setTextColor(130, 125, 115);
    doc.text("PAYMENT DETAILS", MARGIN, by);
    by += 4.5;

    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    
    const drawKV = (k: string, v: string, x: number, yPos: number) => {
      doc.setTextColor(130, 125, 115);
      doc.text(k, x, yPos);
      doc.setTextColor(70, 70, 70);
      doc.text(v, x + doc.getTextWidth(k) + 1.5, yPos);
    };

    drawKV("Recipient:", "LONDONER VIP SERVICES LTD", MARGIN, by);
    by += 3.5;
    drawKV("Recipient address:", "61 Bridge Street, HR5 3DJ, Kington, United Kingdom", MARGIN, by);
    by += 5.5;

    doc.setFont("times", "italic");
    doc.setTextColor(130, 125, 115);
    doc.text("Transfer from a UK bank?", MARGIN, by);
    doc.setFont("times", "normal");
    by += 3.5;

    drawKV("Account number:", "90627533", MARGIN, by);
    drawKV("Sort code:", "23-01-63", MARGIN + 40, by);
    by += 5.5;

    doc.setFont("times", "italic");
    doc.setTextColor(130, 125, 115);
    doc.text("Transfer from outside the UK?", MARGIN, by);
    doc.setFont("times", "normal");
    by += 3.5;

    drawKV("IBAN:", "GB96 REVO 2301 6390 6275 33", MARGIN, by);
    by += 3.5;
    drawKV("BIC:", "REVOGB21", MARGIN, by);
    drawKV("Intermediary BIC:", "CHASGB2L", MARGIN + 35, by);
  }

  const documentNumber = isInvoice ? args.receipt.receipt_number : args.payout.payout_number;

  if (!isInvoice) {
     
    const disclaimer = `As an independent contractor, you are solely responsible for declaring and paying your own tax and National Insurance contributions. ${businessName} accepts no liability for your tax affairs.`;
    
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150); // Light color
    const wrappedDisclaimer = doc.splitTextToSize(disclaimer, PAGE_WIDTH - MARGIN * 2);
    doc.text(
      wrappedDisclaimer,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 22,
      { align: "center" }
    );
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${businessName || ""} · ${documentNumber || ""} · All amounts in GBP`.trim(),
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 12,
    { align: "center" },
  );

  return doc.output("blob");
}

export async function buildInvoicePdf(args: Omit<InvoiceArgs, "type">) {
  return buildDocumentPdf({ ...args, type: "invoice" });
}

export async function buildPayoutPdf(args: Omit<PayoutArgs, "type">) {
  return buildDocumentPdf({ ...args, type: "payout" });
}

export const buildReceiptPdf = buildInvoicePdf;

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
