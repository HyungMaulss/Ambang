// Materi Excel Lab (F1). Statis agar halaman cepat; skor dihitung dari rumus `solution`
// pada data yang sama, jadi tidak ada nilai harapan yang ditulis manual.
// Hanya fungsi yang didukung HyperFormula (AVERAGEIFS tidak didukung — jangan dipakai).

export type Exercise = {
  id: string;
  prompt: string;
  grid: string[][]; // baris 1 = judul kolom. Awali "'" untuk teks angka (mis. NIP).
  targets: { cell: string; solution: string }[];
  required: string[];
  hints: [string, string];
  dateCells?: string[];
};
export type Lesson = { slug: string; title: string; topic: string; summary: string; body: string[]; examples: { f: string; note: string }[]; exercise: Exercise };

export const LESSONS: Lesson[] = [
  {
    slug: "dasar",
    title: "Dasar rumus & referensi",
    topic: "Dasar",
    summary: "Operator, SUM, dan referensi sel.",
    body: [
      "Setiap rumus diawali tanda sama dengan (=). Rumus merujuk sel lewat alamatnya, misalnya B2, sehingga hasil ikut berubah saat isi sel berubah.",
      "Rentang ditulis dengan titik dua: B2:B4 berarti B2 sampai B4. Tanda $ mengunci referensi saat rumus disalin, misalnya $B$1.",
    ],
    examples: [
      { f: "=B2*C2", note: "kalikan harga dengan jumlah" },
      { f: "=SUM(D2:D4)", note: "jumlahkan rentang" },
      { f: "=B2*$F$1", note: "F1 tetap terkunci saat disalin" },
    ],
    exercise: {
      id: "dasar-1",
      prompt: "Isi kolom Total (D2:D4) dengan Harga × Jumlah, lalu D5 dengan jumlah semua total.",
      grid: [
        ["Barang", "Harga", "Jumlah", "Total"],
        ["Pulpen", "3500", "12", ""],
        ["Map", "2000", "25", ""],
        ["Kertas A4", "55000", "3", ""],
        ["", "", "Total semua", ""],
      ],
      targets: [
        { cell: "D2", solution: "=B2*C2" },
        { cell: "D3", solution: "=B3*C3" },
        { cell: "D4", solution: "=B4*C4" },
        { cell: "D5", solution: "=SUM(D2:D4)" },
      ],
      required: ["SUM"],
      hints: ["Total per baris memakai operator *, total semua memakai SUM.", "D2: =B2*C2 · D5: =SUM(D2:...)"],
    },
  },
  {
    slug: "logika",
    title: "Logika: IF, AND, OR",
    topic: "Logika",
    summary: "Mengambil keputusan dari syarat.",
    body: [
      "IF(syarat; jika_benar; jika_salah) mengembalikan satu dari dua nilai. AND benar bila semua syarat benar; OR benar bila salah satu benar.",
      "Teks di dalam rumus ditulis dengan tanda kutip ganda, misalnya \"Lulus\".",
    ],
    examples: [
      { f: '=IF(B2>=65;"Lulus";"Tidak")', note: "satu syarat" },
      { f: '=IF(AND(B2>=65;C2>=80);"Lulus";"Tidak")', note: "dua syarat sekaligus" },
      { f: '=IF(OR(B2="";C2="");"Belum";"Lengkap")', note: "salah satu kosong" },
    ],
    exercise: {
      id: "logika-1",
      prompt: "Status (D2:D4) bernilai \"Lulus\" bila TWK ≥ 65 DAN TIU ≥ 80, selain itu \"Tidak\".",
      grid: [
        ["Nama", "TWK", "TIU", "Status"],
        ["Rani", "70", "85", ""],
        ["Bagus", "60", "95", ""],
        ["Sinta", "65", "79", ""],
      ],
      targets: [
        { cell: "D2", solution: '=IF(AND(B2>=65,C2>=80),"Lulus","Tidak")' },
        { cell: "D3", solution: '=IF(AND(B3>=65,C3>=80),"Lulus","Tidak")' },
        { cell: "D4", solution: '=IF(AND(B4>=65,C4>=80),"Lulus","Tidak")' },
      ],
      required: ["IF", "AND"],
      hints: ["Gabungkan IF dengan AND.", '=IF(AND(B2>=65;C2>=80);"Lulus";"Tidak")'],
    },
  },
  {
    slug: "lookup",
    title: "Lookup: XLOOKUP, VLOOKUP, INDEX-MATCH",
    topic: "Lookup",
    summary: "Mencari data dari tabel lain.",
    body: [
      "XLOOKUP(nilai_cari; kolom_cari; kolom_hasil) mencari nilai di satu kolom lalu mengambil pasangannya di kolom lain. Lebih aman daripada VLOOKUP karena tidak bergantung nomor kolom.",
      "VLOOKUP(nilai; tabel; nomor_kolom; FALSE) masih banyak dipakai di kantor. FALSE berarti harus cocok persis. INDEX-MATCH adalah alternatif untuk Excel lama.",
    ],
    examples: [
      { f: "=XLOOKUP(E2;A2:A5;B2:B5)", note: "cari kode, ambil nama" },
      { f: "=VLOOKUP(E2;A2:C5;3;FALSE)", note: "ambil kolom ke-3" },
      { f: "=INDEX(C2:C5;MATCH(E2;A2:A5;0))", note: "versi INDEX-MATCH" },
    ],
    exercise: {
      id: "lookup-1",
      prompt: "Isi F2 dan F3 dengan nama barang sesuai kode di E2 dan E3, wajib memakai XLOOKUP.",
      grid: [
        ["Kode", "Nama", "Stok", "", "Cari kode", "Nama"],
        ["ATK-01", "Pulpen", "120", "", "ATK-03", ""],
        ["ATK-02", "Map", "45", "", "ATK-01", ""],
        ["ATK-03", "Stapler", "8", "", "", ""],
        ["ATK-04", "Tinta", "16", "", "", ""],
      ],
      targets: [
        { cell: "F2", solution: "=XLOOKUP(E2,A2:A5,B2:B5)" },
        { cell: "F3", solution: "=XLOOKUP(E3,A2:A5,B2:B5)" },
      ],
      required: ["XLOOKUP"],
      hints: ["Cari di kolom A, ambil hasil dari kolom B.", "=XLOOKUP(E2;A2:A5;B2:B5)"],
    },
  },
  {
    slug: "teks",
    title: "Fungsi teks",
    topic: "Teks",
    summary: "LEFT, MID, PROPER, dan menggabungkan teks.",
    body: [
      "LEFT(teks; n) mengambil n karakter dari kiri, MID(teks; mulai; n) dari tengah. PROPER membuat huruf awal tiap kata kapital.",
      "Gabungkan teks dengan & atau CONCATENATE. NIP PNS diawali 8 digit tanggal lahir (TTTTBBHH), jadi tahun lahir bisa diambil dengan LEFT.",
    ],
    examples: [
      { f: "=LEFT(A2;4)", note: "4 karakter pertama" },
      { f: "=MID(A2;5;2)", note: "karakter ke-5 dan ke-6" },
      { f: '=PROPER(B2)&" ("&LEFT(A2;4)&")"', note: "gabung teks" },
    ],
    exercise: {
      id: "teks-1",
      prompt: "C2:C3 = tahun lahir dari NIP (4 digit pertama). D2:D3 = nama dengan huruf awal kapital.",
      grid: [
        ["NIP", "Nama", "Tahun lahir", "Nama rapi"],
        ["'199503142020121001", "dewi lestari", "", ""],
        ["'198811022015031004", "ahmad FAUZI", "", ""],
      ],
      targets: [
        { cell: "C2", solution: "=LEFT(A2,4)" },
        { cell: "C3", solution: "=LEFT(A3,4)" },
        { cell: "D2", solution: "=PROPER(B2)" },
        { cell: "D3", solution: "=PROPER(B3)" },
      ],
      required: ["LEFT", "PROPER"],
      hints: ["Tahun lahir = LEFT, nama rapi = PROPER.", "C2: =LEFT(A2;4) · D2: =PROPER(B2)"],
    },
  },
  {
    slug: "tanggal",
    title: "Tanggal",
    topic: "Tanggal",
    summary: "DATE, YEAR, dan DATEDIF untuk masa kerja.",
    body: [
      "Excel menyimpan tanggal sebagai angka seri, jadi tanggal bisa dikurangkan. DATE(tahun; bulan; hari) membuat tanggal, YEAR/MONTH/DAY mengambil bagiannya.",
      "DATEDIF(awal; akhir; \"Y\") menghitung selisih tahun penuh, cocok untuk usia atau masa kerja. Latihan ini memakai tanggal acuan tetap agar hasilnya tidak berubah tiap hari.",
    ],
    examples: [
      { f: "=YEAR(A2)", note: "ambil tahun" },
      { f: '=DATEDIF(A2;DATE(2026;11;15);"Y")', note: "usia per 15 Nov 2026" },
      { f: "=A2+30", note: "30 hari setelah A2" },
    ],
    exercise: {
      id: "tanggal-1",
      prompt: "B2:B3 = tahun dari TMT. C2:C3 = masa kerja dalam tahun penuh per 15 November 2026.",
      grid: [
        ["TMT", "Tahun", "Masa kerja (th)"],
        ["=DATE(2015,3,1)", "", ""],
        ["=DATE(2020,12,1)", "", ""],
      ],
      targets: [
        { cell: "B2", solution: "=YEAR(A2)" },
        { cell: "B3", solution: "=YEAR(A3)" },
        { cell: "C2", solution: '=DATEDIF(A2,DATE(2026,11,15),"Y")' },
        { cell: "C3", solution: '=DATEDIF(A3,DATE(2026,11,15),"Y")' },
      ],
      required: ["YEAR", "DATEDIF"],
      dateCells: ["A2", "A3"],
      hints: ["Pakai YEAR untuk tahun dan DATEDIF dengan satuan \"Y\".", '=DATEDIF(A2;DATE(2026;11;15);"Y")'],
    },
  },
  {
    slug: "agregasi",
    title: "Agregasi bersyarat",
    topic: "Agregasi",
    summary: "COUNTIF, SUMIF, SUMIFS untuk rekap.",
    body: [
      "COUNTIF menghitung baris yang memenuhi syarat; SUMIF/SUMIFS menjumlahkan nilai yang memenuhi satu atau beberapa syarat.",
      "Urutan argumen SUMIFS: rentang_jumlah dulu, lalu pasangan rentang_syarat dan syarat.",
    ],
    examples: [
      { f: '=COUNTIF(A2:A7;"Keuangan")', note: "jumlah baris Keuangan" },
      { f: '=SUMIFS(C2:C7;A2:A7;"Keuangan")', note: "total jam Keuangan" },
      { f: '=SUMIFS(C2:C7;A2:A7;"Umum";C2:C7;">5")', note: "dua syarat" },
    ],
    exercise: {
      id: "agregasi-1",
      prompt: "Untuk unit di E2 dan E3, hitung jumlah pegawai (F) dan total jam lembur (G).",
      grid: [
        ["Unit", "Pegawai", "Jam lembur", "", "Unit", "Pegawai", "Total jam"],
        ["Keuangan", "Ayu", "6", "", "Keuangan", "", ""],
        ["Umum", "Bima", "4", "", "Umum", "", ""],
        ["Keuangan", "Citra", "9", "", "", "", ""],
        ["Umum", "Doni", "2", "", "", "", ""],
        ["Keuangan", "Eka", "3", "", "", "", ""],
        ["Umum", "Fajar", "7", "", "", "", ""],
      ],
      targets: [
        { cell: "F2", solution: "=COUNTIF(A2:A7,E2)" },
        { cell: "F3", solution: "=COUNTIF(A2:A7,E3)" },
        { cell: "G2", solution: "=SUMIFS(C2:C7,A2:A7,E2)" },
        { cell: "G3", solution: "=SUMIFS(C2:C7,A2:A7,E3)" },
      ],
      required: ["COUNTIF", "SUMIFS"],
      hints: ["Pegawai = COUNTIF, total jam = SUMIFS.", "F2: =COUNTIF(A2:A7;E2) · G2: =SUMIFS(C2:C7;A2:A7;E2)"],
    },
  },
];
