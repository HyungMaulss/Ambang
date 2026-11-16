// template.tsx dipasang ulang setiap navigasi, jadi animasi masuk berjalan per halaman.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
