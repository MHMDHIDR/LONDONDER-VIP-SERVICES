import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  mode: z.enum(["signin", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Generative Receipts" },
      {
        name: "description",
        content:
          "Sign in or create your Generative Receipts account to issue premium GBP receipts for concierge services.",
      },
      { property: "og:title", content: "Sign in — Generative Receipts" },
      {
        property: "og:description",
        content: "Secure access to your concierge receipt studio.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<string>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [forgot, setForgot] = useState(search.mode === "forgot");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (forgot) {
      const parsed = z.string().trim().email().safeParse(email);
      if (!parsed.success) return setError("Enter a valid email address");
      setBusy(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (resetError) return setError(resetError.message);
      toast.success("Reset link sent", { description: "Check your inbox for the next step." });
      setForgot(false);
      return;
    }

    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      return setError(parsed.error.issues[0]?.message ?? "Check your details");
    }

    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (signInError) return setError("Those details didn't match an account.");
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-ink px-12 py-14 text-ink-foreground lg:flex">
        <div>
          <span className="gold-rule inline-flex h-11 w-11 items-center justify-center rounded-sm font-display text-base font-bold text-gold-foreground">
            GR
          </span>
        </div>
        <div className="max-w-md">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-gold">
            {t("auth.heroSubtitle")}
          </p>
          <h2 className="mt-4 font-display text-5xl leading-tight">
            {t("auth.heroTitle")}
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink-foreground/70">
            {t("auth.heroDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-foreground/60">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-gold" />
          {t("auth.heroIsolation")}
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:hidden">
            <span className="gold-rule inline-flex h-11 w-11 items-center justify-center rounded-sm font-display text-base font-bold text-gold-foreground">
              GR
            </span>
            <h1 className="mt-4 font-display text-3xl">{t("auth.brandName")}</h1>
          </div>

          {checkEmail ? (
            <div className="surface-card rounded-xl p-8 text-center">
              <Mail aria-hidden="true" className="mx-auto h-8 w-8 text-gold" />
              <h2 className="mt-4 font-display text-2xl">{t("auth.confirmEmailTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Open it to activate your
                account, then sign in.
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={() => {
                  setCheckEmail(false);
                  setTab("signin");
                }}
              >
                {t("auth.backToSignIn")}
              </Button>
            </div>
          ) : (
            <div className="surface-card rounded-xl p-6 sm:p-8">
              <h1 className="hidden font-display text-3xl lg:block">
                {forgot ? t("auth.resetPassword") : t("auth.signIn")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {forgot
                  ? t("auth.resetMessage")
                  : t("auth.welcome")}
              </p>


              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                  />
                </div>

                {!forgot ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t("common.password")}</Label>
                      {tab === "signin" ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                          onClick={() => setForgot(true)}
                        >
                          {t("auth.forgotPassword")}
                        </button>
                      ) : null}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                    />
                  </div>
                ) : null}

                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" variant="premium" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                  {forgot ? t("auth.sendResetLink") : t("auth.signIn")}
                </Button>

                {forgot ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setForgot(false)}
                  >
                    {t("auth.backToSignIn")}
                  </Button>
                ) : null}
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
