import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Worker = Tables<"workers">;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchWorkers(includeInactive = false): Promise<Worker[]> {
  let query = supabase.from("workers").select("*").order("name", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const res = await query;
  return unwrap(res) ?? [];
}

export async function fetchWorker(id: string): Promise<Worker | null> {
  const res = await supabase.from("workers").select("*").eq("id", id).maybeSingle();
  return unwrap(res) ?? null;
}

export const createWorker = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      phone: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: worker, error } = await supabaseAdmin
      .from("workers")
      .insert({
        name: data.name,
        phone: data.phone,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return worker;
  });

export const updateWorker = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().optional(),
        phone: z.string().nullable().optional(),
        active: z.boolean().optional(),
      }),
    })
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: worker, error } = await supabaseAdmin
      .from("workers")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return worker;
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("workers")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
  });
