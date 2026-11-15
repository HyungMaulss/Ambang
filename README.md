# Ambang

Latihan SKD & Excel sampai lewat ambang batas. Next.js 15 + Supabase + Gemini, dirancang untuk biaya Rp0 (free tier) dan < 50 pengguna.

## Jalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tes skor, parser template, normalisasi rumus Excel
```

Tanpa `.env.local`, aplikasi berjalan dalam **mode demo**: 28 soal contoh orisinal (`data/soal-contoh.json`), riwayat di localStorage, tanpa login dan tanpa AI. Excel Lab dan unggah "latihan sekali pakai" berfungsi penuh.

## Aktifkan Supabase + AI

1. Buat proyek di Supabase, buka **SQL Editor**, jalankan `supabase/schema.sql`.
2. Salin `.env.example` menjadi `.env.local`, lalu isi URL, anon key, service role key, dan `GEMINI_API_KEY` (dari Google AI Studio).
3. Impor kategori dan soal: `npm run import-soal -- data/soal-contoh.json` (CSV juga bisa; formatnya ada di kepala `scripts/import-soal.mjs`).
4. Jadikan akun Anda admin: masuk sekali, lalu jalankan `update profiles set role = 'admin' where id = '<uuid>';` di SQL Editor.
5. Login Google: aktifkan provider Google di Supabase Auth, dan tambahkan URL situs ke *Redirect URLs*.
6. Di Vercel, isi env yang sama. `SUPABASE_SERVICE_ROLE_KEY` dan `GEMINI_API_KEY` **jangan** diberi awalan `NEXT_PUBLIC_`.

## Keputusan desain penting

- **Kunci jawaban tidak bisa dibaca dari API.** Kolom `question_options.score` tidak di-grant ke klien. Skor hanya keluar lewat RPC `check_answer` (latihan; ditolak bila soal ada di tryout aktif Anda) dan `submit_tryout` (dihitung di server dari `exam_configs`).
- **`ai_explanations` tidak publik**, berbeda dari BRD, agar pembahasan tidak bocor saat tryout. Cache dibaca lewat `/api/explain`.
- **Konfigurasi SKD** (jumlah soal, durasi, ambang) ada di tabel `exam_configs`, tidak ditulis mati di kode. Perbarui saat seleksi baru dibuka.
- **Unggah Word/PDF** diproses penuh di browser (mammoth, pdf.js legacy). File tidak pernah dikirim. Yang tersimpan hanya teks soal, dan hanya jika pengguna memilih "Simpan ke akun".
- **Materi Excel** statis di `lib/excel-lessons.ts`. Nilai harapan dihitung dari rumus solusi, bukan ditulis manual. Tabel `excel_lessons`/`excel_exercises` di BRD sengaja tidak dibuat.
- **Moderasi** (draft → review → published) dilakukan admin lewat Supabase Table Editor. Belum ada UI admin.

## Lisensi pihak ketiga

HyperFormula dipakai dengan lisensi **GPLv3** (`licenseKey: "gpl-v3"`). Jika repo ini dipublikasikan, ikuti GPLv3, atau ganti ke formula.js (MIT) yang fungsinya lebih sedikit.

## Sebelum rilis

- Cek ulang batas free tier Supabase, Vercel, dan Gemini di halaman resmi.
- Supabase Free menjeda proyek setelah 7 hari tidak aktif, dan tidak punya backup harian. Ekspor CSV/pg_dump tiap minggu.
- Gerbang Tahap 1 BRD: 300 soal tervalidasi. Soal contoh baru 28.
