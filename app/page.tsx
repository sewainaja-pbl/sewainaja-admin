import StatCard from '@/components/StatCard';
import styles from './page.module.css';

export default function Home() {
  const stats = [
    { title: 'Total Users', value: '1,248', subtitle: '+12% this month', icon: '👥', variant: 'dark' },
    { title: 'Pending Approvals', value: '23', subtitle: 'Requires attention', icon: '⏳', variant: 'default' },
    { title: 'Open Disputes', value: '4', subtitle: '2 overdue', icon: '⚠️', variant: 'default' },
    { title: 'Active Rentals', value: '82%', subtitle: 'Optimal workload', icon: '🔄', variant: 'default' },
  ];

  const tasks = [
    { title: 'Review KTP for Budi Santoso', subtitle: 'ID Verification • 1h ago', status: 'error' },
    { title: 'Resolve dispute TRX-9884', subtitle: 'Mediation • 2h ago', status: 'primary' },
    { title: 'Update system config', subtitle: 'Maintenance • 4h ago', status: 'success' },
    { title: 'Weekly report generation', subtitle: 'Automated • 12h ago', status: 'primary' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Hello, Admin! 👋</h1>
          <p className={styles.subtitle}>Welcome back! Here&apos;s your platform overview.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.dateSelector}>May 01 - May 31</div>
          <button className={styles.exportBtn}>Export report</button>
        </div>
      </header>

      <div className={styles.statsGrid}>
        {stats.map((stat, i) => (
          <StatCard key={i} title={stat.title} value={stat.value} subtitle={stat.subtitle} icon={stat.icon} variant={stat.variant as any} />
        ))}
      </div>

      <div className={styles.bentoGrid}>
        {/* Pulse / Circular Chart Widget */}
        <div className={`${styles.widget} ${styles.pulseWidget}`}>
          <div className={styles.widgetHeader}>
            <h3 className={styles.widgetTitle}>Rental Pulse</h3>
            <span className={styles.dotMenu}>...</span>
          </div>
          <div className={styles.pulseContainer}>
            <div className={styles.donutChart}>
              <div className={styles.donutInner}>
                <span className={styles.donutValue}>98</span>
                <span className={styles.donutLabel}>active</span>
              </div>
            </div>
          </div>
          <div className={styles.pulseLegend}>
            <div className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: 'var(--primary)'}}></span> Active</div>
            <div className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: '#D1E68C'}}></span> Completed</div>
            <div className={styles.legendItem}><span className={styles.dot} style={{backgroundColor: 'var(--background)'}}></span> Cancelled</div>
          </div>
        </div>

        {/* Tasks List Widget */}
        <div className={`${styles.widget} ${styles.tasksWidget}`}>
          <div className={styles.widgetHeader}>
            <h3 className={styles.widgetTitle}>Pending Actions</h3>
            <button className={styles.textBtn}>See All {'>'}</button>
          </div>
          <div className={styles.taskList}>
            {tasks.map((task, i) => (
              <div key={i} className={styles.taskItem}>
                <div className={`${styles.taskDot} ${styles[task.status]}`}></div>
                <div className={styles.taskInfo}>
                  <p className={styles.taskTitle}>{task.title}</p>
                  <p className={styles.taskSubtitle}>{task.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.priorityBox}>
            <span className={styles.priorityBadge}>Urgent Review</span>
            <p className={styles.priorityTitle}>Dispute Escallation</p>
            <p className={styles.prioritySubtitle}>Renter vs Owner Dispute TRX-9884</p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '68%' }}></div>
            </div>
          </div>
        </div>

        {/* Large Performance Chart Widget */}
        <div className={`${styles.widget} ${styles.chartWidget}`}>
          <div className={styles.widgetHeader}>
            <div>
              <h3 className={styles.widgetTitle}>Transaction Snapshot</h3>
              <p className={styles.widgetSubtitle}>Rentals completed this week</p>
            </div>
            <div className={styles.chartTabs}>
              <span className={styles.activeTab}>Weekly</span>
              <span>Monthly</span>
              <span>Annually</span>
            </div>
          </div>
          <div className={styles.chartArea}>
            <div className={styles.chartLine}></div>
            <div className={styles.chartPoint}>
              <div className={styles.tooltip}>22 rentals<br/><span>Thursday</span></div>
            </div>
          </div>
        </div>

        {/* Recent Activity / Users Widget */}
        <div className={`${styles.widget} ${styles.activityWidget}`}>
          <div className={styles.widgetHeader}>
            <div>
              <h3 className={styles.widgetTitle}>Recent Users</h3>
              <p className={styles.widgetSubtitle}>4 active</p>
            </div>
            <button className={styles.textBtn}>All Users {'>'}</button>
          </div>
          <div className={styles.userGrid}>
            <div className={styles.userCard}>
              <div className={styles.userAvatar}>BS</div>
              <div className={styles.userInfo}>
                <p className={styles.userName}>Budi Santoso</p>
                <p className={styles.userRole}>Renter</p>
              </div>
              <div className={styles.userScore}>74%</div>
            </div>
            <div className={styles.userCard}>
              <div className={styles.userAvatar} style={{backgroundColor: 'var(--primary-light)'}}>SA</div>
              <div className={styles.userInfo}>
                <p className={styles.userName}>Siti Aminah</p>
                <p className={styles.userRole}>Owner</p>
              </div>
              <div className={styles.userScore}>92%</div>
            </div>
            <div className={styles.userCard}>
              <div className={styles.userAvatar} style={{backgroundColor: '#D1E68C', color: '#000'}}>AR</div>
              <div className={styles.userInfo}>
                <p className={styles.userName}>Ahmad Rizal</p>
                <p className={styles.userRole}>Renter</p>
              </div>
              <div className={styles.userScore}>60%</div>
            </div>
            <div className={styles.userCard}>
              <div className={styles.userAvatar} style={{backgroundColor: 'var(--accent-gold)'}}>DL</div>
              <div className={styles.userInfo}>
                <p className={styles.userName}>Dewi Lestari</p>
                <p className={styles.userRole}>Owner</p>
              </div>
              <div className={styles.userScore}>88%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
