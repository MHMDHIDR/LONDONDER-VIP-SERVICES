import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, FileText, Loader2, AlertTriangle, Download, Eye } from "lucide-react";
import { fetchReceipts } from "@/lib/api";
import { formatDateLong, formatPence } from "@/lib/money";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 11;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard, Generative Receipts" },
      { name: "description", content: "Browse, search and download your generated GBP receipts." },
      { property: "og:title", content: "Dashboard, Generative Receipts" },
      { property: "og:description", content: "Your saved concierge service receipts." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ["receipts", search, limit],
    queryFn: () => fetchReceipts({ search, limit, offset: 0 }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <Button asChild variant="premium" size="lg">
            <Link to="/receipts/new">
              <Plus aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
              {t("dashboard.generateNew")}
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search receipts"
            placeholder={t("dashboard.searchPlaceholder")}
            className="ps-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {isPending
            ? t("dashboard.loadingReceipts")
            : `${total} ${total === 1 ? t("dashboard.receiptCount") : t("dashboard.receiptsCount")}`}
          {isFetching && !isPending ? t("dashboard.updating") : ""}
        </p>
      </div>

      {isError ? (
        <div
          role="alert"
          className="surface-card flex items-center gap-3 rounded-xl p-6 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          {(error as Error).message}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <li>
          <Link
            to="/receipts/new"
            className="group flex h-full min-h-[15rem] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-card p-6 text-center transition-all hover:border-gold hover:shadow-[var(--shadow-lift)]"
          >
            <span className="gold-rule flex h-16 w-16 items-center justify-center rounded-full text-gold-foreground transition-transform group-hover:scale-105">
              <Plus aria-hidden="true" className="h-8 w-8" />
            </span>
            <span className="font-display text-xl">{t("dashboard.generateNew")}</span>
            <span className="text-xs text-muted-foreground">{t("dashboard.generateNewDesc")}</span>
          </Link>
        </li>

        {isPending
          ? Array.from({ length: 3 }).map((_, index) => (
              <li key={index}>
                <Skeleton className="h-[15rem] w-full rounded-xl" />
              </li>
            ))
          : rows.map((receipt) => (
              <li key={receipt.id}>
                <article className="surface-card flex h-full min-h-[15rem] flex-col rounded-xl p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-eyebrow">{receipt.receipt_number}</p>
                      <h2 className="mt-1 font-display text-xl leading-tight">
                        {receipt.customer_name || t("dashboard.noCustomer")}
                      </h2>
                    </div>
                    <span className="rounded-full border border-gold/40 bg-gold-soft/40 px-2.5 py-1 text-[0.65rem] uppercase tracking-wider text-gold-foreground">
                      {receipt.status}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {receipt.service_name_snapshot || t("dashboard.customLineItems")}
                  </p>

                  <dl className="mt-auto space-y-1 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("dashboard.date")}</dt>
                      <dd>{formatDateLong(receipt.issue_date)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("dashboard.total")}</dt>
                      <dd className="font-display text-lg">{formatPence(receipt.total_pence)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex gap-2 border-t border-border pt-4">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to="/receipts/$id" params={{ id: receipt.id }}>
                        <Eye aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
                        {t("dashboard.view")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary" className="flex-1">
                      <Link
                        to="/receipts/$id"
                        params={{ id: receipt.id }}
                        search={{ download: true }}
                      >
                        <Download aria-hidden="true" className="h-4 w-4 ms-0 me-2" />
                        {t("dashboard.pdf")}
                      </Link>
                    </Button>
                  </div>
                </article>
              </li>
            ))}
      </ul>

      {!isPending && rows.length === 0 ? (
        <div className="surface-card mt-6 rounded-xl p-10 text-center">
          <FileText aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-2xl">
            {search ? t("dashboard.noReceiptsSearch") : t("dashboard.noReceipts")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {search ? t("dashboard.noReceiptsSearchDesc") : t("dashboard.noReceiptsDesc")}
          </p>
        </div>
      ) : null}

      {rows.length < total ? (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((v) => v + PAGE_SIZE)}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {t("dashboard.loadMore", { count: total - rows.length })}
          </Button>
        </div>
      ) : null}
    </>
  );
}
