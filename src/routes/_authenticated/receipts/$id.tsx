import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Loader2, Mail, Share2, MessageCircle } from "lucide-react";
import { LOGO_BUCKET, fetchReceipt, signedUrl, storeReceiptPdf } from "@/lib/api";
import { formatDateLong, formatPence } from "@/lib/money";
import { buildReceiptPdf, downloadBlob } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    download: search.download === true || search.download === "true",
  }),
  head: () => ({
    meta: [
      { title: "Receipt — Generative Receipts" },
      { name: "description", content: "View, download and share a generated GBP receipt." },
      { property: "og:title", content: "Receipt — Generative Receipts" },
      { property: "og:description", content: "Printable A4 receipt preview." },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { download } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [autoRan, setAutoRan] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetchReceipt(id),
  });

  const receipt = data?.receipt ?? null;
  const items = data?.items ?? [];

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-url", receipt?.logo_path_snapshot],
    queryFn: () => signedUrl(LOGO_BUCKET, receipt?.logo_path_snapshot ?? null, 600),
    enabled: Boolean(receipt?.logo_path_snapshot),
  });

  async function handleDownload() {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      const blob = await buildReceiptPdf({ receipt, items, logoUrl });
      downloadBlob(blob, `${receipt.receipt_number}.pdf`);
      try {
        await storeReceiptPdf(receipt.id, receipt.receipt_number, blob);
      } catch {
        /* storage copy is best-effort */
      }
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error("Could not generate PDF", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (download && receipt && !autoRan) {
      setAutoRan(true);
      void handleDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [download, receipt, autoRan]);

  const shareText = receipt
    ? `Receipt ${receipt.receipt_number} from ${receipt.business_name_snapshot} — ${formatPence(
        receipt.total_pence,
      )} issued ${formatDateLong(receipt.issue_date)}.`
    : "";

  async function handleShare() {
    if (!receipt) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${receipt.receipt_number}`, text: shareText });
        return;
      } catch {
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
  }

  if (isPending) {
    return <Skeleton className="h-[60vh] w-full rounded-xl" />;
  }

  if (isError || !receipt) {
    return (
      <div role="alert" className="surface-card rounded-xl p-10 text-center">
        <h1 className="font-display text-2xl">{t("receipt.receiptNotAvailable")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error | null)?.message ?? t("receipt.receiptNotYours")}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">{t("receipt.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            {t("receipt.backToDashboard")}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="premium" onClick={handleDownload} disabled={busy}>
            {busy ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin ms-0 me-2" />
            ) : (
              <Download aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
            )}
            {t("receipt.downloadPdf")}
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
            {t("receipt.share")}
          </Button>
          <Button asChild variant="outline">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
              {t("receipt.whatsapp")}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={`mailto:${encodeURIComponent(receipt.customer_email ?? "")}?subject=${encodeURIComponent(
                `Receipt ${receipt.receipt_number}`,
              )}&body=${encodeURIComponent(shareText)}`}
            >
              <Mail aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
              {t("receipt.email")}
            </a>
          </Button>
        </div>
      </div>

      <article className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gold/40 pb-6">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${receipt.business_name_snapshot} logo`}
                className="h-14 w-14 object-contain"
              />
            ) : null}
            <div>
              <h1 className="font-display text-3xl">{receipt.business_name_snapshot}</h1>
              <p className="text-eyebrow mt-1">{t("receipt.receipt")}</p>
            </div>
          </div>
          <dl className="text-right text-sm">
            <dt className="text-muted-foreground">{t("receipt.receiptNumber")}</dt>
            <dd className="font-display text-lg">{receipt.receipt_number}</dd>
            <dt className="mt-2 text-muted-foreground">{t("receipt.issueDate")}</dt>
            <dd>{formatDateLong(receipt.issue_date)}</dd>
          </dl>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-eyebrow">{t("receipt.billedTo")}</p>
            <p className="mt-1 font-medium">{receipt.customer_name || "—"}</p>
            {receipt.customer_email ? (
              <p className="text-sm text-muted-foreground">{receipt.customer_email}</p>
            ) : null}
          </div>
          <div className="sm:text-end">
            <p className="text-eyebrow">{t("receipt.service")}</p>
            <p className="mt-1 font-medium">{receipt.service_name_snapshot || t("receipt.custom")}</p>
            {receipt.pa_order_id ? (
              <p className="text-sm text-muted-foreground mt-1">{t("receipt.paOrder")}: {receipt.pa_order_id}</p>
            ) : null}
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <caption className="sr-only">Receipt line items</caption>
          <thead>
            <tr className="border-b border-border text-start">
              <th scope="col" className="pb-2 font-medium">
                {t("receipt.description")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("receipt.qty")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("receipt.unit")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("receipt.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60 align-top">
                <td className="py-3">
                  <span className="font-medium">{item.name}</span>
                  {item.description ? (
                    <span className="block text-muted-foreground">{item.description}</span>
                  ) : null}
                </td>
                <td className="py-3 text-end">{item.quantity}</td>
                <td className="py-3 text-end">{formatPence(item.unit_price_pence)}</td>
                <td className="py-3 text-end">{formatPence(item.line_total_pence)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("receipt.subtotal")}</dt>
              <dd>{formatPence(receipt.subtotal_pence)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-gold/40 pt-2">
              <dt className="font-medium">{t("receipt.totalGbp")}</dt>
              <dd className="font-display text-2xl">{formatPence(receipt.total_pence)}</dd>
            </div>
          </dl>
        </div>

        {receipt.notes ? (
          <section className="mt-8 border-t border-border pt-4">
            <p className="text-eyebrow">{t("receipt.notes")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{receipt.notes}</p>
          </section>
        ) : null}
      </article>
    </>
  );
}
