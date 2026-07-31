import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createService, type Service } from "@/lib/api";
import { parsePoundsToPence, todayLocalISO } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateServiceDialog({
  open,
  onOpenChange,
  onDone,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  onCreated?: (service: Service) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [from, setFrom] = useState(todayLocalISO());
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      amountPence: number;
      validFrom: string;
    }) => createService(input),
    onSuccess: (service) => {
      toast.success("Service created");
      onDone?.();
      onCreated?.(service);
      onOpenChange(false);
      setName("");
      setDescription("");
      setPrice("");
      setFrom(todayLocalISO());
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Service name must be at least 2 characters");
    const pence = parsePoundsToPence(price);
    if (pence === null) return setError(t("services.enterValidPrice"));
    if (create.isPending) return;
    create.mutate({
      name: name.trim().slice(0, 160),
      description: description.trim().slice(0, 2000),
      amountPence: pence,
      validFrom: new Date(`${from}T00:00:00`).toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{t("services.addNewService")}</DialogTitle>
          <DialogDescription>
            {t("services.addNewServiceDesc")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="service-name">{t("services.serviceName")}</Label>
            <Input
              id="service-name"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-description">{t("common.description")}</Label>
            <Textarea
              id="service-description"
              value={description}
              maxLength={2000}
              rows={3}
              className="resize-none"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-price">{t("services.priceGbp")}</Label>
              <Input
                id="service-price"
                inputMode="decimal"
                placeholder="185.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-from">{t("services.effectiveFrom")}</Label>
              <Input
                id="service-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="premium" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : null}
              {t("services.createService")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
