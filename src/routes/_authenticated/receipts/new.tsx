import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { CreateServiceDialog } from "@/components/CreateServiceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/receipts/new")({
  head: () => ({
    meta: [
      { title: "New receipt — Generative Receipts" },
      {
        name: "description",
        content: "Generate a GBP receipt with historically accurate service pricing.",
      },
      { property: "og:title", content: "New receipt — Generative Receipts" },
      { property: "og:description", content: "Create a premium receipt in seconds." },
    ],
  }),
  component: NewReceiptPage,
});

type DraftItem = {
  key: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function emptyItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function itemPence(item: DraftItem) {
  const quantity = Number.parseFloat(item.quantity);
  const unit = parsePoundsToPence(item.unitPrice) ?? 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return lineTotalPence(quantity, unit);
}

function NewReceiptPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

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

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function applyService(service: Service) {
    setServiceId(service.id);
    setPriceLoading(true);
    try {
      const pence = await resolvePriceAt(service.id, new Date(`${issueDate}T12:00:00`).toISOString());
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
      navigate({ to: "/receipts/$id", params: { id } });
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
        eyebrow="New document"
        title="Generate receipt"
        description="Pricing is resolved from the service's price history for the receipt date. Anything you change here is snapshotted onto this receipt only."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">Details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-date">Receipt date</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <div className="flex gap-2">
                  <Select
                    value={serviceId ?? undefined}
                    onValueChange={(value) => {
                      const service = (services ?? []).find((s) => s.id === value);
                      if (service) void applyService(service);
                    }}
                  >
                    <SelectTrigger id="service" aria-label="Service">
                      <SelectValue
                        placeholder={servicesLoading ? "Loading services…" : "Select a service"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(services ?? []).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Label htmlFor="customer-name">Customer name (optional)</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  maxLength={160}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Customer email (optional)</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  maxLength={254}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-order-id">PA Order ID (optional)</Label>
                <Input
                  id="pa-order-id"
                  value={paOrderId}
                  maxLength={160}
                  onChange={(e) => setPaOrderId(e.target.value)}
                  placeholder="Link to specific order"
                />
              </div>
            </div>
          </section>

          <section className="surface-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Line items</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add item
              </Button>
            </div>

            <ul className="mt-5 space-y-4">
              {items.map((item, index) => (
                <li key={item.key} className="rounded-lg border border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]">
                    <div className="space-y-2">
                      <Label htmlFor={`item-name-${item.key}`}>Item {index + 1}</Label>
                      <Input
                        id={`item-name-${item.key}`}
                        value={item.name}
                        maxLength={200}
                        placeholder="Service or item name"
                        onChange={(e) => patchItem(item.key, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`item-qty-${item.key}`}>Qty</Label>
                      <Input
                        id={`item-qty-${item.key}`}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`item-price-${item.key}`}>Unit price (£)</Label>
                      <Input
                        id={`item-price-${item.key}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => patchItem(item.key, { unitPrice: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor={`item-desc-${item.key}`}>Description</Label>
                    <Input
                      id={`item-desc-${item.key}`}
                      value={item.description}
                      maxLength={1000}
                      onChange={(e) => patchItem(item.key, { description: e.target.value })}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">
                      Line total{" "}
                      <span className="font-medium text-foreground">
                        {formatPence(itemPence(item))}
                      </span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">Notes & evidence</h2>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-32 resize-none overflow-y-auto"
                  placeholder="Payment terms, thanks, reference numbers…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidence">Expense evidence (optional)</Label>
                <input
                  ref={fileRef}
                  id="evidence"
                  type="file"
                  className="sr-only"
                  accept={ATTACHMENT_MIME.join(",")}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Paperclip aria-hidden="true" className="h-4 w-4" />
                    Choose file
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {file ? file.name : "PNG, JPEG, WebP or PDF · up to 10 MB"}
                  </p>
                  {file ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                      Clear
                    </Button>
                  ) : null}
                </div>
                {fileError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {fileError}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Receipt date</dt>
                <dd className="text-right">{formatDateLong(issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Client</dt>
                <dd className="text-right">{customerName.trim() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="text-right">{selectedService?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatPence(subtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-medium">Total (GBP)</dt>
                <dd className="font-display text-3xl">{formatPence(subtotal)}</dd>
              </div>
            </dl>

            {formError ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="premium"
              size="lg"
              className="mt-6 w-full"
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ReceiptIcon aria-hidden="true" className="h-4 w-4" />
              )}
              {generate.isPending ? "Generating…" : "Generate receipt"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              The receipt number and totals are locked once generated.
            </p>
          </div>
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
