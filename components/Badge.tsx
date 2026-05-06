interface BadgeProps {
  status: 'active' | 'pending' | 'success' | 'error';
  label: string;
}

const Badge = ({ status, label }: BadgeProps) => {
  const statusStyles = {
    active: 'bg-status-active text-white',
    success: 'bg-status-success text-white',
    error: 'bg-status-error text-white',
    pending: 'bg-status-pending text-text-primary'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap ${statusStyles[status]}`}>
      {label}
    </span>
  );
};

export default Badge;
