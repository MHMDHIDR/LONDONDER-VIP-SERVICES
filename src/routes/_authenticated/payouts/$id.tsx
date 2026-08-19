import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Loader2, Mail, Share2, MessageCircle, Trash2, Pencil } from "lucide-react";
import { fetchPayout, signedUrl, storePayoutPdf, softDeletePayout, LOGO_BUCKET } from "@/lib/api";
import { fetchPayout, updatePayout, softDeletePayout, storePayoutPdf } from "@/lib/payouts-api";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateLong, formatPence } from "@/lib/money";
import { buildPayoutPdf, downloadBlob } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/payouts/$id")({
  validateSearch: (search: Record<string, unknown>): { download?: boolean } => ({
    download: search.download === true || search.download === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payout, Generative Payouts" },
      { name: "description", content: "View, download and share a generated GBP payout." },
      { property: "og:title", content: "Payout, Generative Payouts" },
      { property: "og:description", content: "Printable A4 payout preview." },
    ],
  }),
  component: PayoutPage,
});

function PayoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { download } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoRan, setAutoRan] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["payout", id],
    queryFn: () => fetchPayout(id),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      return data;
    }
  });

  const payout = data?.payout ?? null;
  const items = data?.items ?? [];

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-url", payout?.logo_path_snapshot],
    queryFn: () => signedUrl(LOGO_BUCKET, payout?.logo_path_snapshot ?? null, 600),
    enabled: Boolean(payout?.logo_path_snapshot),
  });

  async function handleDownload() {
    if (!payout || busy) return;
    setBusy(true);
    try {
      const blob = await buildPayoutPdf({ payout, items, logoUrl });
      downloadBlob(blob, `${payout.payout_number}.pdf`);
      try {
        await storePayoutPdf(payout.id, payout.payout_number, blob);
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
    if (download && payout && !autoRan) {
      setAutoRan(true);
      void handleDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [download, payout, autoRan]);

  const shareText = payout
    ? `Payout ${payout.payout_number} from ${payout.business_name_snapshot}, ${formatPence(
        payout.total_pence,
      )} issued ${formatDateLong(payout.issue_date)}.`
    : "";

  async function handleShare(target: "native" | "whatsapp" = "native") {
    if (!payout || busy) return;
    setBusy(true);

    let finalShareText = shareText;

    try {
      const blob = await buildPayoutPdf({ payout, items, logoUrl });
      const file = new File([blob], `${payout.payout_number}.pdf`, { type: "application/pdf" });

      if (target === "native" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Payout ${payout.payout_number}`,
          text: finalShareText,
        });
        setBusy(false);
        return;
      }

      // Fallback: Generate signed URL and append to text
      let pdfPath = payout.pdf_path;
      if (!pdfPath) {
        pdfPath = await storePayoutPdf(payout.id, payout.payout_number, blob);
      }
      if (pdfPath) {
        const sUrl = await signedUrl("payout-pdfs", pdfPath, 86400); // 24 hours
        if (sUrl) finalShareText += `\n\n📄 View PDF: ${sUrl}`;
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setBusy(false);
    }

    if (target === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(finalShareText)}`,
        "_blank",
        "noopener",
      );
    } else {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Payout ${payout.payout_number}`,
            text: finalShareText,
          });
        } catch {
          // ignored
        }
      } else {
        toast.success("Link copied to clipboard (native share not supported)");
        navigator.clipboard.writeText(finalShareText);
      }
    }
  }

  async function handleDelete() {
    if (!payout || isDeleting) return;
    setIsDeleting(true);
    try {
      await softDeletePayout(payout.id, payout.pdf_path);
      toast.success(t("payout.deleted"));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete payout");
      setIsDeleting(false);
    }
  }

  if (isPending) {
    return <Skeleton className="h-[60vh] w-full rounded-xl" />;
  }

  if (isError || !payout) {
    return (
      <div role="alert" className="surface-card rounded-xl p-10 text-center">
        <h1 className="font-display text-2xl">{t("payout.payoutNotAvailable")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error | null)?.message ?? t("payout.payoutNotYours")}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">{t("payout.backToDashboard")}</Link>
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
            {t("payout.backToDashboard")}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="premium" onClick={handleDownload} disabled={busy}>
            {busy ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin ms-0 me-2" />
            ) : (
              <Download aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
            )}
            {t("payout.downloadPdf")}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-full px-6 text-[15px]"
            onClick={() => handleShare("native")}
            disabled={busy}
          >
            <Share2 aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
            {t("payout.share")}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-full px-6 text-[15px]"
            onClick={() => handleShare("whatsapp")}
            disabled={busy}
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
            WhatsApp
          </Button>
          <Button asChild variant="outline">
            <a
              href={`mailto:${encodeURIComponent(payout.customer_email ?? "")}?subject=${encodeURIComponent(
                `Payout ${payout.payout_number}`,
              )}&body=${encodeURIComponent(shareText)}`}
            >
              <Mail aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
              {t("payout.email")}
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2 rounded-full px-6 text-[15px]">
            <Link to="/payouts/$id/edit" params={{ id }}>
              <Pencil aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
              Edit
            </Link>
          </Button>
          {profile?.is_admin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2 rounded-full px-6 text-[15px]" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin ms-0 me-2" /> : <Trash2 className="h-4 w-4 ms-0 me-2" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete payout {payout.payout_number}. It will be removed from your dashboard and the PDF document will be permanently deleted from storage.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {(payout.updated_at || payout.created_at) && (
        <div className="mb-6 text-sm text-muted-foreground print:hidden">
          {payout.updated_at && payout.created_at && payout.updated_at !== payout.created_at ? (
            <>
              Last updated at {formatDateLong(payout.updated_at)} by{" "}
              {(payout as any).updater?.full_name ? (
                <Link to="/managers/$id" params={{ id: payout.updated_by || "" }} className="hover:underline text-foreground">
                  {(payout as any).updater.full_name}
                </Link>
              ) : (payout as any).creator?.full_name ? (
                <Link to="/managers/$id" params={{ id: payout.updated_by || payout.user_id || "" }} className="hover:underline text-foreground">
                  {(payout as any).creator.full_name}
                </Link>
              ) : (
                "Unknown"
              )}
            </>
          ) : (
            <>
              Created at {formatDateLong(payout.created_at || payout.updated_at)} by{" "}
              {(payout as any).creator?.full_name ? (
                <Link to="/managers/$id" params={{ id: payout.user_id || "" }} className="hover:underline text-foreground">
                  {(payout as any).creator.full_name}
                </Link>
              ) : (
                "Unknown"
              )}
            </>
          )}
        </div>
      )}

      <article className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-8 shadow-(--shadow-soft) sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gold/40 pb-6">
          <div className="flex flex-col items-start gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${payout.business_name_snapshot} logo`}
                className="h-20 w-auto object-contain"
              />
            ) : null}
            <div>
              <h1 className="font-display text-3xl">{payout.business_name_snapshot}</h1>
              <p className="text-eyebrow mt-1">{t("payout.payout")}</p>
            </div>
          </div>
          <dl className="text-right text-sm">
            <dt className="text-muted-foreground">{t("payout.payoutNumber")}</dt>
            <dd className="font-display text-lg">{payout.payout_number}</dd>
            <dt className="mt-2 text-muted-foreground">{t("payout.issueDate")}</dt>
            <dd>{formatDateLong(payout.issue_date)}</dd>
          </dl>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-eyebrow">{t("payout.billedTo")}</p>
            <p className="mt-1 font-medium">{payout.customer_name || "—"}</p>
            {payout.customer_email ? (
              <p className="text-sm text-muted-foreground">{payout.customer_email}</p>
            ) : null}
          </div>
          <div className="sm:text-end">
            <p className="text-eyebrow">{t("payout.service")}</p>
            <p className="mt-1 font-medium">
              {payout.service_name_snapshot || t("payout.custom")}
            </p>
            {payout.pa_order_id ? (
              <p className="inline-block mt-2 rounded-md bg-muted px-2 py-1 text-sm font-bold text-foreground">
                {t("payout.paOrder")}: {payout.pa_order_id}
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-8 overflow-x-auto w-full">
          <table className="w-full text-sm min-w-[600px] text-left">
            <caption className="sr-only">Payout line items</caption>
          <thead>
            <tr className="border-b border-border text-start">
              <th scope="col" className="pb-2 font-medium">
                {t("payout.description")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("payout.qty")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("payout.unit")}
              </th>
              <th scope="col" className="pb-2 text-end font-medium">
                {t("payout.total")}
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
                <td className="py-4 px-4 text-right align-top whitespace-nowrap min-w-[80px]">
                  {item.quantity}
                </td>
                <td className="py-4 px-4 text-right align-top whitespace-nowrap min-w-[100px]">
                  {formatPence(item.unit_price_pence)}
                </td>
                <td className="py-4 ps-4 text-right align-top whitespace-nowrap min-w-[100px]">
                  {formatPence(item.line_total_pence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("payout.subtotal")}</dt>
              <dd>{formatPence(payout.subtotal_pence)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-gold/40 pt-2">
              <dt className="font-medium">{t("payout.totalGbp")}</dt>
              <dd className="font-display text-2xl">{formatPence(payout.total_pence)}</dd>
            </div>
          </dl>
        </div>

        {payout.notes ? (
          <section className="mt-8 border-t border-border pt-4">
            <p className="text-eyebrow">{t("payout.notes")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {payout.notes}
            </p>
          </section>
        ) : null}
      </article>
    </>
  );
}
