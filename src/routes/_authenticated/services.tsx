import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Loader2, Archive, ArchiveRestore, Pencil, TrendingUp } from "lucide-react";
import {
  createService,
  fetchServicePrices,
  fetchServices,
  setServicePrice,
  updateService,
  type Service,
  type ServicePrice,
} from "@/lib/api";
import { formatPence, parsePoundsToPence, penceToInput, todayLocalISO } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { CreateServiceDialog } from "@/components/CreateServiceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "Services — Generative Receipts" },
      {
        name: "description",
        content: "Manage concierge services, archive old ones and keep a full GBP price history.",
      },
      { property: "og:title", content: "Services — Generative Receipts" },
      { property: "og:description", content: "Service catalogue and price history." },
    ],
  }),
  component: ServicesPage,
});

type PriceBucket = "current" | "upcoming" | "past";

function bucketOf(price: ServicePrice): PriceBucket {
  const now = Date.now();
  const from = new Date(price.valid_from).getTime();
  const to = price.valid_to ? new Date(price.valid_to).getTime() : Infinity;
  if (from > now) return "upcoming";
  if (to <= now) return "past";
  return "current";
}

function dateTimeLabel(value: string | null) {
  if (!value) return "ongoing";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [pricing, setPricing] = useState<Service | null>(null);

  const { data: services, isPending } = useQuery({
    queryKey: ["services", "all"],
    queryFn: () => fetchServices(true),
  });

  const ids = useMemo(() => (services ?? []).map((s) => s.id), [services]);
  const { data: prices } = useQuery({
    queryKey: ["service-prices", ids],
    queryFn: () => fetchServicePrices(ids),
    enabled: ids.length > 0,
  });

  const pricesByService = useMemo(() => {
    const map = new Map<string, ServicePrice[]>();
    for (const price of prices ?? []) {
      const list = map.get(price.service_id) ?? [];
      list.push(price);
      map.set(price.service_id, list);
    }
    return map;
  }, [prices]);

  const visible = (services ?? []).filter((service) => {
    if (!showArchived && !service.active) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      service.name.toLowerCase().includes(term) ||
      (service.description ?? "").toLowerCase().includes(term)
    );
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["services"] });
    queryClient.invalidateQueries({ queryKey: ["service-prices"] });
    queryClient.invalidateQueries({ queryKey: ["active-services"] });
  };

  const archive = useMutation({
    mutationFn: (service: Service) => updateService(service.id, { active: !service.active }),
    onSuccess: (_data, service) => {
      toast.success(service.active ? "Service archived" : "Service restored");
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not update service", { description: error.message }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Services"
        description="Each service keeps a full price history. Editing a price closes the previous period and opens a new one — past receipts never change."
        actions={
          <Button variant="premium" size="lg" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            New service
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search services"
            placeholder="Search services"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
            Show archived
          </Label>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center">
          <TrendingUp aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-2xl">No services found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a service to make it selectable when generating receipts.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {visible.map((service) => {
            const list = pricesByService.get(service.id) ?? [];
            const current = list.find((p) => bucketOf(p) === "current");
            const upcoming = list.filter((p) => bucketOf(p) === "upcoming");
            const past = list.filter((p) => bucketOf(p) === "past");

            return (
              <li key={service.id}>
                <article className="surface-card rounded-xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl">{service.name}</h2>
                        {!service.active ? (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                            Archived
                          </span>
                        ) : null}
                      </div>
                      {service.description ? (
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-eyebrow">Current price</p>
                      <p className="font-display text-3xl">
                        {current ? formatPence(current.amount_pence) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(service)}>
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                      Edit details
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setPricing(service)}>
                      <TrendingUp aria-hidden="true" className="h-4 w-4" />
                      Change price
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => archive.mutate(service)}
                      disabled={archive.isPending}
                    >
                      {service.active ? (
                        <Archive aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore aria-hidden="true" className="h-4 w-4" />
                      )}
                      {service.active ? "Archive" : "Restore"}
                    </Button>
                  </div>

                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="text-eyebrow mb-3">Price history</h3>
                    <ol className="space-y-2">
                      {[...upcoming, ...(current ? [current] : []), ...past].map((price) => {
                        const bucket = bucketOf(price);
                        return (
                          <li
                            key={price.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={
                                  bucket === "current"
                                    ? "rounded-full bg-gold-soft px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-gold-foreground"
                                    : "rounded-full bg-muted px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-muted-foreground"
                                }
                              >
                                {bucket}
                              </span>
                              <span className="font-medium">{formatPence(price.amount_pence)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              {dateTimeLabel(price.valid_from)} → {dateTimeLabel(price.valid_to)}
                            </span>
                          </li>
                        );
                      })}
                      {list.length === 0 ? (
                        <li className="text-sm text-muted-foreground">No price recorded yet.</li>
                      ) : null}
                    </ol>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <CreateServiceDialog open={createOpen} onOpenChange={setCreateOpen} onDone={invalidate} />
      <EditServiceDialog service={editing} onClose={() => setEditing(null)} onDone={invalidate} />
      <PriceDialog
        service={pricing}
        currentPence={
          pricing
            ? (pricesByService.get(pricing.id) ?? []).find((p) => bucketOf(p) === "current")
                ?.amount_pence ?? null
            : null
        }
        onClose={() => setPricing(null)}
        onDone={invalidate}
      />
    </>
  );
}

function EditServiceDialog({
  service,
  onClose,
  onDone,
}: {
  service: Service | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [initialised, setInitialised] = useState<string | null>(null);

  if (service && initialised !== service.id) {
    setInitialised(service.id);
    setName(service.name);
    setDescription(service.description ?? "");
  }

  const save = useMutation({
    mutationFn: () =>
      updateService(service!.id, {
        name: name.trim().slice(0, 160),
        description: description.trim().slice(0, 2000) || null,
      }),
    onSuccess: () => {
      toast.success("Service updated");
      onDone();
      onClose();
    },
    onError: (error: Error) => toast.error("Could not update", { description: error.message }),
  });

  return (
    <Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit service</DialogTitle>
          <DialogDescription>
            Details apply to future receipts only. Use “Change price” to adjust pricing.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 2 || save.isPending) return;
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-name">Service name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              rows={3}
              className="resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="premium" disabled={save.isPending}>
              {save.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceDialog({
  service,
  currentPence,
  onClose,
  onDone,
}: {
  service: Service | null;
  currentPence: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(todayLocalISO());
  const [error, setError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState<string | null>(null);

  if (service && initialised !== service.id) {
    setInitialised(service.id);
    setAmount(currentPence !== null ? penceToInput(currentPence) : "");
    setFrom(todayLocalISO());
    setError(null);
  }

  const save = useMutation({
    mutationFn: (input: { pence: number; iso: string }) =>
      setServicePrice(service!.id, input.pence, input.iso),
    onSuccess: () => {
      toast.success("Price updated", { description: "Previous price period was closed." });
      onDone();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Change price</DialogTitle>
          <DialogDescription>
            A new price period starts on the chosen date. Existing receipts are never altered. A
            future date schedules the price in advance.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const pence = parsePoundsToPence(amount);
            if (pence === null) return setError("Enter a valid price, e.g. 199.50");
            if (save.isPending) return;
            save.mutate({ pence, iso: new Date(`${from}T00:00:00`).toISOString() });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="price-amount">New price (GBP)</Label>
            <Input
              id="price-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-from">Effective from</Label>
            <Input
              id="price-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="premium" disabled={save.isPending}>
              {save.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              Save price
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
