import { requireSuperadmin } from "@/lib/admin-server";

type Breakdown = { total: number; passed: boolean } | null;

/** Daftar akun + ringkasan skor. */
export async function GET(req: Request) {
  const g = await requireSuperadmin(req);
  if ("error" in g) return g.error;
  // shortcut: satu halaman 1000 akun dan semua attempt dimuat sekaligus — cukup untuk < 50 pengguna (BRD). Paginasi bila tumbuh.
  const [{ data: list, error }, { data: profiles }, { data: attempts }] = await Promise.all([
    g.admin.auth.admin.listUsers({ perPage: 1000 }),
    g.admin.from("profiles").select("id, name, role"),
    g.admin.from("attempts").select("user_id, mode, finished_at, score_breakdown").not("finished_at", "is", null).order("finished_at", { ascending: false }),
  ]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const users = list.users.map((u) => {
    const mine = (attempts ?? []).filter((a) => a.user_id === u.id);
    const tryouts = mine.filter((a) => a.mode === "tryout").map((a) => a.score_breakdown as Breakdown).filter(Boolean) as NonNullable<Breakdown>[];
    return {
      id: u.id,
      email: u.email ?? "",
      name: prof.get(u.id)?.name ?? "",
      role: prof.get(u.id)?.role ?? "user",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      practiceCount: mine.filter((a) => a.mode === "practice").length,
      tryoutCount: tryouts.length,
      lastTotal: tryouts[0]?.total ?? null,
      lastPassed: tryouts[0]?.passed ?? null,
      bestTotal: tryouts.length ? Math.max(...tryouts.map((t) => t.total)) : null,
      lastActivity: mine[0]?.finished_at ?? null,
    };
  });
  users.sort((a, b) => (b.lastActivity ?? b.createdAt).localeCompare(a.lastActivity ?? a.createdAt));
  return Response.json({ users });
}

/** Buat akun pengguna baru (email + kata sandi, langsung aktif). */
export async function POST(req: Request) {
  const g = await requireSuperadmin(req);
  if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email tidak valid." }, { status: 400 });
  if (!name || name.length > 80) return Response.json({ error: "Nama wajib diisi (maks. 80 karakter)." }, { status: 400 });
  if (password.length < 8 || password.length > 72) return Response.json({ error: "Kata sandi 8–72 karakter." }, { status: 400 });

  const { data, error } = await g.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) {
    const dup = /already|registered|exists/i.test(error.message);
    return Response.json({ error: dup ? "Email ini sudah terdaftar." : error.message }, { status: dup ? 409 : 500 });
  }
  // trigger handle_new_user membuat profil; pastikan nama dan peran tetap benar
  await g.admin.from("profiles").upsert({ id: data.user.id, name, role: "user" });
  return Response.json({ id: data.user.id, email }, { status: 201 });
}
