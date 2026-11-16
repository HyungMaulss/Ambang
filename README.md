# Ambang

Latihan SKD & Excel sampai lewat ambang batas. Next.js 15 + Supabase + Gemini, dirancang untuk biaya Rp0 (free tier) dan < 50 pengguna.

## Jalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tes skor, parser, rumus Excel, validitas bank soal & 15 latihan Excel
```

Tanpa `.env.local`, aplikasi berjalan dalam **mode demo**: 146 soal orisinal (`data/soal-*.json`: 37 TWK, 45 TIU, 51 TKP, 13 psikotes, cukup untuk tryout penuh 110 soal), riwayat di localStorage, tanpa login dan tanpa AI. Excel Lab dan unggah "latihan sekali pakai" berfungsi penuh.

## Aktifkan Supabase + AI

1. Buat proyek di Supabase, buka **SQL Editor**, jalankan `supabase/schema.sql`.
2. Salin `.env.example` menjadi `.env.local`, lalu isi URL, anon key, service role key, dan `GEMINI_API_KEY` (dari Google AI Studio).
3. Impor kategori dan semua soal bawaan: `npm run import-soal` (file CSV/JSON lain: `npm run import-soal -- soal.csv`; formatnya ada di kepala `scripts/import-soal.mjs`).
4. Buat superadmin: `npm run create-superadmin -- email@anda.com "SandiKuat123" "Nama Anda"`. Masuk di `/masuk` (tab Kata sandi), lalu buka `/admin` untuk membuat akun pengguna dan melihat riwayat tryout, latihan, dan nilai Excel mereka.
5. Login Google: aktifkan provider Google di Supabase Auth, dan tambahkan URL situs ke *Redirect URLs*.
6. Di Vercel, isi env yang sama. `SUPABASE_SERVICE_ROLE_KEY` dan `GEMINI_API_KEY` **jangan** diberi awalan `NEXT_PUBLIC_`.

## Keputusan desain penting

- **Kunci jawaban tidak bisa dibaca dari API.** Kolom `question_options.score` tidak di-grant ke klien. Skor hanya keluar lewat RPC `check_answer` (latihan; ditolak bila soal ada di tryout aktif Anda) dan `submit_tryout` (dihitung di server dari `exam_configs`).
- **`ai_explanations` tidak publik**, berbeda dari BRD, agar pembahasan tidak bocor saat tryout. Cache dibaca lewat `/api/explain`.
- **Konfigurasi SKD** (jumlah soal, durasi, ambang) ada di tabel `exam_configs`, tidak ditulis mati di kode. Perbarui saat seleksi baru dibuka.
- **Unggah Word/PDF** diproses penuh di browser (mammoth, pdf.js legacy). File tidak pernah dikirim. Yang tersimpan hanya teks soal, dan hanya jika pengguna memilih "Simpan ke akun".
- **Materi Excel** (15 topik) statis di `lib/excel-lessons.ts` dan `lib/excel-lessons-2.ts`. Nilai harapan dihitung dari rumus solusi, bukan ditulis manual. Tabel `excel_lessons`/`excel_exercises` di BRD sengaja tidak dibuat.
- **Peran**: `superadmin` membuat akun (email + kata sandi, langsung aktif) dan melihat riwayat skor semua pengguna di `/admin`, lewat route server `/api/admin/*` yang memeriksa peran dengan service role. `admin` dan `superadmin` sama-sama bisa memoderasi soal (draft → review → published) lewat Supabase Table Editor.
- **Identitas**: Sistem logo v1. Tema default navy (#0F1D33) dengan teks putih (#F4F7FB) dan aksen emas lembut (#F2C14E); tema terang putih kebiruan dengan tinta navy. Teks beraksen memakai token `accent-ink` agar tetap terbaca di latar terang. Kontras teks ≥ 5,5:1 (navy ≥ 7:1). Wordmark & judul Bricolage Grotesque 600, teks Plus Jakarta Sans, sudut 0 px.
- **Excel Lab** meniru Excel: Kotak Nama + bilah rumus, klik/seret sel saat menulis rumus untuk menyisipkan alamat, mode Tunjuk dengan panah, sorotan warna referensi, saran fungsi + petunjuk argumen, isi otomatis (fill handle, Ctrl+D), salin/tempel dengan referensi relatif, urungkan/ulangi, bilah status Jumlah/Rata-rata/Hitung.

## Lisensi pihak ketiga

HyperFormula dipakai dengan lisensi **GPLv3** (`licenseKey: "gpl-v3"`). Jika repo ini dipublikasikan, ikuti GPLv3, atau ganti ke formula.js (MIT) yang fungsinya lebih sedikit.

## Sebelum rilis

- Cek ulang batas free tier Supabase, Vercel, dan Gemini di halaman resmi.
- Supabase Free menjeda proyek setelah 7 hari tidak aktif, dan tidak punya backup harian. Ekspor CSV/pg_dump tiap minggu.
- Gerbang Tahap 1 BRD: 300 soal tervalidasi. Bank bawaan saat ini 146 soal.
