import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return { user: data.user, profile };
  },
  component: () => {
    const { profile } = Route.useRouteContext();
    const { i18n } = useTranslation();

    useEffect(() => {
      if (profile?.preferred_locale && i18n.language !== profile.preferred_locale) {
        i18n.changeLanguage(profile.preferred_locale);
      }
    }, [profile?.preferred_locale, i18n]);

    return (
      <AppShell profile={profile}>
        <Outlet />
      </AppShell>
    );
  },
});
