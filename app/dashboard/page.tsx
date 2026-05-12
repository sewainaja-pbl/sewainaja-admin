'use client';

import { useState, useEffect } from 'react';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import { Users, Clock, AlertTriangle, RefreshCw, ChevronDown, MoreHorizontal, ChevronRight, Loader2 } from 'lucide-react';
import { db } from '@/lib/firestore';
import { collection, doc, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // 1. Fetch App Stats
        const statsSnap = await getDoc(doc(db, 'app_stats', 'global'));
        if (statsSnap.exists()) {
          setStatsData((prev: Record<string, number>) => ({ ...prev, ...(statsSnap.data() as Record<string, number>) }));
        }

        // 2. Fetch Pending Actions
        const tasksQuery = query(collection(db, 'admin_tasks'), orderBy('createdAt', 'desc'), limit(5));
        const tasksSnap = await getDocs(tasksQuery);
        setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardTask)));

        // 3. Fetch Recent Users
        const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(4));
        const usersSnap = await getDocs(usersQuery);
        setRecentUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardUser)));

        // 4. Fetch Traffic Logs
        const trafficQuery = query(collection(db, 'user_activity_logs'), orderBy('date', 'desc'), limit(7));
        const trafficSnap = await getDocs(trafficQuery);
        setTrafficLogs(trafficSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrafficLog)));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end mb-2">
        <div>
          <h1 className="text-[26px] font-semibold text-text-primary m-0 mb-1">Hello, Admin! 👋</h1>
          <p className="text-[14px] text-text-secondary m-0">Welcome back! Here&apos;s your platform overview.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="px-4 py-2.5 bg-surface rounded-full text-[13px] font-medium text-text-secondary shadow-[var(--shadow-soft)] flex items-center gap-2">
            This Month
            <ChevronDown size={14} />
          </div>
          <button 
            className="px-5 py-2.5 rounded-full text-[13px] font-medium shadow-[0_4px_12px_rgba(1,45,29,0.2)] hover:brightness-110 transition-all"
            style={{ backgroundColor: '#012D1D', color: 'white' }}
          >
            Export report
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
        <div className="col-span-1 md:col-span-6 lg:col-span-3 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Rental Pulse</h3>
            <MoreHorizontal size={20} className="text-text-tertiary cursor-pointer" />
          </div>
          <div className="flex-1 flex justify-center items-center py-8">
            <div className="w-[180px] h-[180px] rounded-full flex items-center justify-center transition-all duration-300" style={{ background: pulseGradient }}>
              <div className="w-[130px] h-[130px] bg-surface rounded-full flex flex-col items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)]">
                <span className="text-[36px] font-bold text-primary leading-none">{statsData.totalTransactionsActive || 0}</span>
                <span className="text-[12px] text-text-tertiary">active</span>
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
        <div className="col-span-1 md:col-span-6 lg:col-span-4 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[16px] font-semibold text-text-primary m-0">Pending Actions</h3>
            <Link href="/dashboard/users" className="text-[12px] font-medium text-text-secondary flex items-center gap-1 hover:text-primary transition-colors">See All <ChevronRight size={14} /></Link>
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {normalTasks.length > 0 ? normalTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${getTaskStatusClass(task.priority || task.status || '')}`}></div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-text-primary m-0 mb-1">{task.title}</p>
                  <p className="text-[11px] text-text-tertiary m-0">
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
            <div className="mt-auto bg-accent-green-pale rounded-[var(--radius-md)] p-4">
              <span className="inline-block px-2.5 py-1 bg-primary text-white rounded-full text-[10px] font-semibold mb-3">Urgent Review</span>
              <p className="text-[14px] font-semibold text-primary m-0 mb-1">{urgentTask.title}</p>
              <p className="text-[11px] text-text-secondary m-0 mb-4">{urgentTask.description} {urgentTask.refId ? `(${urgentTask.refId})` : ''}</p>
              <div className="h-1 bg-black/5 rounded-sm overflow-hidden">
                <div className="h-full bg-primary rounded-sm" style={{ width: '68%' }}></div>
              </div>
            </div>
          ) : (
            <div className="mt-auto bg-surface border border-border-color rounded-[var(--radius-md)] p-4 text-center">
              <span className="text-[12px] text-text-secondary">No urgent tasks currently.</span>
            </div>
          )}
        </div>

        {/* Large Performance Chart Widget */}
        <div className="col-span-1 md:col-span-12 lg:col-span-5 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Traffic Pengguna</h3>
              <p className="text-[12px] text-text-tertiary mt-1 mb-0">{(totalVisitors / 1000).toFixed(1)}k active visitors this week</p>
            </div>
            <div className="flex bg-background p-1 rounded-full">
              <span className="px-4 py-1.5 text-[11px] font-medium rounded-full cursor-pointer bg-primary text-white">Weekly</span>
              <span className="px-4 py-1.5 text-[11px] font-medium text-text-secondary rounded-full cursor-pointer hover:bg-white/50">Monthly</span>
              <span className="px-4 py-1.5 text-[11px] font-medium text-text-secondary rounded-full cursor-pointer hover:bg-white/50">Annually</span>
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
                        x: (i / (sortedData.length - 1)) * 400,
                        y: 180 - ((d.activeUsers / maxVal) * 160),
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
                  {[...trafficLogs].sort((a, b) => a.date.localeCompare(b.date)).map((d, i) => (
                    <span key={i} className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                      {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  ))}
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
        <div className="col-span-1 md:col-span-12 bg-surface rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-soft)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[16px] font-semibold text-text-primary m-0">Recent Users</h3>
              <p className="text-[12px] text-text-tertiary mt-1 mb-0">{recentUsers.length} newest signups</p>
            </div>
            <Link href="/dashboard/users" className="text-[12px] font-medium text-text-secondary flex items-center gap-1 hover:text-primary transition-colors">All Users <ChevronRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentUsers.length > 0 ? recentUsers.map((user, i) => (
              <div key={user.id} className="flex items-center p-4 bg-surface border border-border-color rounded-[var(--radius-md)] gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold ${userColors[i % userColors.length]}`}>
                  {getInitials(user.name)}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold m-0 mb-[2px] truncate w-24" title={user.name}>{user.name}</p>
                  <p className="text-[11px] text-text-secondary m-0">{user.isOwner ? 'Owner' : 'Renter'}</p>
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-border-color flex items-center justify-center text-[11px] font-semibold text-text-secondary">
                  {user.status === 'verified' ? '✓' : '...'}
                </div>
              </div>
            )) : (
              <div className="col-span-full py-4 text-center text-text-secondary text-[13px]">No users found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
