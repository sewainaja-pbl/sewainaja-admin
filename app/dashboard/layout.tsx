import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AuthGuard from '@/components/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 lg:ml-[110px] sm:ml-0 p-4 sm:p-6 lg:pr-10 lg:pb-10 flex flex-col min-w-0">
          <Header />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
