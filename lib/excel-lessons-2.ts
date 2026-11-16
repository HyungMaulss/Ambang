// Topik lanjutan Excel Lab. Aturan sama dengan excel-lessons.ts: nilai harapan dihitung dari `solution`.
import type { Lesson } from "./excel-lessons.ts";

const rows = (cells: string[], f: (r: string) => string) => cells.map((cell) => ({ cell, solution: f(cell.slice(1)) }));

export const MORE: Lesson[] = [
  {
    slug: "absolut",
    title: "Referensi absolut & pembulatan",
    topic: "Dasar",
    summary: "Tanda $ dan ROUND untuk persentase.",
    body: [
      "Saat rumus disalin ke bawah, referensi biasa ikut bergeser. Tanda $ menguncinya: $B$5 tetap menunjuk B5 di baris mana pun.",
      "ROUND(angka; digit) membulatkan hasil, misalnya ROUND(44,444; 1) menjadi 44,4. Pembulatan membuat laporan rapi dan konsisten.",
    ],
    examples: [
      { f: "=B2/$B$5", note: "porsi terhadap total yang dikunci" },
      { f: "=ROUND(B2/$B$5*100;1)", note: "persen, satu desimal" },
      { f: "=ROUNDUP(A2;0)", note: "selalu bulat ke atas" },
    ],
    exercise: {
      id: "absolut-1",
      prompt: "Isi C2:C4 dengan persentase anggaran tiap unit terhadap total di B5, dibulatkan 1 desimal (contoh 44,4).",
      grid: [
        ["Unit", "Anggaran", "Persen"],
        ["Sekretariat", "120000000", ""],
        ["Keuangan", "80000000", ""],
        ["Umum", "70000000", ""],
        ["Total", "=SUM(B2:B4)", ""],
      ],
      targets: rows(["C2", "C3", "C4"], (r) => `=ROUND(B${r}/$B$5*100,1)`),
      required: ["ROUND"],
      hints: ["Bagi anggaran dengan total yang dikunci $B$5, kali 100, lalu bulatkan.", "C2: =ROUND(B2/$B$5*100;1)"],
    },
  },
  {
    slug: "ifs",
    title: "Kondisi bertingkat: IFS",
    topic: "Logika",
    summary: "Predikat nilai tanpa IF bersarang.",
    body: [
      "IFS(syarat1; hasil1; syarat2; hasil2; …) memeriksa syarat berurutan dan mengembalikan hasil dari syarat pertama yang benar. Lebih mudah dibaca daripada IF di dalam IF.",
      "Tulis syarat dari yang paling ketat, lalu akhiri dengan TRUE sebagai “selain itu”.",
    ],
    examples: [
      { f: '=IFS(B2>=85;"A";B2>=70;"B";TRUE;"C")', note: "tiga predikat" },
      { f: '=IF(B2>=85;"A";IF(B2>=70;"B";"C"))', note: "versi IF bersarang" },
      { f: '=SWITCH(C2;"L";"Laki-laki";"P";"Perempuan")', note: "padanan kode" },
    ],
    exercise: {
      id: "ifs-1",
      prompt: "Isi C2:C5: A bila nilai ≥ 85, B bila ≥ 70, C bila ≥ 55, selain itu D. Wajib memakai IFS.",
      grid: [
        ["Nama", "Nilai", "Predikat"],
        ["Ayu", "91", ""],
        ["Bima", "76", ""],
        ["Citra", "58", ""],
        ["Dodi", "43", ""],
      ],
      targets: rows(["C2", "C3", "C4", "C5"], (r) => `=IFS(B${r}>=85,"A",B${r}>=70,"B",B${r}>=55,"C",TRUE,"D")`),
      required: ["IFS"],
      hints: ["Urutkan syarat dari nilai tertinggi, akhiri dengan TRUE.", '=IFS(B2>=85;"A";B2>=70;"B";B2>=55;"C";TRUE;"D")'],
    },
  },
  {
    slug: "iferror",
    title: "Menangani error: IFERROR",
    topic: "Lookup",
    summary: "Ganti #N/A dengan pesan yang jelas.",
    body: [
      "Lookup yang tidak menemukan data menghasilkan #N/A. IFERROR(rumus; pengganti) menampilkan nilai pengganti bila rumus error.",
      "Pakai pesan yang menjelaskan, misalnya “Tidak ada”, bukan menyembunyikan error dengan sel kosong.",
    ],
    examples: [
      { f: '=IFERROR(VLOOKUP(D2;A2:B4;2;FALSE);"Tidak ada")', note: "lookup aman" },
      { f: "=IFERROR(B2/C2;0)", note: "hindari #DIV/0!" },
      { f: '=XLOOKUP(D2;A2:A4;B2:B4;"Tidak ada")', note: "XLOOKUP punya argumen pengganti" },
    ],
    exercise: {
      id: "iferror-1",
      prompt: "Isi E2:E3 dengan tarif sesuai kode di D2:D3. Bila kode tidak ada, tampilkan “Tidak ada”. Wajib memakai IFERROR dan VLOOKUP.",
      grid: [
        ["Kode", "Tarif", "", "Kode dicari", "Tarif"],
        ["PNBP-01", "50000", "", "PNBP-02", ""],
        ["PNBP-02", "75000", "", "PNBP-09", ""],
        ["PNBP-03", "120000", "", "", ""],
      ],
      targets: rows(["E2", "E3"], (r) => `=IFERROR(VLOOKUP(D${r},A2:B4,2,FALSE),"Tidak ada")`),
      required: ["IFERROR", "VLOOKUP"],
      hints: ["Bungkus VLOOKUP dengan IFERROR.", '=IFERROR(VLOOKUP(D2;A2:B4;2;FALSE);"Tidak ada")'],
    },
  },
  {
    slug: "index-match",
    title: "INDEX + MATCH: cari ke kiri",
    topic: "Lookup",
    summary: "Ambil kolom di kiri kolom pencarian.",
    body: [
      "VLOOKUP hanya bisa mengambil kolom di sebelah kanan kolom pencarian. MATCH(nilai; kolom; 0) mencari posisi baris, lalu INDEX(kolom_hasil; posisi) mengambil nilainya dari kolom mana pun.",
      "Angka 0 pada MATCH berarti harus cocok persis.",
    ],
    examples: [
      { f: "=MATCH(E2;B2:B4;0)", note: "posisi nama di daftar" },
      { f: "=INDEX(A2:A4;MATCH(E2;B2:B4;0))", note: "ambil NIP di kiri" },
      { f: "=INDEX(A2:C4;2;3)", note: "baris 2, kolom 3" },
    ],
    exercise: {
      id: "index-match-1",
      prompt: "Isi F2:F3 dengan NIP pegawai sesuai nama di E2:E3. Kolom NIP ada di kiri kolom nama, jadi pakai INDEX dan MATCH.",
      grid: [
        ["NIP", "Nama", "Jabatan", "", "Cari nama", "NIP"],
        ["'198701012010011001", "Sari", "Analis", "", "Wulan", ""],
        ["'199002022015021002", "Tono", "Pranata Komputer", "", "Tono", ""],
        ["'199203032019031003", "Wulan", "Arsiparis", "", "", ""],
      ],
      targets: rows(["F2", "F3"], (r) => `=INDEX(A2:A4,MATCH(E${r},B2:B4,0))`),
      required: ["INDEX", "MATCH"],
      hints: ["MATCH mencari nama di kolom B, INDEX mengambil dari kolom A.", "=INDEX(A2:A4;MATCH(E2;B2:B4;0))"],
    },
  },
  {
    slug: "teks-rapi",
    title: "Merapikan teks: TRIM, UPPER, SUBSTITUTE",
    topic: "Teks",
    summary: "Bersihkan kode yang diketik tidak seragam.",
    body: [
      "Data ketikan manual sering berisi spasi berlebih dan huruf campur. TRIM membuang spasi di awal, di akhir, dan spasi ganda; UPPER mengubah ke huruf kapital.",
      "SUBSTITUTE(teks; lama; baru) mengganti karakter, misalnya spasi menjadi tanda hubung. LEN menghitung jumlah karakter untuk memeriksa hasilnya.",
    ],
    examples: [
      { f: "=TRIM(A2)", note: "buang spasi berlebih" },
      { f: '=SUBSTITUTE(UPPER(TRIM(A2));" ";"-")', note: "rumus bertingkat" },
      { f: "=LEN(B2)", note: "jumlah karakter" },
    ],
    exercise: {
      id: "teks-rapi-1",
      prompt: "B2:B3 = kode rapi: tanpa spasi berlebih, huruf kapital, spasi diganti “-” (contoh ATK-001). C2:C3 = jumlah karakter kode rapi.",
      grid: [
        ["Kode mentah", "Kode rapi", "Panjang"],
        ["  atk 001 ", "", ""],
        ["kbr 012  ", "", ""],
      ],
      targets: [...rows(["B2", "B3"], (r) => `=SUBSTITUTE(UPPER(TRIM(A${r}))," ","-")`), ...rows(["C2", "C3"], (r) => `=LEN(B${r})`)],
      required: ["TRIM", "SUBSTITUTE"],
      hints: ["Kerjakan dari dalam: TRIM, lalu UPPER, lalu SUBSTITUTE.", 'B2: =SUBSTITUTE(UPPER(TRIM(A2));" ";"-") · C2: =LEN(B2)'],
    },
  },
  {
    slug: "hari-kerja",
    title: "Hari kerja & jatuh tempo",
    topic: "Tanggal",
    summary: "NETWORKDAYS dan EDATE untuk jadwal kantor.",
    body: [
      "NETWORKDAYS(mulai; selesai) menghitung hari kerja Senin–Jumat, termasuk tanggal mulai dan selesai. Daftar hari libur bisa ditambahkan sebagai argumen ketiga.",
      "EDATE(tanggal; bulan) menggeser tanggal beberapa bulan, cocok untuk jatuh tempo atau masa berlaku.",
    ],
    examples: [
      { f: "=NETWORKDAYS(A2;B2)", note: "hari kerja" },
      { f: "=EDATE(A2;3)", note: "tiga bulan kemudian" },
      { f: "=WEEKDAY(A2;2)", note: "1 = Senin … 7 = Minggu" },
    ],
    exercise: {
      id: "hari-kerja-1",
      prompt: "C2:C3 = jumlah hari kerja antara Mulai dan Selesai. D2:D3 = jatuh tempo tiga bulan setelah tanggal Mulai.",
      grid: [
        ["Mulai", "Selesai", "Hari kerja", "Jatuh tempo"],
        ["=DATE(2026,11,2)", "=DATE(2026,11,13)", "", ""],
        ["=DATE(2026,12,1)", "=DATE(2026,12,31)", "", ""],
      ],
      targets: [...rows(["C2", "C3"], (r) => `=NETWORKDAYS(A${r},B${r})`), ...rows(["D2", "D3"], (r) => `=EDATE(A${r},3)`)],
      required: ["NETWORKDAYS", "EDATE"],
      dateCells: ["A2", "A3", "B2", "B3", "D2", "D3"],
      hints: ["Hari kerja = NETWORKDAYS, jatuh tempo = EDATE.", "C2: =NETWORKDAYS(A2;B2) · D2: =EDATE(A2;3)"],
    },
  },
  {
    slug: "countifs",
    title: "COUNTIFS & AVERAGEIF",
    topic: "Agregasi",
    summary: "Rekap dengan beberapa syarat sekaligus.",
    body: [
      "COUNTIFS menghitung baris yang memenuhi semua syarat, misalnya unit Keuangan DAN status Lulus. Argumennya selalu berpasangan: rentang lalu syarat.",
      "AVERAGEIF(rentang_syarat; syarat; rentang_rata) menghitung rata-rata hanya untuk baris yang cocok.",
    ],
    examples: [
      { f: '=COUNTIFS(A2:A6;"Keuangan";B2:B6;"Lulus")', note: "dua syarat" },
      { f: '=AVERAGEIF(A2:A6;"Umum";C2:C6)', note: "rata-rata bersyarat" },
      { f: '=COUNTIF(C2:C6;">=80")', note: "syarat angka ditulis dalam tanda kutip" },
    ],
    exercise: {
      id: "countifs-1",
      prompt: "Untuk unit di E2:E3: F = jumlah pegawai berstatus Lulus, G = rata-rata nilai semua pegawai unit itu, dibulatkan 1 desimal.",
      grid: [
        ["Unit", "Status", "Nilai", "", "Unit", "Lulus", "Rata-rata"],
        ["Keuangan", "Lulus", "88", "", "Keuangan", "", ""],
        ["Umum", "Lulus", "79", "", "Umum", "", ""],
        ["Keuangan", "Tidak", "61", "", "", "", ""],
        ["Umum", "Lulus", "92", "", "", "", ""],
        ["Keuangan", "Lulus", "84", "", "", "", ""],
      ],
      targets: [
        ...rows(["F2", "F3"], (r) => `=COUNTIFS(A2:A6,E${r},B2:B6,"Lulus")`),
        ...rows(["G2", "G3"], (r) => `=ROUND(AVERAGEIF(A2:A6,E${r},C2:C6),1)`),
      ],
      required: ["COUNTIFS", "AVERAGEIF"],
      hints: ["Lulus = COUNTIFS dengan dua syarat; rata-rata = AVERAGEIF dibungkus ROUND.", 'F2: =COUNTIFS(A2:A6;E2;B2:B6;"Lulus") · G2: =ROUND(AVERAGEIF(A2:A6;E2;C2:C6);1)'],
    },
  },
  {
    slug: "peringkat",
    title: "Statistik & peringkat",
    topic: "Agregasi",
    summary: "Peringkat, nilai tertinggi ke-n, dan median.",
    body: [
      "Peringkat bisa dihitung tanpa fungsi khusus: banyaknya skor yang lebih tinggi ditambah satu, yaitu COUNTIF(rentang; \">\"&B2)+1. Operator & menggabungkan teks \">\" dengan nilai sel.",
      "LARGE(rentang; k) mengambil nilai terbesar ke-k, SMALL sebaliknya. MEDIAN mengambil nilai tengah dan lebih tahan terhadap nilai ekstrem dibanding rata-rata.",
    ],
    examples: [
      { f: '=COUNTIF($B$2:$B$6;">"&B2)+1', note: "peringkat" },
      { f: "=LARGE(B2:B6;2)", note: "tertinggi ke-2" },
      { f: "=MEDIAN(B2:B6)", note: "nilai tengah" },
    ],
    exercise: {
      id: "peringkat-1",
      prompt: "C2:C6 = peringkat skor (1 = tertinggi). F2 = skor tertinggi ke-2. F3 = median skor.",
      grid: [
        ["Nama", "Skor SKD", "Peringkat", "", "Ringkasan", "Nilai"],
        ["Ayu", "410", "", "", "Tertinggi ke-2", ""],
        ["Bima", "455", "", "", "Median", ""],
        ["Citra", "398", "", "", "", ""],
        ["Dodi", "430", "", "", "", ""],
        ["Eka", "372", "", "", "", ""],
      ],
      targets: [
        ...rows(["C2", "C3", "C4", "C5", "C6"], (r) => `=COUNTIF($B$2:$B$6,">"&B${r})+1`),
        { cell: "F2", solution: "=LARGE(B2:B6,2)" },
        { cell: "F3", solution: "=MEDIAN(B2:B6)" },
      ],
      required: ["COUNTIF", "LARGE"],
      hints: ["Peringkat = banyaknya skor yang lebih tinggi + 1.", 'C2: =COUNTIF($B$2:$B$6;">"&B2)+1 · F2: =LARGE(B2:B6;2) · F3: =MEDIAN(B2:B6)'],
    },
  },
  {
    slug: "sumproduct",
    title: "SUMPRODUCT & MAXIFS",
    topic: "Agregasi",
    summary: "Total belanja dalam satu rumus.",
    body: [
      "SUMPRODUCT(harga; jumlah) mengalikan pasangan baris lalu menjumlahkannya, jadi kolom bantu Harga × Jumlah tidak diperlukan.",
      "MAXIFS dan MINIFS mencari nilai terbesar atau terkecil yang memenuhi syarat, misalnya harga termahal dalam kategori ATK.",
    ],
    examples: [
      { f: "=SUMPRODUCT(C2:C6;D2:D6)", note: "total belanja" },
      { f: '=MAXIFS(C2:C6;B2:B6;"ATK")', note: "termahal di satu kategori" },
      { f: '=MINIFS(C2:C6;B2:B6;"Mebel")', note: "termurah di satu kategori" },
    ],
    exercise: {
      id: "sumproduct-1",
      prompt: "F2 = total belanja (harga × jumlah untuk semua barang). F3 = harga satuan termahal di kategori ATK.",
      grid: [
        ["Barang", "Kategori", "Harga", "Jumlah", "Ringkasan", "Nilai"],
        ["Kertas", "ATK", "55000", "10", "Total belanja", ""],
        ["Tinta", "ATK", "120000", "4", "Termahal ATK", ""],
        ["Kursi", "Mebel", "750000", "2", "", ""],
        ["Meja", "Mebel", "1250000", "1", "", ""],
        ["Stapler", "ATK", "35000", "6", "", ""],
      ],
      targets: [
        { cell: "F2", solution: "=SUMPRODUCT(C2:C6,D2:D6)" },
        { cell: "F3", solution: '=MAXIFS(C2:C6,B2:B6,"ATK")' },
      ],
      required: ["SUMPRODUCT", "MAXIFS"],
      hints: ["Total belanja = SUMPRODUCT kolom harga dan jumlah.", 'F2: =SUMPRODUCT(C2:C6;D2:D6) · F3: =MAXIFS(C2:C6;B2:B6;"ATK")'],
    },
  },
];
