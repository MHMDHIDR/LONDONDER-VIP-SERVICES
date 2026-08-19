import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { fetchWorkers, type Worker } from "@/lib/workers-api";
import { Label } from "@/components/ui/label";
import { CreateWorkerSheet } from "@/components/CreateWorkerSheet";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Note: We need a CreateWorkerDialog which we can build later, 
// for now we'll just have the button emit an event or be a placeholder.
// We'll import a placeholder or build it in line.

interface WorkerSelectProps {
  value: string | undefined;
  onChange: (worker: Worker) => void;
  t: (key: string) => string;
}

export function WorkerSelect({ value, onChange, t }: WorkerSelectProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => fetchWorkers(false), // only active workers
  });

  const handleSelect = (id: string) => {
    const worker = workers.find((w) => w.id === id);
    if (worker) {
      onChange(worker);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="worker" className="text-paper-900">
          {t("payout.workerNameLabel")}
        </Label>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-gold-600 hover:text-gold-700" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 me-1" />
          {t("workers.createWorker")}
        </Button>
      </div>
      <Select value={value} onValueChange={handleSelect}>
        <SelectTrigger id="worker" className="bg-paper-100 border-paper-200">
          <SelectValue placeholder={t("payout.workerNameLabel")} />
        </SelectTrigger>
        <SelectContent>
          {workers.map((worker) => (
            <SelectItem key={worker.id} value={worker.id}>
              {worker.name} (No. {worker.worker_number})
            </SelectItem>
          ))}
          {workers.length === 0 && (
            <div className="p-2 text-sm text-paper-500 text-center">
              {t("workers.noWorkersFound")}
            </div>
          )}
        </SelectContent>
      </Select>
      <CreateWorkerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={(w) => onChange(w)}
      />
    </div>
  );
}
