import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPence, lineTotalPence, parsePoundsToPence } from "@/lib/money";

export type LineItem = {
  key: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export function emptyItem(): LineItem {
  return {
    key: crypto.randomUUID(),
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function itemPence(item: LineItem) {
  const quantity = Number.parseFloat(item.quantity);
  const unit = parsePoundsToPence(item.unitPrice) ?? 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return lineTotalPence(quantity, unit);
}

interface LineItemsSectionProps {
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  t: (key: string) => string;
  currency?: string;
}

export function LineItemsSection({ items, setItems, t, currency = "GBP" }: LineItemsSectionProps) {
  function patchItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  return (
    <section className="surface-card rounded-xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{t("receipt.lineItems")}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
        >
          <Plus aria-hidden="true" className="h-4 w-4 rtl:rotate-180 me-2 ms-0" />
          {t("receipt.addItem")}
        </Button>
      </div>

      <ul className="mt-5 space-y-4">
        {items.map((item, index) => (
          <li key={item.key} className="rounded-lg border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]">
              <div className="space-y-2">
                <Label htmlFor={`item-name-${item.key}`}>
                  {t("receipt.item")} {index + 1}
                </Label>
                <Input
                  id={`item-name-${item.key}`}
                  value={item.name}
                  maxLength={200}
                  placeholder={t("receipt.itemNamePlaceholder")}
                  onChange={(e) => patchItem(item.key, { name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-qty-${item.key}`}>{t("receipt.qty")}</Label>
                <Input
                  id={`item-qty-${item.key}`}
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`item-price-${item.key}`}>{currency === "GBP" ? t("receipt.unitPriceGbp") : t("receipt.unitPrice")}</Label>
                <Input
                  id={`item-price-${item.key}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={item.unitPrice}
                  onChange={(e) => patchItem(item.key, { unitPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor={`item-desc-${item.key}`}>{t("receipt.description")}</Label>
              <Input
                id={`item-desc-${item.key}`}
                value={item.description}
                maxLength={1000}
                onChange={(e) => patchItem(item.key, { description: e.target.value })}
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">
                {t("receipt.lineTotal")}{" "}
                <span className="font-medium text-foreground">
                  {formatPence(itemPence(item))}
                </span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove item ${index + 1}`}
                disabled={items.length === 1}
                onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
                {t("receipt.removeItem")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
