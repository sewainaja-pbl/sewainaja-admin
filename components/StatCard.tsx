import { ElementType } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ElementType;
  variant?: 'default' | 'dark';
}

const StatCard = ({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) => {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {Icon && (
          <span className={styles.iconWrapper}>
            <Icon size={20} className={styles.icon} />
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
