import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";

export type Profile = Tables<"profiles">;
export type Service = Tables<"services">;
export type ServicePrice = Tables<"service_prices">;
export type Receipt = Tables<"receipts">;
export type ReceiptItem = Tables<"receipt_items">;
export type ReceiptAttachment = Tables<"receipt_attachments">;
export type BusinessSettings = Tables<"business_settings">;

export const LOGO_BUCKET = "business-logos";
export const ATTACHMENT_BUCKET = "receipt-attachments";
export const PDF_BUCKET = "receipt-pdfs";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const LOGO_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const ATTACHMENT_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ------------------------------- profile -------------------------------- */

export async function fetchProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  const res = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as Profile | null;
}

export async function updateLocale(locale: string) {
  const userId = await requireUserId();
  const res = await supabase
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("id", userId)
    .select("*")
    .single();
  return unwrap(res);
}

/* ------------------------------- settings -------------------------------- */

export const getGlobalBusinessSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: adminProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .single();

  if (!adminProfile) return null;

  const res = await supabaseAdmin
    .from("business_settings")
    .select("*")
    .eq("user_id", adminProfile.id)
    .maybeSingle();

  if (res.data) return res.data;

  // Create it for admin if it doesn't exist
  const created = await supabaseAdmin
    .from("business_settings")
    .insert({ user_id: adminProfile.id, business_name: "London VIP Services" })
    .select("*")
    .single();

  return created.data;
});

export const updateGlobalBusinessNameFn = createServerFn({ method: "POST" })
  .validator((name: string) => name)
  .handler(async ({ data: name }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1)
      .single();

    if (adminProfile) {
      await supabaseAdmin
        .from("business_settings")
        .update({ business_name: name })
        .eq("user_id", adminProfile.id);
    }
  });

export async function fetchBusinessSettings(): Promise<BusinessSettings | null> {
  const data = await getGlobalBusinessSettingsFn();
  return data as BusinessSettings | null;
}

export async function updateBusinessName(businessName: string) {
  await updateGlobalBusinessNameFn({ data: businessName });
  return await fetchBusinessSettings();
}

export const updateGlobalBusinessLogoFn = createServerFn({ method: "POST" })
  .validator((path: string | null) => path)
  .handler(async ({ data: path }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1)
      .single();

    if (adminProfile) {
      await supabaseAdmin
        .from("business_settings")
        .update({ logo_path: path })
        .eq("user_id", adminProfile.id);
    }
  });

export async function uploadLogo(file: File) {
  const userId = await requireUserId(); // We can upload to the current user's bucket folder, but link it globally
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${userId}/logo-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  
  await updateGlobalBusinessLogoFn({ data: path });
  return await fetchBusinessSettings();
}

export async function removeLogo(currentPath: string | null) {
  if (currentPath) await supabase.storage.from(LOGO_BUCKET).remove([currentPath]);
  await updateGlobalBusinessLogoFn({ data: null });
  return await fetchBusinessSettings();
}

export async function signedUrl(bucket: string, path: string | null, expiresIn = 300) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/* -------------------------------- services -------------------------------- */

export async function fetchServices(includeArchived = false): Promise<Service[]> {
  let query = supabase.from("services").select("*").order("name", { ascending: true });
  if (!includeArchived) query = query.eq("active", true);
  const res = await query;
  return unwrap(res) ?? [];
}

export async function fetchService(id: string): Promise<Service | null> {
  const res = await supabase.from("services").select("*").eq("id", id).single();
  return unwrap(res) ?? null;
}

export async function fetchServicePrices(serviceIds: string[]): Promise<ServicePrice[]> {
  if (serviceIds.length === 0) return [];
  const res = await supabase
    .from("service_prices")
    .select("*")
    .in("service_id", serviceIds)
    .order("valid_from", { ascending: false });
  return unwrap(res) ?? [];
}

export async function createService(input: {
  name: string;
  description?: string | null;
  amountPence: number;
  validFrom: string;
}) {
  const userId = await requireUserId();
  const inserted = await supabase
    .from("services")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .select("*")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  const service = inserted.data as Service;
  const { error } = await supabase.rpc("set_service_price", {
    _service_id: service.id,
    _amount_pence: input.amountPence,
    _valid_from: input.validFrom,
  });
  if (error) throw new Error(error.message);
  return service;
}

export async function updateService(
  id: string,
  patch: { name?: string; description?: string | null; active?: boolean },
) {
  const res = await supabase.from("services").update(patch).eq("id", id).select("*").single();
  return unwrap(res);
}

export async function setServicePrice(serviceId: string, amountPence: number, validFrom: string) {
  const { error } = await supabase.rpc("set_service_price", {
    _service_id: serviceId,
    _amount_pence: amountPence,
    _valid_from: validFrom,
  });
  if (error) throw new Error(error.message);
}

export async function resolvePriceAt(serviceId: string, atISO: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("resolve_service_price", {
    _service_id: serviceId,
    _at: atISO,
  });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? null;
}

/* -------------------------------- receipts -------------------------------- */

export type ReceiptPage = { rows: Receipt[]; total: number };

export async function fetchReceipts(opts: {
  search: string;
  limit: number;
  offset: number;
}): Promise<ReceiptPage> {
  let query = supabase
    .from("receipts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  const term = opts.search.trim().replace(/[%,()]/g, "");
  if (term) {
    query = query.or(
      [
        `receipt_number.ilike.%${term}%`,
        `customer_name.ilike.%${term}%`,
        `customer_email.ilike.%${term}%`,
        `service_name_snapshot.ilike.%${term}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function fetchReceipt(id: string): Promise<{
  receipt: Receipt;
  items: ReceiptItem[];
  attachments: ReceiptAttachment[];
} | null> {
  const receipt = unwrap(
    await supabase.from("receipts").select("*").eq("id", id).maybeSingle(),
  ) as Receipt | null;
  if (!receipt) return null;
  const items =
    (unwrap(
      await supabase
        .from("receipt_items")
        .select("*")
        .eq("receipt_id", id)
        .order("position", { ascending: true }),
    ) as ReceiptItem[] | null) ?? [];
  const attachments =
    (unwrap(await supabase.from("receipt_attachments").select("*").eq("receipt_id", id)) as
      ReceiptAttachment[] | null) ?? [];
  return { receipt, items, attachments };
}

export type NewReceiptItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unit_price_pence: number;
};

export async function createReceipt(input: {
  issueDate: string;
  customerName: string | null;
  customerEmail: string | null;
  notes: string | null;
  paOrderId: string | null;
  serviceId: string | null;
  items: NewReceiptItem[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_receipt", {
    _issue_date: input.issueDate,
    _customer_name: input.customerName ?? "",
    _customer_email: input.customerEmail ?? "",
    _notes: input.notes ?? "",
    _pa_order_id: input.paOrderId ?? undefined,
    _service_id: input.serviceId as string,
    _items: input.items as unknown as never,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function attachEvidence(receiptId: string, file: File) {
  const userId = await requireUserId();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${userId}/${receiptId}/${Date.now()}-${safeName}`;
  const up = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
  if (up.error) throw new Error(up.error.message);
  const res = await supabase.from("receipt_attachments").insert({
    receipt_id: receiptId,
    user_id: userId,
    storage_path: path,
    filename: file.name.slice(0, 200),
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  });
  if (res.error) throw new Error(res.error.message);
  return path;
}

export async function storeReceiptPdf(receiptId: string, receiptNumber: string, blob: Blob) {
  const userId = await requireUserId();
  const path = `${userId}/${receiptId}/${receiptNumber}.pdf`;
  const up = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);
  await supabase.from("receipts").update({ pdf_path: path }).eq("id", receiptId);
  return path;
}
