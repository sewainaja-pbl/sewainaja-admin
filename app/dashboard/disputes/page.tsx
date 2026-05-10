import Badge from '@/components/Badge';
import styles from './page.module.css';

export default function Disputes() {
  const disputes = [
    { 
      id: 'D-2031', 
      trxId: 'TRX-9902',
      reporter: 'Ahmad Rizal (Renter)', 
      against: 'Dewi Lestari (Owner)', 
      reason: 'Barang tidak sesuai deskripsi', 
      date: '2026-05-05',
      status: 'pending' 
    },
    { 
      id: 'D-2032', 
      trxId: 'TRX-9884',
      reporter: 'Siti Aminah (Owner)', 
      against: 'Rudy Hartono (Renter)', 
      reason: 'Kamera lecet parah saat dikembalikan', 
      date: '2026-05-04',
      status: 'pending' 
    },
    { 
      id: 'D-2029', 
      trxId: 'TRX-9801',
      reporter: 'Budi Santoso (Renter)', 
      against: 'Ahmad Rizal (Owner)', 
      reason: 'Pemilik membatalkan sepihak saat check-in', 
      date: '2026-05-01',
      status: 'success' 
    },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dispute Mediation</h1>
          <p className={styles.subtitle}>Mediate issues between renters and owners.</p>
        </div>
      </header>

      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.activeTab}`}>Open Disputes</button>
            <button className={styles.tab}>Resolved</button>
          </div>
        </div>
        
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Dispute ID</th>
              <th>Transaction</th>
              <th>Reporter</th>
              <th>Against</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((dispute) => (
              <tr key={dispute.id}>
                <td className={styles.idCol}>{dispute.id}</td>
                <td className={styles.trxCol}>{dispute.trxId}</td>
                <td>{dispute.reporter}</td>
                <td>{dispute.against}</td>
                <td className={styles.reasonCol}>{dispute.reason}</td>
                <td>
                  <Badge 
                    status={dispute.status as any} 
                    label={dispute.status === 'success' ? 'Resolved' : 'Open'} 
                  />
                </td>
                <td>
                  <button className={styles.actionBtn}>
                    {dispute.status === 'pending' ? 'Review Evidence' : 'View Details'}
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
