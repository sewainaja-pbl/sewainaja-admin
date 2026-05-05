import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.searchContainer}>
        <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="Search..." className={styles.searchInput} />
      </div>
      
      <div className={styles.rightSection}>
        <button className={styles.iconButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className={styles.badge}>4</span>
        </button>
        
        <div className={styles.profile}>
          <div className={styles.avatar}>
            <span className={styles.avatarText}>AD</span>
          </div>
          <div className={styles.profileInfo}>
            <span className={styles.role}>System Admin</span>
            <span className={styles.name}>Admin SewainAja</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
