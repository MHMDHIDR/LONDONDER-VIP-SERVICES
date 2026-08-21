import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import {
  ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  fetchServices,
  resolvePriceAt,
  type Service,
} from "@/lib/api";
import { attachPayoutEvidence, fetchPayout, updatePayout } from "@/lib/payouts-api";
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
import { SearchableServiceSelect } from "@/components/SearchableServiceSelect";

import { LineItemsSection, type LineItem as DraftItem, emptyItem, itemPence } from "@/components/LineItemsSection";

export const Route = createFileRoute("/_authenticated/payouts/$id_/edit")({
  component: EditPayoutPage,
});


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
  const [workerNin, setWorkerNin] = useState("");
  const [paOrderId, setPaOrderId] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serviceDialog, setServiceDialog] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (payout) {
      setIssueDate(payout.issue_date || "");
      setWorkerId(payout.worker_id || "");
      setWorkerName((payout as any).worker?.name || "");
      setWorkerPhone(payout.worker_phone_snapshot || "");
      setWorkerNin(payout.worker_nin_snapshot || "");
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

  const update = useMutation({
    mutationFn: async () => {
      const payload = items
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          name: item.name.trim().slice(0, 200),
          description: item.description.trim().slice(0, 1000),
          quantity: Number.parseFloat(item.quantity) || 1,
          unit_price_pence: parsePoundsToPence(item.unitPrice) ?? 0,
        }));

      await updatePayout(
        id,
        {
          issue_date: issueDate,
          worker_id: workerId.trim() || null,
          worker_phone_snapshot: workerPhone.trim() || null,
          worker_nin_snapshot: workerNin.trim() || null,
          notes: notes.trim() || null,
          pa_order_id: paOrderId.trim() || null,
          service_id: serviceId,
        },
        payload
      );

      if (file) {
        try {
          await attachPayoutEvidence(id, file);
        } catch (error) {
          toast.warning("Payout updated, but evidence upload failed", {
            description: (error as Error).message,
          });
        }
      }
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
                <div className="flex items-end min-h-6"><Label htmlFor="issue-date">{t("payout.payoutDate")}</Label></div>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
                <div className="space-y-2">
                  <div className="flex items-end min-h-6"><Label htmlFor="service">{t("payout.service")}</Label></div>
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
                <WorkerSelect
                  value={workerId}
                  onChange={(w) => {
                    setWorkerId(w.id);
                    setWorkerPhone(w.phone || "");
                    setWorkerName(w.name || "");
                    setWorkerNin(w.nin || "");
                  }}
                  t={t}
                />
                <div className="space-y-2">
                  <div className="flex items-end min-h-6"><Label htmlFor="worker-phone">{t("payout.workerPhoneLabel") || "Worker phone number"}</Label></div>
                  <Input
                    id="worker-phone"
                    value={workerPhone}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-end min-h-6"><Label htmlFor="worker-nin">{t("workers.workerNin") || "National Insurance Number"}</Label></div>
                  <Input
                    id="worker-nin"
                    value={workerNin}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-end min-h-6"><Label htmlFor="pa-order-id">{t("payout.paOrderIdOpt")}</Label></div>
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
