import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import {
  fetchServices,
  resolvePriceAt,
  type Service,
} from "@/lib/api";
import { fetchPayout, updatePayout } from "@/lib/payouts-api";
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
import { WorkerSelect } from "@/components/WorkerSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/payouts/$id_/edit")({
  component: EditPayoutPage,
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

function EditPayoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();

  const { data, isPending, isError } = useQuery({
    queryKey: ["payout", id],
    queryFn: () => fetchPayout(id),
  });

  const payout = data?.payout;
  const originalItems = data?.items;

  const [issueDate, setIssueDate] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [paOrderId, setPaOrderId] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (payout) {
      setIssueDate(payout.issue_date || "");
      setWorkerId(payout.worker_id || "");
      setWorkerName((payout as any).worker?.name || "");
      setWorkerPhone(payout.worker_phone_snapshot || "");
      setPaOrderId(payout.pa_order_id || "");
      setNotes(payout.notes || "");
      setServiceId(payout.service_id || null);
    }
    if (originalItems && originalItems.length > 0) {
      setItems(
        originalItems.map((item) => ({
          key: crypto.randomUUID(),
          name: item.name,
          description: item.description || "",
          quantity: item.quantity.toString(),
          unitPrice: item.unit_price_pence !== null ? penceToInput(item.unit_price_pence) : "",
        }))
      );
    } else if (originalItems && originalItems.length === 0) {
      setItems([emptyItem()]);
    }
  }, [payout, originalItems]);

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
      const atISO =
        issueDate === todayLocalISO()
          ? new Date().toISOString()
          : new Date(`${issueDate}T23:59:59`).toISOString();
      const pence = await resolvePriceAt(service.id, atISO);
      if (pence === null) {
        toast.warning("No price found for that date", {
          description: "Enter the unit price manually for this payout.",
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

  const update = useMutation({
    mutationFn: async () => {
      const payload = items
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          description: [item.name.trim().slice(0, 200), item.description.trim().slice(0, 1000)]
            .filter(Boolean)
            .join(" \u2013 "),
          amount_pence: itemPence(item),
        }));

      await updatePayout(
        id,
        {
          issue_date: issueDate,
          worker_id: workerId.trim() || null,
          worker_phone_snapshot: workerPhone.trim() || null,
          notes: notes.trim() || null,
          pa_order_id: paOrderId.trim() || null,
          service_id: serviceId,
        },
        payload
      );
    },
    onSuccess: () => {
      toast.success("Payout updated");
      queryClient.invalidateQueries({ queryKey: ["payout", id] });
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      navigate({ to: "/payouts/$id", params: { id } });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (update.isPending) return;

    if (!issueDate) return setFormError("Choose a payout date.");
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
    update.mutate();
  }

  if (isPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !payout) {
    return (
      <div role="alert" className="surface-card rounded-xl p-10 text-center">
        <h1 className="font-display text-2xl">Payout not found</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payouts/$id" params={{ id }}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            Back to Payout
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Edit Document"
        title="Update Payout"
        description="Modify the details of your payout below."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">{t("payout.details")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-date">{t("payout.payoutDate")}</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service">{t("payout.service")}</Label>
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
              <WorkerSelect
                value={workerId}
                onChange={(w) => {
                  setWorkerId(w.id);
                  setWorkerPhone(w.phone || "");
                  setWorkerName(w.name || "");
                }}
                t={t}
              />
              <div className="space-y-2">
                <Label htmlFor="worker-phone">{t("payout.workerPhoneLabel")}</Label>
                <Input
                  id="worker-phone"
                  value={workerPhone}
                  readOnly
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-order-id">{t("payout.paOrderIdOpt")}</Label>
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
                  placeholder={t("payout.paOrderPlaceholder")}
                />
              </div>
            </div>
          </section>

          <section className="surface-card rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{t("payout.lineItems")}</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus aria-hidden="true" className="h-4 w-4 rtl:rotate-180 me-2 ms-0" />
                {t("payout.addItem")}
              </Button>
            </div>

            <ul className="mt-5 space-y-4">
              {items.map((item, index) => (
                <li key={item.key} className="rounded-lg border border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]">
                    <div className="space-y-2">
                      <Label htmlFor={`item-name-${item.key}`}>
                        {t("payout.item")} {index + 1}
                      </Label>
                      <Input
                        id={`item-name-${item.key}`}
                        value={item.name}
                        maxLength={200}
                        placeholder={t("payout.itemNamePlaceholder")}
                        onChange={(e) => patchItem(item.key, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`item-qty-${item.key}`}>{t("payout.qty")}</Label>
                      <Input
                        id={`item-qty-${item.key}`}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`item-price-${item.key}`}>{t("payout.unitPriceGbp")}</Label>
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
                    <Label htmlFor={`item-desc-${item.key}`}>{t("payout.description")}</Label>
                    <Input
                      id={`item-desc-${item.key}`}
                      value={item.description}
                      maxLength={1000}
                      onChange={(e) => patchItem(item.key, { description: e.target.value })}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">
                      {t("payout.lineTotal")}{" "}
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
                      <Trash2 aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
                      {t("payout.removeItem")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <NotesEvidenceSection
            notes={notes}
            setNotes={setNotes}
            t={t}
          />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">{t("payout.summary")}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("payout.payoutDate")}</dt>
                <dd className="text-right">{formatDateLong(issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("payout.worker")}</dt>
                <dd className="text-right">{workerName.trim() || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("payout.service")}</dt>
                <dd className="text-right">
                  {selectedService ? (
                    <Link
                      to="/services/$id"
                      params={{ id: selectedService.id }}
                      className="hover:underline"
                    >
                      {selectedService.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">{t("payout.subtotal")}</dt>
                <dd>{formatPence(subtotal)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-medium">{t("payout.totalGbp")}</dt>
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
              disabled={update.isPending}
            >
              {update.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin me-2 ms-0" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
              )}
              {update.isPending ? "Updating..." : "Update Payout"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {t("payout.lockedWarning")}
            </p>
          </div>

          {payout?.created_at && (() => {
            const creator = (payout as any).creator;
            const updater = (payout as any).updater;
            return (
            <div className="surface-card mt-6 rounded-xl p-6">
              <h3 className="font-display text-lg mb-4">Edit History</h3>
              <div className="relative border-l-2 border-border ml-4 space-y-6">
                {payout.updated_at && payout.updated_at !== payout.created_at && updater && (
                  <div className="relative pl-6">
                    <span className="absolute -left-4.25 top-0 bg-background rounded-full">
                      <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarFallback className="text-xs">
                          {getInitials(updater.full_name || updater.email)}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                    <p className="text-sm">
                      Last updated by{" "}
                      {updater.id ? (
                        <Link to="/managers/$id" params={{ id: updater.id }} className="font-medium hover:underline">
                          {updater.full_name || updater.email || "Unknown"}
                        </Link>
                      ) : (
                        <span className="font-medium">Unknown</span>
                      )}
                    </p>
                    <time className="text-xs text-muted-foreground">{formatDateTime(payout.updated_at)}</time>
                  </div>
                )}
                
                <div className="relative pl-6">
                  <span className="absolute -left-4.25 top-0 bg-background rounded-full">
                    <Avatar className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className="text-xs">
                        {getInitials(creator?.full_name || creator?.email || "Unknown")}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                  <p className="text-sm">
                    Created by{" "}
                    {creator?.id ? (
                      <Link to="/managers/$id" params={{ id: creator.id }} className="font-medium hover:underline">
                        {creator.full_name || creator.email || "Unknown"}
                      </Link>
                    ) : (
                      <span className="font-medium">Unknown</span>
                    )}
                  </p>
                  <time className="text-xs text-muted-foreground">{formatDateTime(payout.created_at)}</time>
                </div>
              </div>
            </div>
            );
          })()}
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
