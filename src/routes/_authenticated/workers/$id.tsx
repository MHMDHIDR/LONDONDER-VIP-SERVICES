import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchWorker, updateWorker, deleteWorker } from "@/lib/workers-api";

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
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: worker, isLoading } = useQuery({
    queryKey: ["worker", id],
    queryFn: () => fetchWorker(id),
  });

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setPhone(worker.phone || "");
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
            phone: phone || null,
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

  async function handleDelete() {
    if (!window.confirm(t("workers.deleteConfirm"))) return;
    setBusy(true);
    try {
      await deleteWorker({ data: id });
      toast.success(t("workers.deleteWorker"));
      navigate({ to: "/workers" });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete worker");
      setBusy(false);
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

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive workers won't appear in the payout dropdown.
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

        <section className="surface-card rounded-xl p-6 border-destructive/20 bg-destructive/5">
          <h2 className="font-display text-xl text-destructive mb-2">{t("workers.deleteWorker")}</h2>
          <p className="text-sm text-destructive/80 mb-6">
            {t("workers.deleteWarning")}
          </p>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={busy}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("workers.deleteWorker")}
          </Button>
        </section>
      </div>
    </>
  );
}
