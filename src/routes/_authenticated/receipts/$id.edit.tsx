import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { fetchReceipt, updateReceipt } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/receipts/$id/edit")({
  component: EditReceiptPage,
});

function EditReceiptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();

  const { data, isPending, isError } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetchReceipt(id),
  });

  const receipt = data?.receipt;

  const [issueDate, setIssueDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paOrderId, setPaOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (receipt) {
      setIssueDate(receipt.issue_date || "");
      setCustomerName(receipt.customer_name || "");
      setCustomerEmail(receipt.customer_email || "");
      setPaOrderId(receipt.pa_order_id || "");
      setNotes(receipt.notes || "");
    }
  }, [receipt]);

  const update = useMutation({
    mutationFn: async () => {
      await updateReceipt(id, {
        issue_date: issueDate,
        customer_name: customerName.trim() || null,
        customer_email: customerEmail.trim() || null,
        pa_order_id: paOrderId.trim() || null,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Receipt updated");
      queryClient.invalidateQueries({ queryKey: ["receipt", id] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      navigate({ to: "/receipts/$id", params: { id } });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (update.isPending) return;

    if (!issueDate) return setFormError("Choose a receipt date.");
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      return setFormError("Enter a valid customer email or leave it blank.");
    }
    update.mutate();
  }

  if (isPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div role="alert" className="surface-card rounded-xl p-10 text-center">
        <h1 className="font-display text-2xl">Receipt not found</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/receipts/$id" params={{ id }}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            Back to Receipt
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Edit Document"
        title="Edit Receipt"
        description="Update the receipt details."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">{t("receipt.details")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-date">{t("receipt.receiptDate")}</Label>
                <Input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">{t("receipt.customerNameOpt")}</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  maxLength={160}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">{t("receipt.customerEmailOpt")}</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  maxLength={254}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pa-order-id">{t("receipt.paOrderIdOpt")}</Label>
                <Input
                  id="pa-order-id"
                  value={paOrderId}
                  maxLength={160}
                  onChange={(e) => setPaOrderId(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (
                      !/[\d\b]/.test(e.key) &&
                      e.key !== "Backspace" &&
                      e.key !== "ArrowLeft" &&
                      e.key !== "ArrowRight" &&
                      e.key !== "Tab" &&
                      e.key !== "Delete"
                    ) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t("receipt.paOrderPlaceholder")}
                />
              </div>
            </div>
          </section>

          <section className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">{t("receipt.notes")}</h2>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">{t("receipt.notes")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={2000}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-32 resize-none overflow-y-auto"
                  placeholder={t("receipt.notesPlaceholder")}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card rounded-xl p-6">
            <h2 className="font-display text-2xl">Actions</h2>

            {formError ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="premium"
              size="lg"
              className="mt-6 w-full"
              disabled={update.isPending}
            >
              {update.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin me-2 ms-0" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
              )}
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}
