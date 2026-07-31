import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { jsPDF } from "jspdf";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { fetchService, fetchServicePrices } from "@/lib/api";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/services/$id")({
  head: () => ({
    meta: [{ title: "Service Details — Generative Receipts" }],
  }),
  component: ServiceDetailsPage,
});

function dateTimeLabel(value: string | null, ongoingText: string) {
  if (!value) return ongoingText;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ServiceDetailsPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();

  const { data: service, isPending: servicePending } = useQuery({
    queryKey: ["service", id],
    queryFn: () => fetchService(id),
  });

  const { data: prices, isPending: pricesPending } = useQuery({
    queryKey: ["service-prices", [id]],
    queryFn: () => fetchServicePrices([id]),
  });

  const exportCsv = () => {
    if (!prices || !service) return;
    const header = ["Price (GBP)", "Valid From", "Valid To"].join(",");
    const rows = prices.map((p) => {
      const pence = (p.amount_pence / 100).toFixed(2);
      const from = new Date(p.valid_from).toISOString();
      const to = p.valid_to ? new Date(p.valid_to).toISOString() : "Ongoing";
      return [pence, from, to].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-${service.name.replace(/\s+/g, "-").toLowerCase()}-prices.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!prices || !service) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Price History: ${service.name}`, 14, 20);
    doc.setFontSize(10);
    
    let y = 30;
    prices.forEach((p, index) => {
      const priceStr = formatPence(p.amount_pence);
      const from = dateTimeLabel(p.valid_from, "Ongoing");
      const to = dateTimeLabel(p.valid_to, "Ongoing");
      doc.text(`${index + 1}. ${priceStr} (${from} -> ${to})`, 14, y);
      y += 8;
    });

    doc.save(`service-${service.name.replace(/\s+/g, "-").toLowerCase()}-prices.pdf`);
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <PageHeader
        title={service?.name ?? "..."}
        description={service?.description ?? "Service timeline and pricing history"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!prices}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!prices}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
          <Link to="/services">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Services
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <h3 className="font-display text-xl">Pricing Timeline</h3>
        {pricesPending ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : prices?.length === 0 ? (
          <p className="text-muted-foreground">No price history found.</p>
        ) : (
          <div className="relative border-l border-border ml-3 space-y-8 pb-4">
            {prices?.map((price, idx) => (
              <div key={price.id} className="relative pl-6">
                <span className="absolute -left-1.5 top-2 flex h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <div className="flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xl">{formatPence(price.amount_pence)}</span>
                    {idx === 0 && !price.valid_to ? (
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-gold">
                        Current
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        Past
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Valid from: <strong className="text-foreground">{dateTimeLabel(price.valid_from, "")}</strong>
                  </div>
                  {price.valid_to && (
                    <div className="text-sm text-muted-foreground">
                      Valid to: <strong className="text-foreground">{dateTimeLabel(price.valid_to, "")}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
