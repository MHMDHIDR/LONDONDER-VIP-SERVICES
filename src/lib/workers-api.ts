import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Worker = Tables<"workers">;

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchWorkers(includeInactive = false): Promise<Worker[]> {
  let query = supabase.from("workers").select("*").is("deleted_at", null).order("name", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const res = await query;
  return unwrap(res) ?? [];
}

export async function fetchWorker(id: string): Promise<Worker | null> {
  const res = await supabase.from("workers").select("*").eq("id", id).maybeSingle();
  return unwrap(res) ?? null;
}

export async function createWorker(input: { data: { name: string; phone?: string | null } }) {
  const userId = await requireUserId();
  const res = await supabase
    .from("workers")
    .insert({
      user_id: userId,
      name: input.data.name.trim(),
      phone: input.data.phone?.trim() || "",
    })
    .select("*")
    .single();

  if (res.error) throw new Error(res.error.message);
  return res.data as Worker;
}

export async function updateWorker(input: {
  data: {
    id: string;
    patch: { name?: string; phone?: string | null; active?: boolean };
  };
}) {
  const patch: any = { ...input.data.patch };
  if (typeof patch.name === "string") patch.name = patch.name.trim();
  if (typeof patch.phone === "string") patch.phone = patch.phone.trim();
  
  const res = await supabase
    .from("workers")
    .update(patch)
    .eq("id", input.data.id)
    .select("*")
    .single();

  if (res.error) throw new Error(res.error.message);
  return res.data as Worker;
}

export async function deleteWorker(input: { data: string }) {
  const { error } = await supabase
    .from("workers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.data);
  if (error) throw new Error(error.message);
}
