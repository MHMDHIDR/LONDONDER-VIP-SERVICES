import { useQuery } from "@tanstack/react-query";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { fetchWorkers, type Worker } from "@/lib/workers-api";
import { Label } from "@/components/ui/label";
import { CreateWorkerSheet } from "@/components/CreateWorkerSheet";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface WorkerSelectProps {
  value: string | undefined;
  onChange: (worker: Worker) => void;
  t: (key: string) => string;
}

export function WorkerSelect({ value, onChange, t }: WorkerSelectProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [open, setOpen] = useState(false);
  
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => fetchWorkers(false), // only active workers
  });

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === value),
    [workers, value]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between min-h-6">
        <Label htmlFor="worker" className="text-paper-900">
          {t("payout.workerNameLabel") || "Worker Name"}
        </Label>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-gold-600 hover:text-gold-700" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 me-1" />
          {t("workers.createWorker") || "Create Worker"}
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="worker"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-paper-100 border-paper-200 font-normal"
          >
            {selectedWorker
              ? `${selectedWorker.name} (No. ${selectedWorker.worker_number})`
              : t("payout.workerNameLabel") || "Select worker..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(value, search) => {
              // Extract the worker ID (the CommandItem value) and find the actual worker
              const worker = workers.find((w) => w.id === value);
              if (!worker) return 0;
              const searchTerm = search.toLowerCase();
              const matchName = worker.name.toLowerCase().includes(searchTerm);
              const matchNin = worker.nin?.toLowerCase().includes(searchTerm);
              const matchNumber = worker.worker_number.toString().includes(searchTerm);
              return matchName || matchNin || matchNumber ? 1 : 0;
            }}
          >
            {workers.length > 5 && (
              <CommandInput placeholder={t("common.search") || "Search..."} className="rtl:text-right" />
            )}
            <CommandList>
              <CommandEmpty>{t("workers.noWorkersFound") || "No workers found"}</CommandEmpty>
              <CommandGroup>
                {workers.map((worker) => (
                  <CommandItem
                    key={worker.id}
                    value={worker.id}
                    onSelect={(currentValue) => {
                      const selected = workers.find((w) => w.id === currentValue);
                      if (selected) onChange(selected);
                      setOpen(false);
                    }}
                    className="rtl:text-right"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === worker.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {worker.name} (No. {worker.worker_number})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateWorkerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={(w) => onChange(w)}
      />
    </div>
  );
}
