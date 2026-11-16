import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Hanya untuk route handler server. Service role key tidak pernah sampai ke browser.
export type Gate = { admin: SupabaseClient; userId: string } | { error: Response };

const fail = (status: number, error: string) => ({ error: Response.json({ error }, { status }) });

/** Pastikan pemanggil login dan berperan superadmin. */
export async function requireSuperadmin(req: Request): Promise<Gate> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(503, "Fitur superadmin butuh Supabase (mode demo tidak mendukung).");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const user = token ? (await admin.auth.getUser(token)).data.user : null;
  if (!user) return fail(401, "Masuk dulu.");
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "superadmin") return fail(403, "Khusus superadmin.");
  return { admin, userId: user.id };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
