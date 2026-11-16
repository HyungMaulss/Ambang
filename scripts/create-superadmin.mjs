// Membuat (atau menaikkan) akun superadmin pertama. Jalankan dari komputer Anda:
//   npm run create-superadmin -- email@anda.com "SandiKuat123" "Nama Anda"
// Bila email sudah terdaftar, kata sandinya tidak diubah; hanya perannya dijadikan superadmin.
import { createClient } from "@supabase/supabase-js";

const [email, password, name = "Superadmin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !password || !url || !key) {
  console.error('Pakai: npm run create-superadmin -- <email> "<kata sandi>" "<nama>"  (butuh .env.local berisi URL & service role key)');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let id;
const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
if (created.error) {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  id = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!id) throw created.error;
  console.log("Akun sudah ada; kata sandi tidak diubah.");
} else id = created.data.user.id;

const { error } = await db.from("profiles").upsert({ id, name, role: "superadmin" });
if (error) throw error;
console.log(`Superadmin siap: ${email}. Masuk lewat /masuk dengan kata sandi, lalu buka /admin.`);
