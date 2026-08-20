import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ATTACHMENT_MIME } from "@/lib/api";

import { TFunction } from "i18next";

interface NotesEvidenceSectionProps {
  notes: string;
  setNotes: (notes: string) => void;
  file?: File | null;
  setFile?: (file: File | null) => void;
  fileError?: string | null;
  handleFile?: (file: File | undefined) => void;
  t: TFunction<any, any>;
}

export function NotesEvidenceSection({
  notes,
  setNotes,
  file,
  setFile,
  fileError,
  handleFile,
  t,
}: NotesEvidenceSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const showEvidence = Boolean(handleFile && setFile);

  return (
    <section className="surface-card rounded-xl p-6">
      <h2 className="font-display text-2xl">
        {showEvidence ? t("receipt.notesAndEvidence") : t("receipt.notes")}
      </h2>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">{t("receipt.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            className="h-32 resize-none overflow-y-auto"
            placeholder={t("receipt.notesPlaceholder")}
          />
        </div>

        {showEvidence && (
          <div className="space-y-2">
            <Label htmlFor="evidence">{t("receipt.evidenceOpt")}</Label>
            <input
              ref={fileRef}
              id="evidence"
              type="file"
              className="sr-only"
              accept={ATTACHMENT_MIME.join(",")}
              onChange={(e) => handleFile?.(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Paperclip aria-hidden="true" className="h-4 w-4 me-2 ms-0" />
                {t("receipt.chooseFile")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "PNG, JPEG, WebP or PDF · up to 10 MB"}
              </p>
              {file && setFile ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  {t("receipt.clearFile")}
                </Button>
              ) : null}
            </div>
            {fileError ? (
              <p role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
