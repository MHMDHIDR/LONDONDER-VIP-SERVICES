import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, UserPlus, Users, ChevronRight, User } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFileRoute, redirect } from "@tanstack/react-router";

// Define the server function to create a new user
const createUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().min(2),
    }),
  )
  .handler(async ({ data }) => {
    // Import the admin client inside the server function
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return userData;
  });

// Define the server function to list users
const listUsersFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      throw new Error(error.message);
    }
    
    // We filter to remove full sensitive data, returning just what we need
    return usersData.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      full_name: u.user_metadata?.full_name || "Unknown",
    }));
  });

export const Route = createFileRoute("/_authenticated/managers/")({
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Managers — Generative Receipts" },
      { name: "description", content: "Manage users and permissions." },
    ],
  }),
  component: ManagersPage,
});

function ManagersPage() {
  const { t } = useTranslation();
  const { profile } = Route.useRouteContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      await createUserFn({
        data: {
          email,
          password,
          fullName,
        },
      });
      toast.success("Manager created", {
        description: "They can now sign in with the provided credentials.",
      });
      setEmail("");
      setPassword("");
      setFullName("");
      refetch(); // Reload the managers list
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  const { data: managersRaw, isLoading, refetch } = useQuery({
    queryKey: ["managers-list"],
    queryFn: () => listUsersFn(),
  });

  const managers = managersRaw?.filter(m => m.id !== profile?.id) || [];

  return (
    <>
      <PageHeader
        eyebrow={t("managers.account")}
        title={t("managers.title")}
        description={t("managers.description")}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">{t("managers.addManager")}</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("managers.addManagerDescription")}
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("common.fullName")}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Manager Name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="new-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@company.co.uk"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("managers.initialPassword")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="premium" className="w-full" disabled={busy}>
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("managers.createManager")}
            </Button>
          </form>
        </section>

        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <h2 className="font-display text-2xl">{t("managers.existingManagers")}</h2>
            </div>
            {isLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="space-y-3">
            {managers.map((manager) => (
              <Link
                key={manager.id}
                to="/managers/$id"
                params={{ id: manager.id }}
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold/50 hover:bg-gold/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-gold/20 group-hover:text-gold transition-colors">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{manager.full_name}</p>
                    <p className="text-sm text-muted-foreground">{manager.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-gold transition-colors">
                  <span className="text-sm font-medium">{t("managers.manage")}</span>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </div>
              </Link>
            ))}
            
            {managers.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No managers found.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
