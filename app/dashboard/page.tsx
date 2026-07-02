'use client';

import { useState, useEffect } from 'react';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import { Users, Clock, AlertTriangle, RefreshCw, MoreHorizontal, ChevronRight, Loader2, Download } from 'lucide-react';
import { db } from '@/lib/firestore';
import { collection, doc, getDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore';

interface DashboardTask { id: string; title?: string; type?: string; createdAt?: { seconds: number }; priority?: string; status?: string; description?: string; refId?: string; }
interface DashboardUser { id: string; name: string; isOwner?: boolean; status?: string; }
interface TrafficLog { id: string; date: string; activeUsers: number; }

export default function Home() {
  const [statsData, setStatsData] = useState<Record<string, number>>({
    totalUsers: 0,
    totalPendingApprovals: 0,
    totalOpenDisputes: 0,
    totalOverdueDisputes: 0,
    totalActiveRentals: 0,
    totalTransactionsActive: 0,
    totalTransactionsCompleted: 0,
    totalTransactionsCancelled: 0,
  });
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [recentUsers, setRecentUsers] = useState<DashboardUser[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const currentMonth = new Date().toISOString().substring(0, 7);
        const isCurrentMonth = selectedMonth === currentMonth;

        let statsDataObj = {
          totalUsers: 0, totalPendingApprovals: 0, totalOpenDisputes: 0, 
          totalOverdueDisputes: 0, totalActiveRentals: 0, totalTransactionsActive: 0, 
          totalTransactionsCompleted: 0, totalTransactionsCancelled: 0
        };
        
        const statsSnap = await getDoc(doc(db, isCurrentMonth ? 'app_stats' : 'app_stats_history', isCurrentMonth ? 'global' : selectedMonth));
        if (statsSnap.exists()) {
          statsDataObj = { ...statsDataObj, ...(statsSnap.data() as any) };
        }
        setStatsData(statsDataObj);

        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

        const tasksQuery = query(collection(db, 'admin_tasks'), where('createdAt', '>=', startDate), where('createdAt', '<=', endDate), orderBy('createdAt', 'desc'), limit(5));
        const tasksSnap = await getDocs(tasksQuery);
        setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardTask)));

        const usersQuery = query(collection(db, 'users'), where('createdAt', '>=', startDate), where('createdAt', '<=', endDate), orderBy('createdAt', 'desc'), limit(4));
        const usersSnap = await getDocs(usersQuery);
        setRecentUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardUser)));

        const trafficQuery = query(collection(db, 'user_activity_logs'), where('month', '==', selectedMonth));
        const trafficSnap = await getDocs(trafficQuery);
        setTrafficLogs(trafficSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrafficLog)));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth]);

  const handleExportPDF = () => {
    // html2canvas tidak mendukung format warna oklab/oklch bawaan Tailwind v4.
    // window.print() adalah cara paling tangguh dan asli untuk mencetak PDF berbasis vektor
    window.print();
  };

  const stats = [
    { title: 'Total Users', value: statsData?.totalUsers?.toLocaleString() || '0', subtitle: 'Verified accounts', icon: Users, variant: 'dark' },
    { title: 'Pending Approvals', value: statsData?.totalPendingApprovals?.toLocaleString() || '0', subtitle: 'Requires attention', icon: Clock, variant: 'default' },
    { title: 'Open Disputes', value: statsData?.totalOpenDisputes?.toLocaleString() || '0', subtitle: `${statsData?.totalOverdueDisputes || 0} overdue`, icon: AlertTriangle, variant: 'default' },
    { title: 'Active Rentals', value: statsData?.totalActiveRentals?.toLocaleString() || '0', subtitle: 'Optimal workload', icon: RefreshCw, variant: 'default' },
  ];

  const getTaskStatusClass = (status: string) => {
    if (status === 'error' || status === 'urgent') return 'bg-status-error';
    if (status === 'primary' || status === 'normal') return 'bg-primary';
    if (status === 'success' || status === 'done') return 'bg-status-success';
    return 'bg-border-color';
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const userColors = ['bg-primary text-white', 'bg-primary-light text-white', 'bg-[#D1E68C] text-[#000]', 'bg-accent-gold text-white'];

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
        <span className="ml-3 text-text-secondary font-medium">Loading Dashboard...</span>
      </div>
    );
  }

  // Calculate rental pulse percentage
  const totalTransactions = (statsData.totalTransactionsActive || 0) + (statsData.totalTransactionsCompleted || 0) + (statsData.totalTransactionsCancelled || 0);
  const activePct = totalTransactions > 0 ? ((statsData.totalTransactionsActive || 0) / totalTransactions) * 100 : 0;
  const completedPct = totalTransactions > 0 ? activePct + (((statsData.totalTransactionsCompleted || 0) / totalTransactions) * 100) : 0;
  const pulseGradient = `conic-gradient(var(--color-primary) 0% ${activePct}%, #D1E68C ${activePct}% ${completedPct}%, var(--color-background) ${completedPct}% 100%)`;

  // Traffic Stats
  const totalVisitors = trafficLogs.reduce((acc, log) => acc + (log.activeUsers || 0), 0);

  // Separate Urgent Task
  const urgentTask = tasks.find(t => t.priority === 'urgent' || t.status === 'error');
  const normalTasks = tasks.filter(t => t.id !== urgentTask?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-6 bg-background rounded-xl" id="dashboard-content">
      <header className="flex justify-between items-end mb-2 p-2 print:hidden">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Hello, Admin! 👋</h1>
          <p className="text-[14px] text-text-secondary m-0">Welcome back! Here&apos;s your platform overview.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="relative flex items-center bg-surface rounded-full shadow-[var(--shadow-soft)] px-3 py-2 text-[13px] font-medium text-text-secondary border border-border-color/30 hover:border-border-color transition-colors">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none cursor-pointer text-text-primary [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 transition-opacity"
            />
          </div>
          <button 
            onClick={handleExportPDF}
            className="px-5 py-2.5 flex items-center gap-2 rounded-full text-[13px] font-medium bg-primary text-white shadow-[0_4px_12px_rgba(1,45,29,0.2)] hover:shadow-[0_6px_16px_rgba(1,45,29,0.3)] hover:brightness-110 transition-all active:scale-95"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <StatCard key={i} title={stat.title} value={stat.value} subtitle={stat.subtitle} icon={stat.icon} variant={stat.variant as "default" | "dark"} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-auto gap-5">
        {/* Pulse / Circular Chart Widget */}
        <div className="col-span-1 md:col-span-6 lg:col-span-3 bg-surface rounded-lg p-6 shadow-soft hover:shadow-hover transition-all duration-300 border border-border-color/50 flex flex-col group/card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Rental Pulse</h3>
            <div className="p-1.5 hover:bg-background rounded-full transition-colors cursor-pointer">
              <MoreHorizontal size={18} className="text-text-tertiary" />
            </div>
          </div>
          <div className="flex-1 flex justify-center items-center py-8">
            <div className="w-[180px] h-[180px] rounded-full flex items-center justify-center transition-all duration-500 group-hover/card:scale-105" style={{ background: pulseGradient }}>
              <div className="w-[130px] h-[130px] bg-surface rounded-full flex flex-col items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)] relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                <span className="text-[36px] font-bold text-primary leading-none relative z-10">{statsData.totalTransactionsActive || 0}</span>
                <span className="text-[12px] text-text-tertiary relative z-10 font-medium">active</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-auto pt-4 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--color-primary)'}}></span> Active</div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: '#D1E68C'}}></span> Completed ({statsData.totalTransactionsCompleted || 0})</div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary"><span className="w-2 h-2 rounded-full" style={{backgroundColor: 'var(--color-background)'}}></span> Cancelled</div>
          </div>
        </div>

        {/* Tasks List Widget */}
        <div className="col-span-1 md:col-span-6 lg:col-span-4 bg-surface rounded-lg p-6 shadow-soft hover:shadow-hover transition-all duration-300 border border-border-color/50 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Pending Actions</h3>
            <Link href="/dashboard/users" className="text-[12px] font-semibold text-primary hover:bg-primary/5 px-3 py-1 rounded-full transition-all flex items-center gap-1 group">
              See All <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {normalTasks.length > 0 ? normalTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-4 p-2 -mx-2 rounded-xl hover:bg-background/50 transition-colors cursor-pointer group/task">
                <div className={`w-2 h-2 rounded-full mt-2 transition-transform group-hover/task:scale-125 ${getTaskStatusClass(task.priority || task.status || '')}`}></div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-text-primary m-0 mb-1 group-hover/task:text-primary transition-colors">{task.title}</p>
                  <p className="text-[11px] text-text-tertiary m-0 font-medium">
                    {task.type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} 
                    {task.createdAt ? ` • ${new Date(task.createdAt?.seconds * 1000).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-[13px] text-text-secondary text-center py-4">No pending actions</p>
            )}
          </div>
          {urgentTask ? (
            <div className="mt-auto bg-accent-green-pale/50 border border-primary/10 rounded-xl p-4 transition-transform hover:scale-[1.02] cursor-pointer">
              <span className="inline-block px-2.5 py-1 bg-primary text-white rounded-full text-[10px] font-bold mb-3 shadow-[0_4px_10px_rgba(1,45,29,0.2)]">Urgent Review</span>
              <p className="text-[14px] font-bold text-primary m-0 mb-1">{urgentTask.title}</p>
              <p className="text-[11px] text-text-secondary m-0 mb-4 font-medium">{urgentTask.description} {urgentTask.refId ? `(${urgentTask.refId})` : ''}</p>
              <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(1,45,29,0.3)]" style={{ width: '68%' }}></div>
              </div>
            </div>
          ) : (
            <div className="mt-auto bg-surface border border-border-color rounded-[var(--radius-md)] p-4 text-center">
              <span className="text-[12px] text-text-secondary">No urgent tasks currently.</span>
            </div>
          )}
        </div>

        {/* Large Performance Chart Widget */}
        <div className="col-span-1 md:col-span-12 lg:col-span-5 bg-surface rounded-lg p-6 shadow-soft hover:shadow-hover transition-all duration-300 border border-border-color/50 flex flex-col">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Traffic Pengguna</h3>
              <p className="text-[12px] font-medium text-text-tertiary mt-1 mb-0">{(totalVisitors / 1000).toFixed(1)}k active visitors in {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex-1 min-h-[220px] mt-4 relative">
            {trafficLogs.length > 0 ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 relative">
                  <svg viewBox="0 0 400 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    {[0, 1, 2].map(i => (
                      <line 
                        key={i} 
                        x1="0" 
                        y1={20 + (i * 160 / 2)} 
                        x2="400" 
                        y2={20 + (i * 160 / 2)} 
                        stroke="rgba(0,0,0,0.05)" 
                        strokeDasharray="4"
                      />
                    ))}

                    {(() => {
                      const sortedData = [...trafficLogs].sort((a, b) => a.date.localeCompare(b.date));
                      const maxVal = Math.max(...sortedData.map(d => d.activeUsers), 1);
                      const points = sortedData.map((d, i) => ({
                        x: sortedData.length === 1 ? 200 : (i / (sortedData.length - 1)) * 400,
                        y: 180 - (((d.activeUsers || 0) / maxVal) * 160),
                        data: d
                      }));

                      const pathData = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
                      const areaData = pathData + ` L ${points[points.length-1].x} 200 L ${points[0].x} 200 Z`;

                      return (
                        <>
                          <path d={areaData} fill="url(#chartGradient)" />
                          <path d={pathData} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, i) => (
                            <g key={i} className="group/point">
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r="4" 
                                fill="white" 
                                stroke="var(--color-primary)" 
                                strokeWidth="2" 
                                className="transition-all duration-300 group-hover/point:r-6 group-hover/point:stroke-width-3"
                              />
                              {/* Simple Tooltip */}
                              <g className="opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none">
                                <rect x={p.x - 40} y={p.y - 45} width="80" height="30" rx="6" fill="var(--color-surface)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />
                                <text x={p.x} y={p.y - 25} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--color-text-primary)">
                                  {p.data.activeUsers.toLocaleString()}
                                </text>
                              </g>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <div className="flex justify-between mt-4">
                  {[...trafficLogs].sort((a, b) => a.date.localeCompare(b.date)).map((d, i, arr) => {
                    const isVisible = i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1;
                    return (
                      <span key={i} className={`text-[10px] font-medium text-text-tertiary uppercase tracking-wider ${isVisible ? '' : 'opacity-0'}`} style={{ width: '20px', textAlign: 'center' }}>
                        {new Date(d.date).getDate()}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-background/50 rounded-xl border border-dashed border-border-color">
                <span className="text-[12px] text-text-tertiary">No traffic data available</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity / Users Widget */}
        <div className="col-span-1 md:col-span-12 bg-surface rounded-lg p-6 shadow-soft hover:shadow-hover transition-all duration-300 border border-border-color/50 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Recent Users</h3>
              <p className="text-[12px] font-medium text-text-tertiary mt-1 mb-0">{recentUsers.length} newest signups</p>
            </div>
            <Link href="/dashboard/users" className="text-[12px] font-semibold text-primary hover:bg-primary/5 px-4 py-1.5 rounded-full transition-all flex items-center gap-1 group">
              All Users <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentUsers.length > 0 ? recentUsers.map((user, i) => (
              <div key={user.id} className="flex items-center p-4 bg-background/30 border border-border-color/50 rounded-xl gap-4 hover:bg-surface hover:shadow-md hover:border-primary/10 transition-all cursor-pointer group/user">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold shadow-inner transition-transform group-hover/user:scale-105 ${userColors[i % userColors.length]}`}>
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[14px] font-bold text-text-primary m-0 mb-[2px] truncate" title={user.name}>{user.name}</p>
                  <p className="text-[11px] font-medium text-text-tertiary m-0">{user.isOwner ? 'Property Owner' : 'Verified Renter'}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface border border-border-color flex items-center justify-center text-primary shadow-sm group-hover/user:bg-primary group-hover/user:text-white transition-colors">
                  {user.status === 'verified' ? <ChevronRight size={14} /> : <div className="w-1.5 h-1.5 bg-status-active rounded-full animate-pulse" />}
                </div>
              </div>
            )) : (
              <div className="col-span-full py-10 text-center text-text-secondary text-[14px] font-medium">No users found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
