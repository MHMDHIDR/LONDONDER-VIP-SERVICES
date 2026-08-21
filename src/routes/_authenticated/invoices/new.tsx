import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Paperclip, Receipt as ReceiptIcon } from "lucide-react";
import {
  ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  attachEvidence,
  createReceipt,
  fetchServices,
  resolvePriceAt,
  type Service,
} from "@/lib/api";
import {
  formatDateLong,
  formatPence,
  lineTotalPence,
  parsePoundsToPence,
  penceToInput,
  sumPence,
  todayLocalISO,
} from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { DocumentSummary } from "@/components/DocumentSummary";
import { CreateServiceDialog } from "@/components/CreateServiceDialog";
import { NotesEvidenceSection } from "@/components/NotesEvidenceSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { SearchableServiceSelect } from "@/components/SearchableServiceSelect";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  head: () => ({
    meta: [
      { title: "New receipt, Generative Receipts" },
      {
        name: "description",
        content: "Generate a GBP receipt with historically accurate service pricing.",
      },
      { property: "og:title", content: "New receipt, Generative Receipts" },
      { property: "og:description", content: "Create a premium receipt in seconds." },
    ],
  }),
  component: NewReceiptPage,
});

import { LineItemsSection, type LineItem as DraftItem, emptyItem, itemPence } from "@/components/LineItemsSection";

function NewReceiptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [issueDate, setIssueDate] = useState(todayLocalISO());
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paOrderId, setPaOrderId] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  const { data: services, isPending: servicesLoading } = useQuery({
    queryKey: ["active-services"],
    queryFn: () => fetchServices(false),
  });

  const selectedService = (services ?? []).find((s) => s.id === serviceId) ?? null;
  const subtotal = sumPence(items.map(itemPence));



  async function applyService(service: Service) {
    setServiceId(service.id);
    setPriceLoading(true);
    try {
      const atISO =
        issueDate === todayLocalISO()
          ? new Date().toISOString()
          : new Date(`${issueDate}T23:59:59`).toISOString();
      const pence = await resolvePriceAt(service.id, atISO);
      if (pence === null) {
        toast.warning("No price found for that date", {
          description: "Enter the unit price manually for this receipt.",
        });
      }
      setItems((prev) => {
        const rest = prev.filter((item) => item.name.trim() || item.unitPrice.trim());
        const prefilled: DraftItem = {
          key: crypto.randomUUID(),
          name: service.name,
          description: service.description ?? "",
          quantity: "1",
          unitPrice: pence !== null ? penceToInput(pence) : "",
        };
        return [prefilled, ...rest.filter((item) => item.name !== service.name)];
      });
    } catch (error) {
      toast.error("Could not resolve price", { description: (error as Error).message });
    } finally {
      setPriceLoading(false);
    }
  }

  function handleFile(next: File | undefined) {
    setFileError(null);
    if (!next) return;
    if (!ATTACHMENT_MIME.includes(next.type)) {
      setFileError("Evidence must be a PNG, JPEG, WebP image or a PDF.");
      return;
    }
    if (next.size > MAX_ATTACHMENT_BYTES) {
      setFileError("Evidence must be 10 MB or smaller.");
      return;
    }
    setFile(next);
  }

  const generate = useMutation({
    mutationFn: async () => {
      const payload = items
        .map((item) => ({
          name: item.name.trim().slice(0, 200),
          description: item.description.trim().slice(0, 1000) || null,
          quantity: Number.parseFloat(item.quantity),
          unit_price_pence: parsePoundsToPence(item.unitPrice) ?? 0,
        }))
        .filter((item) => item.name.length > 0);

      const id = await createReceipt({
        issueDate,
        customerName: customerName.trim() || null,
        customerEmail: customerEmail.trim() || null,
        notes: notes.trim() || null,
        paOrderId: paOrderId.trim() || null,
        serviceId,
        items: payload,
      });

      if (file) {
        try {
          await attachEvidence(id, file);
        } catch (error) {
          toast.warning("Receipt saved, but evidence upload failed", {
            description: (error as Error).message,
          });
        }
      }
      return id;
    },
    onSuccess: (id) => {
      toast.success("Receipt generated");
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      navigate({ to: "/invoices/$id", params: { id } });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (generate.isPending) return;

    if (!issueDate) return setFormError("Choose a receipt date.");
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      return setFormError("Enter a valid customer email or leave it blank.");
    }
    const valid = items.filter((item) => item.name.trim());
    if (valid.length === 0) return setFormError("Add at least one line item with a name.");
    for (const item of valid) {
      const quantity = Number.parseFloat(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return setFormError(`Quantity for “${item.name}” must be greater than zero.`);
      }
      if (parsePoundsToPence(item.unitPrice) === null) {
        return setFormError(`Enter a valid unit price for “${item.name}”.`);
      }
    }
    generate.mutate();
  }

  return (
    <>
      <PageHeader
        eyebrow={t("receipt.newDocument")}
        title={t("receipt.generateReceipt")}
        description={t("receipt.newReceiptDesc")}
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">{t("receipt.details")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-date">{t("receipt.receiptDate")}</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service">{t("receipt.service")}</Label>
                <div className="flex gap-2">
                  <SearchableServiceSelect
                    value={serviceId}
                    onChange={(service) => void applyService(service)}
                    services={services ?? []}
                    isLoading={servicesLoading}
                    t={t}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Add new service"
                    onClick={() => setServiceDialog(true)}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
                {priceLoading ? (
                  <p className="text-xs text-muted-foreground">Resolving historical price…</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">{t("receipt.customerNameOpt")}</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  maxLength={160}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">{t("receipt.customerEmailOpt")}</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  maxLength={254}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-order-id">{t("receipt.paOrderIdOpt")}</Label>
                <Input
                  id="pa-order-id"
                  value={paOrderId}
                  maxLength={160}
                  onChange={(e) => setPaOrderId(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (
                      !/[\d\b]/.test(e.key) &&
                      e.key !== "Backspace" &&
                      e.key !== "ArrowLeft" &&
                      e.key !== "ArrowRight" &&
                      e.key !== "Tab" &&
                      e.key !== "Delete"
                    ) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t("receipt.paOrderPlaceholder")}
                  required
                />
              </div>
            </div>
          </section>

          <LineItemsSection items={items} setItems={setItems} t={t} currency="GBP" services={services ?? []} />

          <NotesEvidenceSection
            notes={notes}
            setNotes={setNotes}
            file={file}
            setFile={setFile}
            fileError={fileError}
            handleFile={handleFile}
            t={t}
          />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <DocumentSummary
            date={issueDate}
            recipientLabel={t("receipt.client")}
            recipientName={customerName}
            serviceName={
              selectedService ? (
                <Link to="/services/$id" params={{ id: selectedService.id }} className="hover:underline">
                  {selectedService.name}
                </Link>
              ) : null
            }
            subtotal={subtotal}
            isPending={generate.isPending}
            submitLabel={generate.isPending ? t("receipt.generating") : t("receipt.generateReceipt")}
            warningText={t("receipt.lockedWarning")}
            t={t}
          >
            {formError ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </DocumentSummary>
        </aside>
      </form>

      <CreateServiceDialog
        open={serviceDialog}
        onOpenChange={setServiceDialog}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["active-services"] })}
        onCreated={(service) => void applyService(service)}
      />
    </>
  );
}
