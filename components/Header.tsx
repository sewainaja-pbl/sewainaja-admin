"use client";

import { Search, Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="flex justify-between items-center py-4 sm:py-5 mb-4 sm:mb-6 gap-4">
      {/* Mobile Toggle & Search */}
      <div className="flex items-center gap-3 flex-1">
        <button 
          className="lg:hidden p-2 rounded-xl bg-surface shadow-[var(--shadow-soft)] text-text-primary"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu size={22} />
        </button>
        
        <div className="relative flex items-center w-full max-w-[320px]">
          <Search size={18} strokeWidth={2} className="absolute left-4 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full py-2.5 sm:py-3 pr-4 pl-11 rounded-full border-none bg-surface shadow-[var(--shadow-soft)] focus:shadow-[var(--shadow-hover)] font-inherit text-[13px] sm:text-[14px] outline-none transition-shadow duration-200 placeholder:text-text-tertiary" 
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-6">
        <button className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-surface shadow-[var(--shadow-soft)] flex items-center justify-center text-text-secondary hover:shadow-[var(--shadow-hover)] transition-shadow">
          <Bell size={20} strokeWidth={2} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full text-[0px]">4</span>
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-accent-gold text-white flex items-center justify-center font-semibold text-[13px] sm:text-[14px] shadow-[var(--shadow-soft)]">
            <span>AD</span>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.5px]">System Admin</span>
            <span className="text-[13px] sm:text-[14px] font-semibold text-text-primary">Admin SewainAja</span>
          </div>
        </div>
      </div>

      {/* Basic Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-[250px] bg-surface p-6 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-primary text-xl">SewainAja</span>
              <button onClick={() => setIsMobileMenuOpen(false)}><X size={24} /></button>
            </div>
            <nav className="flex flex-col gap-4">
              <Link href="/dashboard" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Dashboard</Link>
              <Link href="/dashboard/users" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard/users') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Users</Link>
              <Link href="/dashboard/disputes" className={`p-3 rounded-xl transition-colors ${isActive('/dashboard/disputes') ? 'bg-background font-medium text-primary' : 'hover:bg-background text-text-tertiary'}`}>Disputes</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
