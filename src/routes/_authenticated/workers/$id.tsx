import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Trash2, FileText, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchWorker, updateWorker, deleteWorker } from "@/lib/workers-api";
import { fetchPayouts } from "@/lib/payouts-api";
import { formatDateLong } from "@/lib/money";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/workers/$id")({
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [{ title: "Edit Worker, Generative Invoices" }],
  }),
  component: WorkerEditPage,
});

function WorkerEditPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);

  const { data: worker, isLoading } = useQuery({
    queryKey: ["worker", id],
    queryFn: () => fetchWorker(id),
  });

  const { data: payoutsPage, isLoading: isLoadingPayouts } = useQuery({
    queryKey: ["payouts", "worker", id],
    queryFn: () => fetchPayouts({ search: "", limit: 100, offset: 0, workerId: id }),
    enabled: !!worker,
  });

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setPhone(worker.phone || "");
      setNin(worker.nin || "");
      setActive(worker.active);
    }
  }, [worker]);

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      await updateWorker({
        data: {
          id,
          patch: {
            name,
            phone: phone || undefined,
            nin: nin || null,
            active,
          },
        },
      });
      toast.success(t("workers.updateDetails"));
    } catch (err: any) {
      setError(err.message || "Failed to update worker");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    setBusy(true);
    try {
      await deleteWorker({ data: id });
      toast.success(t("workers.deleteWorker"));
      navigate({ to: "/workers" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete worker");
      setBusy(false);
      setShowConfirm2(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>{t("workers.workerNotFound")}</p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/workers">{t("workers.existingWorkers")}</Link>
        </Button>
      </div>
    );
  }

  const payouts = payoutsPage?.rows || [];

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to="/workers" aria-label="Back to workers">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Link>
        </Button>
        <PageHeader
          eyebrow={t("workers.account")}
          title={t("workers.editWorker")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="surface-card rounded-xl p-6">
          <form className="space-y-6" onSubmit={handleUpdate} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">{t("workers.workerName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("workers.workerPhone")}</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nin">{t("workers.workerNin") || "National Insurance Number"}</Label>
              <Input
                id="nin"
                value={nin}
                onChange={(e) => setNin(e.target.value.toUpperCase())}
                placeholder="e.g. QQ 12 34 56 A"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">{t("workers.activeStatus")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("workers.activeStatusDesc")}
                </p>
              </div>
              <Switch
                id="active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="premium" className="w-full" disabled={busy}>
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("workers.saveChanges")}
            </Button>
          </form>
        </section>

        <section className="surface-card rounded-xl p-6">
          <div className="mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">{t("workers.workerPayouts")}</h2>
          </div>
          
          {isLoadingPayouts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length > 0 ? (
            <div className="space-y-3 max-h-100 overflow-y-auto pr-2">
              {payouts.map((payout) => (
                <Link
                  key={payout.id}
                  to="/payouts/$id"
                  params={{ id: payout.id }}
                  className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:border-gold/50 hover:bg-gold/5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground group-hover:text-gold transition-colors">
                      {payout.payout_number}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateLong(payout.issue_date)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("workers.noPayoutsFound")}
            </p>
          )}
        </section>
      </div>

      {/* Danger Zone */}
      <div className="mt-16">
        <h3 className="text-lg font-medium text-destructive mb-4">{t("workers.dangerZone")}</h3>
        <section className="surface-card rounded-xl p-6 border-destructive/30 bg-destructive/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h4 className="font-medium text-destructive">{t("workers.deleteWorkerPermanent")}</h4>
            <p className="text-sm text-destructive/80 mt-1 max-w-xl">
              {t("workers.deleteWorkerDesc")}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowConfirm1(true)}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("workers.deleteWorker")}
          </Button>
        </section>
      </div>

      {/* Double Confirmation Dialogs */}
      <AlertDialog open={showConfirm1} onOpenChange={setShowConfirm1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workers.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workers.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setShowConfirm1(false);
                setTimeout(() => setShowConfirm2(true), 150);
              }}
            >
              {t("common.yes")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showConfirm2} onOpenChange={setShowConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workers.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workers.deleteDoubleConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={handleDeleteConfirm}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("workers.deleteWorker")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
