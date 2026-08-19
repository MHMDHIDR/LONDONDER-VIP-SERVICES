import { createFileRoute, Link, redirect, useRouter, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Trash2, KeyRound, Edit } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { softDeleteReceipt, restoreReceipt } from "@/lib/api";

const getUserFn = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (error) throw new Error(error.message);
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", data.id).single();
    return {
      id: user.user.id,
      email: user.user.email,
      full_name: profile?.full_name || user.user.user_metadata?.full_name || "Unknown",
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
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return {
      tab: typeof search.tab === "string" ? search.tab : undefined,
    };
  },
  beforeLoad: ({ context }) => {
    if (!(context as any).profile?.is_admin) throw redirect({ to: "/dashboard" });
  },
  component: ManagerDetailsPage,
});

function ManagerDetailsPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const activeTab = tab || "receipts";

  const { data: manager, isLoading } = useQuery({
    queryKey: ["manager", id],
    queryFn: () => getUserFn({ data: { id } }),
  });

  const { data: receipts, isLoading: isLoadingReceipts } = useQuery({
    queryKey: ["manager-receipts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredReceipts = receipts?.filter((r) => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(lowerQ) ||
      (r.pa_order_id && r.pa_order_id.toLowerCase().includes(lowerQ)) ||
      (r.issue_date && r.issue_date.toLowerCase().includes(lowerQ))
    );
  }) || [];

  const onTabChange = (val: string) => {
    navigate({ search: { tab: val } as any, replace: true });
  };

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

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full mt-6">
        <TabsList className="mb-4">
          <TabsTrigger value="receipts">Created receipts</TabsTrigger>
          <TabsTrigger value="details">Update details</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
          <div className="flex items-center justify-between mb-4">
            <Input 
              placeholder="Search receipts..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="max-w-sm bg-surface"
            />
          </div>
          <div className="border rounded-md bg-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingReceipts ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No receipts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceipts.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link to="/invoices/$id" params={{ id: r.id }}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                              {r.receipt_number}
                            </Badge>
                          </Link>
                          {r.deleted_at && (
                            <Badge variant="destructive">Deleted</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{r.pa_order_id || "-"}</TableCell>
                      <TableCell>{r.issue_date ? format(new Date(r.issue_date), "PP") : "-"}</TableCell>
                      <TableCell className="text-right">
                        {(r.total_pence / 100).toLocaleString(undefined, {
                          style: "currency",
                          currency: r.currency || "USD",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to="/invoices/$id/edit" params={{ id: r.id }}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          {r.deleted_at ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-600 hover:bg-green-600/10">
                                  Restore
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Restore Receipt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to restore this receipt?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-green-600 hover:bg-green-600/90 text-white"
                                    onClick={async () => {
                                      try {
                                        await restoreReceipt(r.id);
                                        queryClient.invalidateQueries({ queryKey: ["manager-receipts", id] });
                                        toast.success("Receipt restored successfully");
                                      } catch (err: any) {
                                        toast.error("Failed to restore receipt");
                                      }
                                    }}
                                  >
                                    Restore
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this receipt? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90 text-white"
                                    onClick={async () => {
                                      try {
                                        await softDeleteReceipt(r.id, r.pdf_path);
                                        queryClient.invalidateQueries({ queryKey: ["manager-receipts", id] });
                                        toast.success("Receipt deleted successfully");
                                      } catch (err: any) {
                                        toast.error("Failed to delete receipt");
                                      }
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="details">
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
        </TabsContent>
      </Tabs>
    </>
  );
}
