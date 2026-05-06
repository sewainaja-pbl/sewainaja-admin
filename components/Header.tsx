import { Search, Bell } from 'lucide-react';

const Header = () => {
  return (
    <header className="flex justify-between items-center py-5 mb-6">
      <div className="relative flex items-center w-[320px]">
        <Search size={18} strokeWidth={2} className="absolute left-4 text-text-tertiary" />
        <input 
          type="text" 
          placeholder="Search..." 
          className="w-full py-3 pr-4 pl-11 rounded-full border-none bg-surface shadow-[var(--shadow-soft)] focus:shadow-[var(--shadow-hover)] font-inherit text-[14px] outline-none transition-shadow duration-200 placeholder:text-text-tertiary" 
        />
      </div>
      
      <div className="flex items-center gap-6">
        <button className="relative w-11 h-11 rounded-full bg-surface shadow-[var(--shadow-soft)] flex items-center justify-center text-text-secondary">
          <Bell size={20} strokeWidth={2} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full text-[0px]">4</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-accent-gold text-white flex items-center justify-center font-semibold text-[14px]">
            <span>AD</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.5px]">System Admin</span>
            <span className="text-[14px] font-semibold text-text-primary">Admin SewainAja</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
