import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatPence, lineTotalPence, parsePoundsToPence } from "@/lib/money";
import type { Service } from "@/lib/api";

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

/** Check if each character of `query` appears in order within `target` (case-insensitive). */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchServices(
  query: string,
  services: Array<Pick<Service, "id" | "name" | "description">>,
  max = 5,
): Array<Pick<Service, "id" | "name" | "description">> {
  if (!query.trim()) return [];
  const lowerQuery = query.toLowerCase();
  const results: Array<Pick<Service, "id" | "name" | "description">> = [];
  for (const s of services) {
    if (results.length >= max) break;
    if (s.name.toLowerCase().includes(lowerQuery) || fuzzyMatch(query, s.name)) {
      results.push(s);
    }
  }
  return results;
}

interface LineItemsSectionProps {
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  t: (key: string) => string;
  currency?: string;
  services?: Array<Pick<Service, "id" | "name" | "description">>;
}

export function LineItemsSection({ items, setItems, t, currency = "GBP", services }: LineItemsSectionProps) {
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
                <ServiceAutocompleteInput
                  id={`item-name-${item.key}`}
                  value={item.name}
                  maxLength={200}
                  placeholder={t("receipt.itemNamePlaceholder")}
                  services={services}
                  onChange={(value) => patchItem(item.key, { name: value })}
                  onSelect={(service) =>
                    patchItem(item.key, {
                      name: service.name,
                      description: service.description ?? "",
                    })
                  }
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

/* ------------------------------------------------------------------ */
/*  ServiceAutocompleteInput – combo input with dropdown suggestions   */
/* ------------------------------------------------------------------ */

interface ServiceAutocompleteInputProps {
  id: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  services?: Array<Pick<Service, "id" | "name" | "description">>;
  onChange: (value: string) => void;
  onSelect: (service: Pick<Service, "id" | "name" | "description">) => void;
}

function ServiceAutocompleteInput({
  id,
  value,
  maxLength,
  placeholder,
  services,
  onChange,
  onSelect,
}: ServiceAutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasServices = services && services.length > 0;
  const suggestions = hasServices ? matchServices(value, services) : [];
  const showDropdown = open && suggestions.length > 0;

  function selectService(service: Pick<Service, "id" | "name" | "description">) {
    onSelect(service);
    setOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0 && highlightIndex < suggestions.length) {
      e.preventDefault();
      selectService(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  // No services available — render plain input
  if (!hasServices) {
    return (
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            if (value.trim().length >= 1) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightIndex >= 0 ? `${id}-option-${highlightIndex}` : undefined
          }
        />
      </PopoverAnchor>
      <PopoverContent
        id={`${id}-listbox`}
        role="listbox"
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {suggestions.map((service, i) => (
          <button
            key={service.id}
            id={`${id}-option-${i}`}
            role="option"
            type="button"
            aria-selected={i === highlightIndex}
            className={`w-full rounded-sm px-3 py-2 text-start text-sm cursor-pointer transition-colors ${
              i === highlightIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
            onMouseDown={(e) => {
              // Use mouseDown to fire before input blur
              e.preventDefault();
              selectService(service);
            }}
          >
            <span className="font-medium">{service.name}</span>
            {service.description && (
              <span className="block text-xs text-muted-foreground truncate">
                {service.description}
              </span>
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
