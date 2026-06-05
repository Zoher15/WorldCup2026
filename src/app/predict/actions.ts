"use server";

import { getUserId } from "@/lib/identity";
import { savePredictions, type PredictionInput } from "@/lib/predictions";

export interface SaveResult {
  ok: boolean;
  saved?: number;
  skipped?: number;
  error?: string;
}

export async function savePredictionsAction(
  items: PredictionInput[],
): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) {
    return { ok: false, error: "Join or create a group first." };
  }
  try {
    const { saved, skipped } = await savePredictions(userId, items);
    return { ok: true, saved, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
