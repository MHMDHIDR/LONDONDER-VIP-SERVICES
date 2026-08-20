import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateLong, formatPence } from "@/lib/money";
import { TFunction } from "i18next";

export interface DocumentSummaryProps {
  date: string | Date;
  recipientLabel: string;
  recipientName: string;
  serviceName: React.ReactNode;
  subtotal: number;
  isPending: boolean;
  submitLabel: string;
  warningText: string;
  t: TFunction<any, any>;
  children?: React.ReactNode;
}

export function DocumentSummary({
  date,
  recipientLabel,
  recipientName,
  serviceName,
  subtotal,
  isPending,
  submitLabel,
  warningText,
  t,
  children,
}: DocumentSummaryProps) {
  return (
    <Card className="surface-card p-6 shadow-none">
      <h2 className="font-display text-2xl">{t("receipt.summary")}</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("receipt.receiptDate")}</dt>
          <dd className="text-right">{formatDateLong(typeof date === "string" ? date : date.toISOString())}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{recipientLabel}</dt>
          <dd className="text-right">{recipientName.trim() || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t("receipt.service")}</dt>
          <dd className="text-right">{serviceName || "—"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-3">
          <dt className="text-muted-foreground">{t("receipt.subtotal")}</dt>
          <dd>{formatPence(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-medium">{t("receipt.totalGbp")}</dt>
          <dd className="font-display text-3xl">{formatPence(subtotal)}</dd>
        </div>
      </dl>

      {children}

      <Button
        type="submit"
        variant="premium"
        size="lg"
        className="mt-6 w-full"
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin me-2 ms-0" />
        ) : (
          <Lock aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
        )}
        {submitLabel}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {warningText}
      </p>
    </Card>
  );
}
