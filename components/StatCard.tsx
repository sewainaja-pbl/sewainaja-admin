import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  variant?: 'default' | 'dark';
}

const StatCard = ({ title, value, subtitle, icon, variant = 'default' }: StatCardProps) => {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {icon && (
          <span className={styles.iconWrapper}>
            <span className={styles.icon}>{icon}</span>
          </span>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        {subtitle && (
          <div className={styles.subtitleWrapper}>
            <span className={styles.indicator}></span>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
