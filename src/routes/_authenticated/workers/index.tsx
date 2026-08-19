import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, HardHat, Users, ChevronRight, User } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchWorkers, createWorker } from "@/lib/workers-api";

export const Route = createFileRoute("/_authenticated/workers/")({
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Workers, Generative Invoices" },
      { name: "description", content: "Manage workers." },
    ],
  }),
  component: WorkersPage,
});

function WorkersPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: workers = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["workers", "all"],
    queryFn: () => fetchWorkers(true),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      await createWorker({
        data: {
          name,
          phone: phone || null,
        },
      });
      toast.success(t("workers.addWorker"), {
        description: "Worker created successfully.",
      });
      setName("");
      setPhone("");
      refetch(); // Reload the workers list
    } catch (err: any) {
      setError(err.message || "Failed to create worker");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t("workers.account")}
        title={t("workers.title")}
        description={t("workers.description")}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardHat className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">{t("workers.addWorker")}</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("workers.addWorkerDescription")}
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">{t("workers.workerName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workers.namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t("workers.workerPhone")}</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("workers.phonePlaceholder")}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="premium" className="w-full" disabled={busy}>
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("workers.createWorker")}
            </Button>
          </form>
        </section>

        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <h2 className="font-display text-2xl">{t("workers.existingWorkers")}</h2>
            </div>
            {isLoading ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          <div className="space-y-3">
            {workers.map((worker) => (
              <Link
                key={worker.id}
                to="/workers/$id"
                params={{ id: worker.id }}
                className={`group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold/50 hover:bg-gold/5 ${!worker.active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-gold/20 group-hover:text-gold transition-colors">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{worker.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("workers.workerNumber")}: {worker.worker_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-gold transition-colors">
                  <span className="text-sm font-medium">{t("workers.manage")}</span>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </div>
              </Link>
            ))}

            {workers.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("workers.noWorkersFound")}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
