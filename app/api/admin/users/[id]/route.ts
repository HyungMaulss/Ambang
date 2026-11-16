import { requireSuperadmin, UUID } from "@/lib/admin-server";

/** Riwayat latihan, tryout, dan Excel satu pengguna. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireSuperadmin(req);
  if ("error" in g) return g.error;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "ID tidak valid." }, { status: 400 });

  const [{ data: u, error }, { data: profile }, { data: attempts }, { data: excel }] = await Promise.all([
    g.admin.auth.admin.getUserById(id),
    g.admin.from("profiles").select("name, role").eq("id", id).maybeSingle(),
    g.admin.from("attempts").select("id, mode, started_at, finished_at, score_breakdown").eq("user_id", id).not("finished_at", "is", null).order("started_at", { ascending: false }).limit(200),
    g.admin.from("excel_submissions").select("id, exercise_id, score, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  if (error || !u.user) return Response.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  return Response.json({
    user: { id, email: u.user.email ?? "", name: profile?.name ?? "", role: profile?.role ?? "user", createdAt: u.user.created_at },
    attempts: attempts ?? [],
    excel: excel ?? [],
  });
}
