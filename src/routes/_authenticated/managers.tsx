import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define the server function to create a new user
const createUserFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().min(2),
    })
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

export const Route = createFileRoute("/_authenticated/managers")({
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
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Managers"
        description="Add new users to the platform. They will be able to sign in and upload their receipts using the shared samples."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-gold" />
            <h2 className="font-display text-2xl">Add Manager</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Create a new account. The new manager will automatically have sample services generated for them when their account is created.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
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
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="premium" className="w-full mt-4" disabled={busy}>
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Manager
            </Button>
          </form>
        </section>

        <section className="surface-card flex flex-col justify-center items-center text-center rounded-xl p-6 bg-ink text-ink-foreground">
          <ShieldCheck className="h-12 w-12 text-gold mb-4" />
          <h3 className="font-display text-xl mb-2">Secure Isolation</h3>
          <p className="text-sm text-ink-foreground/70 max-w-sm">
            Each manager's data is isolated. They can only see receipts and services that they create. 
            Sample services are automatically provisioned upon account creation.
          </p>
        </section>
      </div>
    </>
  );
}
