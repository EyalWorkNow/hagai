import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import type { RentflowDb } from "./src/types";

const STATE_ROW_ID = "main";

function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: ws as any },
  });
}

const client = createSupabaseClient();

export const isSupabaseEnabled = Boolean(client);

export async function loadDbFromSupabase(): Promise<{ db: RentflowDb; revision: number } | null> {
  if (!client) return null;
  const { data, error } = await client
    .from("rentflow_state")
    .select("db_json, revision")
    .eq("id", STATE_ROW_ID)
    .single();
  if (error || !data) return null;
  return { db: data.db_json as RentflowDb, revision: data.revision as number };
}

export async function getRevisionFromSupabase(): Promise<number | null> {
  if (!client) return null;
  const { data, error } = await client
    .from("rentflow_state")
    .select("revision")
    .eq("id", STATE_ROW_ID)
    .single();
  if (error || !data) return null;
  return data.revision as number;
}

export async function saveDbToSupabase(db: RentflowDb, revision: number): Promise<void> {
  if (!client) return;
  const { error } = await client
    .from("rentflow_state")
    .upsert({ id: STATE_ROW_ID, db_json: db, revision, updated_at: new Date().toISOString() });
  if (error) throw error;
}
