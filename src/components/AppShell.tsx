import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Settings, Sparkles, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBusinessSettings, signedUrl, LOGO_BUCKET } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["business-settings"],
    queryFn: fetchBusinessSettings,
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["logo-url", settings?.logo_path],
    queryFn: () => signedUrl(LOGO_BUCKET, settings?.logo_path ?? null, 3600),
    enabled: Boolean(settings?.logo_path),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="no-print sticky top-0 z-40 bg-ink text-ink-foreground">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-3 rounded-sm" aria-label="Go to dashboard">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 rounded-sm object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="gold-rule flex h-8 w-8 items-center justify-center rounded-sm font-display text-sm font-bold text-gold-foreground"
              >
                GR
              </span>
            )}
            <span className="flex flex-col leading-tight">
              <span className="font-display text-lg">
                {settings?.business_name || "Generative Receipts"}
              </span>
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-gold">
                Generative Receipts
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm text-ink-foreground/70 transition-colors hover:bg-white/10 hover:text-ink-foreground"
                activeProps={{ className: "bg-white/10 text-ink-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm text-ink-foreground/80 transition-colors hover:bg-white/10 hover:text-ink-foreground"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </nav>

          <button
            type="button"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
        <div className="gold-rule h-px w-full opacity-70" aria-hidden="true" />

        {open ? (
          <nav aria-label="Mobile" className="border-t border-white/10 bg-ink px-4 pb-4 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-ink-foreground/80 hover:bg-white/10"
                activeProps={{ className: "bg-white/10 text-ink-foreground" }}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-ink-foreground/80 hover:bg-white/10"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="no-print border-t border-border py-6 text-center text-xs text-muted-foreground">
        Generative Receipts — private, owner-only records. All amounts in GBP.
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="text-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
