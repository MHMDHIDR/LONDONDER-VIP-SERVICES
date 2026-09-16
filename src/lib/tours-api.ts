import { supabase } from "@/integrations/supabase/client";

export type TourProgressRow = { tour_id: string; version: number; dismissed: boolean };
export type TourProgressMap = Record<string, TourProgressRow>;

/** All tours the signed-in user has completed or dismissed, keyed by tour id. */
export async function fetchTourProgress(): Promise<TourProgressMap> {
  const { data, error } = await supabase
    .from("tour_progress")
    .select("tour_id, version, dismissed");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((row) => [row.tour_id, row]));
}

/** Record that the user has seen this version of a tour (completed, or closed early = dismissed). */
export async function markTourSeen(input: {
  tourId: string;
  version: number;
  dismissed: boolean;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("tour_progress").upsert(
    {
      user_id: user.id,
      tour_id: input.tourId,
      version: input.version,
      dismissed: input.dismissed,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tour_id" },
  );
  if (error) throw new Error(error.message);
}
