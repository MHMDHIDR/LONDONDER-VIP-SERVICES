import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorker, type Worker } from "@/lib/workers-api";

interface CreateWorkerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (worker: Worker) => void;
}

export function CreateWorkerSheet({ open, onOpenChange, onSuccess }: CreateWorkerSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createWorker,
    onSuccess: (newWorker) => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success(t("workers.addSuccess") || "Worker created successfully");
      onSuccess(newWorker);
      handleOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create worker");
    },
  });

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setName("");
      setPhone("");
      setNin("");
      setError(null);
      mutation.reset();
    }
    onOpenChange(newOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Worker name is required");
    mutation.mutate({ data: { name: name.trim(), phone: phone.trim() || undefined, nin: nin.trim() || undefined } });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("workers.addWorker") || "Add Worker"}</SheetTitle>
          <SheetDescription>
            {t("workers.addWorkerDescription") || "Create a new worker profile. A unique worker number will be automatically assigned."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="worker-name">{t("workers.workerName") || "Worker name"}</Label>
            <Input
              id="worker-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workers.workerName") || "Full name"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worker-phone">{t("workers.workerPhone") || "Worker phone number"}</Label>
            <Input
              id="worker-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("workers.phonePlaceholder") || "Phone number"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worker-nin">{t("workers.workerNin") || "National Insurance Number"}</Label>
            <Input
              id="worker-nin"
              value={nin}
              onChange={(e) => setNin(e.target.value.toUpperCase())}
              placeholder={t("workers.ninPlaceholder") || "e.g. QQ 12 34 56 A"}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("workers.addWorker") || "Add Worker"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
