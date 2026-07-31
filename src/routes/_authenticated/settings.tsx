import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Building2, Bell, BellOff, Globe } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useTranslation } from "react-i18next";
import {
  fetchBusinessSettings,
  removeLogo,
  signedUrl,
  updateBusinessName,
  updateLocale,
  uploadLogo,
  LOGO_BUCKET,
  LOGO_MIME,
  MAX_LOGO_BYTES,
} from "@/lib/api";
import { Route as AuthRoute } from "@/routes/_authenticated/route";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Settings — Generative Receipts" },
      { name: "description", content: "Manage your business name and logo used on new receipts." },
      { property: "og:title", content: "Settings — Generative Receipts" },
      { property: "og:description", content: "Business branding for your receipts." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = AuthRoute.useRouteContext();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = useNotifications(true);

  const { data: settings, isPending } = useQuery({
    queryKey: ["business-settings"],
    queryFn: fetchBusinessSettings,
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-url", settings?.logo_path],
    queryFn: () => signedUrl(LOGO_BUCKET, settings?.logo_path ?? null, 3600),
    enabled: Boolean(settings?.logo_path),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["business-settings"] });
    queryClient.invalidateQueries({ queryKey: ["logo-url"] });
  };

  const saveName = useMutation({
    mutationFn: (value: string) => updateBusinessName(value),
    onSuccess: () => {
      toast.success("Business name saved");
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not save", { description: error.message }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadLogo(file),
    onSuccess: () => {
      toast.success("Logo updated");
      invalidate();
    },
    onError: (error: Error) => toast.error("Upload failed", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: () => removeLogo(settings?.logo_path ?? null),
    onSuccess: () => {
      toast.success("Logo removed");
      invalidate();
    },
    onError: (error: Error) => toast.error("Could not remove logo", { description: error.message }),
  });

  const changeLanguage = useMutation({
    mutationFn: (locale: string) => updateLocale(locale),
    onSuccess: (data) => {
      i18n.changeLanguage(data.preferred_locale);
      toast.success(t("common.save") + " " + t("common.success"));
    },
    onError: (error: Error) => toast.error(t("common.error"), { description: error.message }),
  });

  const currentName = name ?? settings?.business_name ?? "";

  function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!LOGO_MIME.includes(file.type)) {
      setFileError("Logo must be a PNG, JPEG, WebP or SVG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setFileError("Logo must be 2 MB or smaller.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">{t("settings.languageAndRegion")}</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("settings.languageDescription")}
          </p>

          <div className="space-y-2">
            <Label>{t("settings.language")}</Label>
            <Select
              value={profile?.preferred_locale || "en"}
              onValueChange={(val) => changeLanguage.mutate(val)}
              disabled={changeLanguage.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("settings.language")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.english")}</SelectItem>
                <SelectItem value="ar">{t("settings.arabic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="surface-card rounded-xl p-6">
          <h2 className="font-display text-2xl">Business name</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in the app header and printed on new receipts.
          </p>
          {isPending ? (
            <Skeleton className="mt-6 h-10 w-full" />
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = currentName.trim();
                if (trimmed.length < 2) {
                  toast.error("Business name must be at least 2 characters");
                  return;
                }
                saveName.mutate(trimmed.slice(0, 120));
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="business-name">Name</Label>
                <Input
                  id="business-name"
                  value={currentName}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="premium" disabled={saveName.isPending}>
                {saveName.isPending ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </form>
          )}
        </section>

        <section className="surface-card rounded-xl p-6">
          <h2 className="font-display text-2xl">Business logo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            PNG, JPEG, WebP or SVG · up to 2 MB. Stored privately and served through short-lived
            signed links.
          </p>

          <div className="mt-6 flex items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {logoUrl ? (
                <img src={logoUrl} alt="Current business logo" className="h-full w-full object-contain" />
              ) : (
                <Building2 aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                id="logo-file"
                type="file"
                className="sr-only"
                accept={LOGO_MIME.join(",")}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload aria-hidden="true" className="h-4 w-4" />
                )}
                {settings?.logo_path ? "Replace logo" : "Upload logo"}
              </Button>
              {settings?.logo_path ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          {fileError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {fileError}
            </p>
          ) : null}
        </section>

        <section className="surface-card rounded-xl p-6 lg:col-span-2">
          <h2 className="font-display text-2xl">Push Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get notified when managers create new receipts.
          </p>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="font-medium text-ink-foreground">
                {isSupported ? (
                  isSubscribed ? "You are subscribed to notifications" : "Notifications are disabled"
                ) : (
                  "Push notifications are not supported in this browser"
                )}
              </p>
              {isSupported && permission === "denied" && (
                <p className="text-sm text-destructive mt-1">
                  You have blocked notifications in your browser settings.
                </p>
              )}
            </div>
            
            {isSupported && (
              <Button
                variant={isSubscribed ? "outline" : "premium"}
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={permission === "denied"}
              >
                {isSubscribed ? (
                  <>
                    <BellOff className="mr-2 h-4 w-4" />
                    Unsubscribe
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Enable Notifications
                  </>
                )}
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
