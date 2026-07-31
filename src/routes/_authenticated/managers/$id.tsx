import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Trash2, KeyRound } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";

const getUserFn = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (error) throw new Error(error.message);
    return {
      id: user.user.id,
      email: user.user.email,
      full_name: user.user.user_metadata?.full_name || "Unknown",
    };
  });

const updateUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      email: z.string().email(),
      password: z.string().min(8).optional().or(z.literal("")),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attributes: any = { email: data.email, email_confirm: true };
    if (data.password) {
      attributes.password = data.password;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, attributes);
    if (error) throw new Error(error.message);
    return true;
  });

const deleteUserFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Delete user from auth (this will cascade delete their profile depending on FK constraint, 
    // but in Supabase deleting the user from auth.users usually cascades to public.profiles)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return true;
  });

export const Route = createFileRoute("/_authenticated/managers/$id")({
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  component: ManagerDetailsPage,
});

function ManagerDetailsPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: manager, isLoading } = useQuery({
    queryKey: ["manager", id],
    queryFn: () => getUserFn({ data: { id } }),
  });

  useEffect(() => {
    if (manager?.email) {
      setEmail(manager.email);
    }
  }, [manager]);

  const update = useMutation({
    mutationFn: () => updateUserFn({ data: { id, email, password } }),
    onSuccess: () => {
      toast.success(t("common.success"), { description: t("managers.updateDetails") });
      setPassword("");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteUserFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("managers.deleteManager"));
      router.navigate({ to: "/managers" });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!manager) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-xl font-medium">{t("managers.managerNotFound")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/managers">{t("common.cancel")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("managers.account")}
        title={manager.full_name}
        description={t("managers.editManager")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/managers">
              <ArrowLeft aria-hidden="true" className="h-4 w-4 ms-0 me-2 rtl:rotate-180" />
              {t("nav.managers")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">{t("managers.updateDetails")}</h2>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (password && password.length < 8) {
                setError(t("auth.passwordPlaceholder"));
                return;
              }
              update.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
              />
              <p className="text-sm text-muted-foreground">
                {t("managers.leaveBlank")}
              </p>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="premium" className="w-full" disabled={update.isPending}>
              {update.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 me-2 animate-spin" /> : null}
              {t("managers.saveChanges")}
            </Button>
          </form>
        </section>

        <section className="surface-card rounded-xl p-6 border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-2 mb-4 text-destructive">
            <Trash2 className="h-5 w-5" />
            <h2 className="font-display text-2xl">{t("managers.deleteManager")}</h2>
          </div>
          <p className="mb-6 text-sm text-destructive/80">
            {t("managers.deleteWarning")}
          </p>

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t("managers.deleteConfirm"))) {
                remove.mutate();
              }
            }}
          >
            {remove.isPending ? <Loader2 aria-hidden="true" className="h-4 w-4 me-2 animate-spin" /> : null}
            {t("managers.deleteManager")}
          </Button>
        </section>
      </div>
    </>
  );
}
