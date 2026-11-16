import { Tip } from "./ui";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 text-[14px] text-muted md:flex-row md:items-center md:justify-between md:px-10 md:py-7 xl:px-20">
        <p>
          © 2026 Ambang · Dibuat oleh{" "}
          <Tip label="Buka profil LinkedIn pembuat">
            <a
              href="https://www.linkedin.com/in/tegarmaulana/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fg underline underline-offset-2 transition-colors hover:text-accent-ink"
            >
              Tegar Maulana
            </a>
          </Tip>
        </p>
        <p>Tidak berafiliasi dengan BKN atau KemenPANRB. Soal unggahan pengguna tetap milik pengunggahnya.</p>
      </div>
    </footer>
  );
}
