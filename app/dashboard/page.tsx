import StatCard from '@/components/StatCard';
import { Users, Clock, AlertTriangle, RefreshCw, ChevronDown, MoreHorizontal, ChevronRight } from 'lucide-react';

export default function Home() {
  const stats = [
    { title: 'Total Users', value: '1,248', subtitle: '+12% this month', icon: Users, variant: 'dark' },
    { title: 'Pending Approvals', value: '23', subtitle: 'Requires attention', icon: Clock, variant: 'default' },
    { title: 'Open Disputes', value: '4', subtitle: '2 overdue', icon: AlertTriangle, variant: 'default' },
    { title: 'Active Rentals', value: '82%', subtitle: 'Optimal workload', icon: RefreshCw, variant: 'default' },
  ];

  const tasks = [
    { title: 'Review KTP for Budi Santoso', subtitle: 'ID Verification • 1h ago', status: 'error' },
    { title: 'Resolve dispute TRX-9884', subtitle: 'Mediation • 2h ago', status: 'primary' },
    { title: 'Update system config', subtitle: 'Maintenance • 4h ago', status: 'success' },
    { title: 'Weekly report generation', subtitle: 'Automated • 12h ago', status: 'primary' },
  ];

  const getTaskStatusClass = (status: string) => {
    if (status === 'error') return 'bg-status-error';
    if (status === 'primary') return 'bg-primary';
    if (status === 'success') return 'bg-status-success';
    return '';
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end mb-2">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Hello, Admin! 👋</h1>
          <p className="text-[14px] text-text-secondary m-0">Welcome back! Here&apos;s your platform overview.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="px-4 py-2.5 bg-surface rounded-full text-[13px] font-medium text-text-secondary shadow-[var(--shadow-soft)] flex items-center gap-2">
            May 01 - May 31
            <ChevronDown size={14} />
          </div>
          <button className="px-5 py-2.5 bg-primary text-white rounded-full text-[13px] font-medium shadow-[0_4px_12px_rgba(1,45,29,0.2)] hover:bg-primary-hover transition-colors">Export report</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <StatCard key={i} title={stat.title} value={stat.value} subtitle={stat.subtitle} icon={stat.icon} variant={stat.variant as any} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-auto gap-5">
        {/* Pulse / Circular Chart Widget */}
        <div className="col-span-1 md:col-span-6 lg:col-span-3 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Rental Pulse</h3>
            <MoreHorizontal size={20} className="text-text-tertiary cursor-pointer" />
          </div>
          <div className="flex-1 flex justify-center items-center py-8">
            <div className="w-[180px] h-[180px] rounded-full bg-[conic-gradient(var(--color-primary)_0%_68%,#D1E68C_68%_88%,var(--color-background)_88%_100%)] flex items-center justify-center transition-all duration-300">
              <div className="w-[130px] h-[130px] bg-surface rounded-full flex flex-col items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)]">
                <span className="text-[36px] font-bold text-primary leading-none">98</span>
                <span className="text-[12px] text-text-tertiary">active</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-auto pt-4 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--color-primary)'}}></span> Active</div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: '#D1E68C'}}></span> Completed</div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--color-background)'}}></span> Cancelled</div>
          </div>
        </div>

        {/* Tasks List Widget */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Pending Actions</h3>
            <button className="text-[12px] font-medium text-text-secondary flex items-center gap-1">See All <ChevronRight size={14} /></button>
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${getTaskStatusClass(task.status)}`}></div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-text-primary m-0 mb-1">{task.title}</p>
                  <p className="text-[11px] text-text-tertiary m-0">{task.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto bg-accent-green-pale rounded-[var(--radius-md)] p-4">
            <span className="inline-block px-2.5 py-1 bg-primary text-white rounded-full text-[10px] font-semibold mb-3">Urgent Review</span>
            <p className="text-[14px] font-semibold text-primary m-0 mb-1">Dispute Escallation</p>
            <p className="text-[11px] text-text-secondary m-0 mb-4">Renter vs Owner Dispute TRX-9884</p>
            <div className="h-1 bg-black/5 rounded-sm overflow-hidden">
              <div className="h-full bg-primary rounded-sm" style={{ width: '68%' }}></div>
            </div>
          </div>
        </div>

        {/* Large Performance Chart Widget */}
        <div className="col-span-1 md:col-span-12 lg:col-span-5 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Traffic Pengguna</h3>
              <p className="text-[12px] text-text-tertiary mt-1 mb-0">Active visitors this week</p>
            </div>
            <div className="flex bg-background p-1 rounded-full">
              <span className="px-4 py-1.5 text-[11px] font-medium rounded-full cursor-pointer bg-primary text-white">Weekly</span>
              <span className="px-4 py-1.5 text-[11px] font-medium text-text-secondary rounded-full cursor-pointer hover:bg-white/50">Monthly</span>
              <span className="px-4 py-1.5 text-[11px] font-medium text-text-secondary rounded-full cursor-pointer hover:bg-white/50">Annually</span>
            </div>
          </div>
          <div className="flex-1 relative min-h-[220px] bg-[linear-gradient(180deg,rgba(209,230,140,0.2)_0%,rgba(255,255,255,0)_100%)] rounded-[var(--radius-md)] mt-4 overflow-hidden">
            <div className="absolute top-[40%] left-0 w-full h-[2px] bg-primary-light/30 before:absolute before:-top-5 before:left-[10%] before:w-[40%] before:h-10 before:border-2 before:border-primary-light/30 before:border-b-0 before:rounded-t-[100px] after:absolute after:top-0 after:left-[50%] after:w-[40%] after:h-10 after:border-2 after:border-primary-light/30 after:border-t-0 after:rounded-b-[100px]"></div>
            <div className="absolute top-[calc(40%-20px)] left-[30%] w-3 h-3 bg-surface border-2 border-primary rounded-full shadow-[0_0_0_4px_rgba(1,45,29,0.1)]">
              <div className="absolute -top-[45px] left-1/2 -translate-x-1/2 bg-surface px-3 py-1.5 rounded-lg text-[11px] font-semibold shadow-[var(--shadow-hover)] whitespace-nowrap text-center text-text-primary">2.4k visitors<br/><span className="font-normal text-text-tertiary text-[10px]">Thursday</span></div>
            </div>
          </div>
        </div>

        {/* Recent Activity / Users Widget */}
        <div className="col-span-1 md:col-span-12 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Recent Users</h3>
              <p className="text-[12px] text-text-tertiary mt-1 mb-0">4 active</p>
            </div>
            <button className="text-[12px] font-medium text-text-secondary flex items-center gap-1">All Users <ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center p-4 bg-surface border border-border-color rounded-[var(--radius-md)] gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[14px] font-semibold">BS</div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold m-0 mb-[2px]">Budi Santoso</p>
                <p className="text-[11px] text-text-secondary m-0">Renter</p>
              </div>
              <div className="w-9 h-9 rounded-full border-2 border-border-color flex items-center justify-center text-[11px] font-semibold text-text-secondary">74%</div>
            </div>
            <div className="flex items-center p-4 bg-surface border border-border-color rounded-[var(--radius-md)] gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-light text-white flex items-center justify-center text-[14px] font-semibold">SA</div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold m-0 mb-[2px]">Siti Aminah</p>
                <p className="text-[11px] text-text-secondary m-0">Owner</p>
              </div>
              <div className="w-9 h-9 rounded-full border-2 border-border-color flex items-center justify-center text-[11px] font-semibold text-text-secondary">92%</div>
            </div>
            <div className="flex items-center p-4 bg-surface border border-border-color rounded-[var(--radius-md)] gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D1E68C] text-[#000] flex items-center justify-center text-[14px] font-semibold">AR</div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold m-0 mb-[2px]">Ahmad Rizal</p>
                <p className="text-[11px] text-text-secondary m-0">Renter</p>
              </div>
              <div className="w-9 h-9 rounded-full border-2 border-border-color flex items-center justify-center text-[11px] font-semibold text-text-secondary">60%</div>
            </div>
            <div className="flex items-center p-4 bg-surface border border-border-color rounded-[var(--radius-md)] gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-gold text-white flex items-center justify-center text-[14px] font-semibold">DL</div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold m-0 mb-[2px]">Dewi Lestari</p>
                <p className="text-[11px] text-text-secondary m-0">Owner</p>
              </div>
              <div className="w-9 h-9 rounded-full border-2 border-border-color flex items-center justify-center text-[11px] font-semibold text-text-secondary">88%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
