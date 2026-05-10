import Badge from '@/components/Badge';
import styles from './page.module.css';

export default function Users() {
  const users = [
    { id: 'U-1001', name: 'Budi Santoso', email: 'budi@example.com', role: 'Renter', status: 'pending' },
    { id: 'U-1002', name: 'Siti Aminah', email: 'siti@example.com', role: 'Owner', status: 'pending' },
    { id: 'U-1003', name: 'Ahmad Rizal', email: 'ahmad@example.com', role: 'Renter', status: 'active' },
    { id: 'U-1004', name: 'Dewi Lestari', email: 'dewi@example.com', role: 'Owner', status: 'active' },
    { id: 'U-1005', name: 'Rudy Hartono', email: 'rudy@example.com', role: 'Renter', status: 'error' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Users & Approvals</h1>
          <p className={styles.subtitle}>Manage user database and verify identity credentials.</p>
        </div>
        <div className={styles.actions}>
          <input type="text" placeholder="Search users..." className={styles.searchInput} />
        </div>
      </header>

      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.activeTab}`}>All Users</button>
            <button className={styles.tab}>Pending Approvals</button>
          </div>
        </div>
        
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={styles.idCol}>{user.id}</td>
                <td>{user.name}</td>
                <td className={styles.emailCol}>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <Badge 
                    status={user.status as any} 
                    label={user.status === 'error' ? 'Rejected' : user.status === 'active' ? 'Approved' : 'Pending Review'} 
                  />
                </td>
                <td>
                  <button className={styles.actionBtn}>
                    {user.status === 'pending' ? 'Review KTP' : 'View Details'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
