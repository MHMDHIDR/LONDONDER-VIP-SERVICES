import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";

export type Payout = Tables<"payouts">;
export type PayoutItem = Tables<"payout_items">;
export type PayoutAttachment = Tables<"payout_attachments">;

export const PAYOUT_ATTACHMENT_BUCKET = "payout-attachments";
export const PAYOUT_PDF_BUCKET = "payout-pdfs";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export type PayoutPage = { rows: any[]; total: number };

export async function fetchPayouts(opts: {
  search: string;
  limit: number;
  offset: number;
}): Promise<PayoutPage> {
  let query = supabase
    .from("payouts")
    .select("*, worker:workers(id, name), creator:profiles!payouts_creator_fkey(id, full_name, email), updater:profiles!payouts_updater_fkey(id, full_name, email)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  const term = opts.search.trim().replace(/[%,()]/g, "");
  if (term) {
    query = query.or(`payout_number.ilike.%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function fetchPayout(id: string): Promise<{
  payout: Payout;
  items: PayoutItem[];
  attachments: PayoutAttachment[];
} | null> {
  const payout = unwrap(
    await supabase
      .from("payouts")
      .select("*, worker:workers(id, name), creator:profiles!payouts_creator_fkey(id, full_name, email), updater:profiles!payouts_updater_fkey(id, full_name, email)")
      .eq("id", id)
      .maybeSingle(),
  ) as any | null;
  
  if (!payout) return null;
  
  const items = (unwrap(
    await supabase
      .from("payout_items")
      .select("*")
      .eq("payout_id", id)
      .order("position", { ascending: true }),
  ) as PayoutItem[] | null) ?? [];
  
  const attachments = (unwrap(
    await supabase
      .from("payout_attachments")
      .select("*")
      .eq("payout_id", id)
  ) as PayoutAttachment[] | null) ?? [];
  
  return { payout, items, attachments };
}

export type NewPayoutItem = {
  description: string;
  amount_pence: number;
};

export async function createPayout(input: {
  issueDate: string;
  workerId: string;
  notes: string | null;
  items: NewPayoutItem[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_payout", {
    _issue_date: input.issueDate,
    _worker_id: input.workerId,
    _notes: input.notes ?? "",
    _items: input.items as unknown as never,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function updatePayout(
  id: string,
  updates: Partial<Database["public"]["Tables"]["payouts"]["Update"]>,
  items?: NewPayoutItem[]
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (items) {
    const totalPence = items.reduce((acc, item) => acc + Math.round(item.amount_pence), 0);
    updates.total_pence = totalPence;
  }

  const { error } = await supabase
    .from("payouts")
    .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id);
    
  if (error) {
    console.error("Error updating payout:", error);
    throw new Error(error.message);
  }

  if (items) {
    const { error: deleteError } = await supabase
      .from("payout_items")
      .delete()
      .eq("payout_id", id);

    if (deleteError) {
      console.error("Error deleting payout items:", deleteError);
      throw new Error(deleteError.message);
    }

    if (items.length > 0) {
      const itemsToInsert = items.map((item, index) => ({
        payout_id: id,
        description: item.description,
        amount_pence: item.amount_pence,
        position: index,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase
        .from("payout_items")
        .insert(itemsToInsert);

      if (insertError) {
        console.error("Error inserting payout items:", insertError);
        throw new Error(insertError.message);
      }
    }
  }
}

export async function softDeletePayout(payoutId: string, pdfPath?: string | null) {
  const { error } = await supabase.from("payouts").update({ deleted_at: new Date().toISOString() }).eq("id", payoutId);
  if (error) throw new Error(error.message);
  if (pdfPath) {
    await supabase.storage.from(PAYOUT_PDF_BUCKET).remove([pdfPath]);
  }
}

export async function attachPayoutEvidence(payoutId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const userId = user.id;
  
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${userId}/${payoutId}/${Date.now()}-${safeName}`;
  const up = await supabase.storage.from(PAYOUT_ATTACHMENT_BUCKET).upload(path, file);
  if (up.error) throw new Error(up.error.message);
  
  const res = await supabase.from("payout_attachments").insert({
    payout_id: payoutId,
    user_id: userId,
    storage_path: path,
    filename: file.name.slice(0, 200),
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  });
  if (res.error) throw new Error(res.error.message);
  
  return path;
}

export async function storePayoutPdf(payoutId: string, payoutNumber: string, blob: Blob) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const userId = user.id;
  
  const path = `${userId}/${payoutId}/${payoutNumber}.pdf`;
  const up = await supabase.storage
    .from(PAYOUT_PDF_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
    
  if (up.error) throw new Error(up.error.message);
  
  await supabase.from("payouts").update({ pdf_path: path }).eq("id", payoutId);
  return path;
}
