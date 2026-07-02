import { ElementType } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ElementType;
  variant?: 'default' | 'dark';
}

const StatCard = ({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) => {
  const isDark = variant === 'dark';

  return (
    <div 
      className={`
        flex flex-col justify-between min-h-[140px] p-6 rounded-lg transition-all duration-300
        ${isDark 
          ? 'bg-primary text-surface shadow-[0_10px_25px_-5px_rgba(1,45,29,0.3)] hover:shadow-[0_15px_35px_-5px_rgba(1,45,29,0.4)]' 
          : 'bg-surface text-text-primary shadow-soft hover:shadow-hover border border-border-color/50'
        }
        hover:-translate-y-1
      `}
    >
      <div className="flex justify-between items-start">
        <h3 className={`text-[14px] font-medium ${isDark ? 'text-white/80' : 'text-text-secondary'}`}>
          {title}
        </h3>
        {Icon && (
          <div className={`
            w-9 h-9 rounded-xl flex items-center justify-center transition-colors
            ${isDark ? 'bg-white/10 text-white' : 'bg-background text-text-secondary group-hover:bg-primary/5 group-hover:text-primary'}
          `}>
            <Icon size={18} strokeWidth={2.5} />
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <div className={`text-[32px] font-bold leading-none tracking-tight ${isDark ? 'text-white' : 'text-text-primary'}`}>
          {value}
        </div>
        {subtitle && (
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-status-success shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-status-error opacity-60'}`}></span>
            <p className={`text-[12px] font-medium ${isDark ? 'text-white/70' : 'text-text-tertiary'}`}>
              {subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
