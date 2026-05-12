"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Users, MessageSquareWarning, Settings, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Helper to check if the path is active
  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="fixed left-6 top-5 z-[100] hidden lg:flex flex-col justify-between items-start w-[72px] h-[calc(100vh-40px)] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:w-[180px] group">
      {/* Top Navigation Pill */}
      <nav className="bg-surface rounded-[36px] p-2.5 flex flex-col gap-2 shadow-[var(--shadow-soft)] w-full">
        <div className="flex items-center justify-center pt-2 pb-2 mb-2">
          <Image src="/logo.svg" alt="SewainAja Logo" width={32} height={32} className="object-contain shrink-0" />
        </div>
        <Link 
          href="/dashboard" 
          className={`w-full h-[52px] flex items-center justify-start px-[14px] rounded-[26px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap ${isActive('/dashboard') ? 'bg-primary !text-[#FFFFFF] shadow-[0_4px_12px_rgba(1,45,29,0.2)]' : 'text-text-tertiary bg-transparent hover:text-primary hover:bg-background'}`} 
          title="Dashboard"
        >
          <div className="flex items-center justify-center shrink-0">
            <LayoutGrid size={22} strokeWidth={2} />
          </div>
          <span className="ml-4 text-[14px] font-medium opacity-0 transition-opacity duration-200 ease-in pointer-events-none group-hover:opacity-100 group-hover:delay-100">Dashboard</span>
        </Link>
        <Link 
          href="/dashboard/users" 
          className={`w-full h-[52px] flex items-center justify-start px-[14px] rounded-[26px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap ${isActive('/dashboard/users') ? 'bg-primary !text-[#FFFFFF] shadow-[0_4px_12px_rgba(1,45,29,0.2)]' : 'text-text-tertiary bg-transparent hover:text-primary hover:bg-background'}`} 
          title="Users"
        >
          <div className="flex items-center justify-center shrink-0">
            <Users size={22} strokeWidth={2} />
          </div>
          <span className="ml-4 text-[14px] font-medium opacity-0 transition-opacity duration-200 ease-in pointer-events-none group-hover:opacity-100 group-hover:delay-100">Users</span>
        </Link>
        <Link 
          href="/dashboard/disputes" 
          className={`w-full h-[52px] flex items-center justify-start px-[14px] rounded-[26px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap ${isActive('/dashboard/disputes') ? 'bg-primary !text-[#FFFFFF] shadow-[0_4px_12px_rgba(1,45,29,0.2)]' : 'text-text-tertiary bg-transparent hover:text-primary hover:bg-background'}`} 
          title="Disputes"
        >
          <div className="flex items-center justify-center shrink-0">
            <MessageSquareWarning size={22} strokeWidth={2} />
          </div>
          <span className="ml-4 text-[14px] font-medium opacity-0 transition-opacity duration-200 ease-in pointer-events-none group-hover:opacity-100 group-hover:delay-100">Disputes</span>
        </Link>
      </nav>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col gap-4 w-full">
        <button 
          className="w-full h-[56px] rounded-[28px] bg-surface text-text-tertiary flex items-center justify-start px-6 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap hover:text-primary hover:shadow-hover hover:-translate-y-0.5 border border-border-color/30" 
          title="Settings"
        >
          <div className="min-w-[24px] flex justify-center">
            <Settings size={20} strokeWidth={2} />
          </div>
          <span className="ml-4 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Settings</span>
        </button>

        <button 
          onClick={handleLogout}
          className="w-full h-[56px] rounded-[28px] bg-surface text-text-tertiary flex items-center justify-start px-6 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap hover:text-status-error hover:shadow-hover hover:-translate-y-0.5 border border-border-color/30" 
          title="Logout"
        >
          <div className="min-w-[24px] flex justify-center">
            <LogOut size={20} strokeWidth={2} />
          </div>
          <span className="ml-4 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
