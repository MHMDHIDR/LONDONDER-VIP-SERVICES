import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/AppShell";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { StackedSeriesChart } from "@/components/dashboard/StackedSeriesChart";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics, Londoner VIP Services" },
      {
        name: "description",
        content: "Revenue, payouts and who they went to, for any period you choose.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        eyebrow={t("analytics.eyebrow")}
        title={t("analytics.title")}
        description={t("analytics.description")}
      />
      <OverviewSection
        extra={(model) => (
          <div className="lg:col-span-2">
            <StackedSeriesChart
              title={t("dashboard.overview.paidOutByWorker")}
              description={t("dashboard.overview.paidOutByWorkerDesc")}
              summaryLabel={t("dashboard.overview.paidOut")}
              total={model.current.paidOut}
              series={model.workers.series}
              rows={model.workers.rows}
              granularity={model.granularity}
              labels={{
                unnamed: t("dashboard.overview.unknownWorker"),
                other: t("dashboard.overview.other"),
              }}
            />
          </div>
        )}
      />
    </>
  );
}
