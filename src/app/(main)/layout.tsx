import Header from '@/components/ui/Header';
import Footer from '@/components/ui/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* pt-16 is moved here so it only pushes content down when the Header is present */}
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </>
  );
}