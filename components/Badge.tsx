import styles from './Badge.module.css';

interface BadgeProps {
  status: 'active' | 'pending' | 'success' | 'error';
  label: string;
}

const Badge = ({ status, label }: BadgeProps) => {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {label}
    </span>
  );
};

export default Badge;
