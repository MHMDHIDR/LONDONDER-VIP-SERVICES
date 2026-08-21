import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api";

interface SearchableServiceSelectProps {
  value: string | null;
  onChange: (service: Service) => void;
  services: Service[];
  isLoading: boolean;
  t: (key: string) => string;
}

export function SearchableServiceSelect({ value, onChange, services, isLoading, t }: SearchableServiceSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === value),
    [services, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="service"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedService
            ? selectedService.name
            : isLoading
              ? "Loading services…"
              : t("receipt.servicePlaceholder") || "Select a service"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemId, search) => {
            const service = services.find((s) => s.id === itemId);
            if (!service) return 0;
            const searchLower = search.toLowerCase();
            const target = service.name.toLowerCase();
            if (target.includes(searchLower)) return 1;
            
            // Subsequence matching
            let searchIndex = 0;
            for (let i = 0; i < target.length; i++) {
              if (target[i] === searchLower[searchIndex]) {
                searchIndex++;
              }
              if (searchIndex === searchLower.length) return 0.5;
            }
            return 0;
          }}
          className="flex flex-col md:flex-col-reverse"
        >
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandEmpty>{t("receipt.noServicesFound") || "No services found."}</CommandEmpty>
            <CommandGroup>
              {services.map((service) => (
                <CommandItem
                  key={service.id}
                  value={service.id}
                  onSelect={(currentValue) => {
                    const selected = services.find((s) => s.id === currentValue);
                    if (selected) onChange(selected);
                    setOpen(false);
                  }}
                  className="rtl:text-right"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === service.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {service.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandInput placeholder={t("common.search") || "Search..."} className="rtl:text-right" />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
