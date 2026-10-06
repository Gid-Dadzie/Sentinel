import { CircleCheck, CircleX, Clock, type LucideIcon } from 'lucide-react';
import type { Status } from '../types';
import { capitalize } from '../utils/format';
import styles from './Badge.module.css';

const ICONS: Record<Status, LucideIcon> = {
  approved: CircleCheck,
  pending: Clock,
  declined: CircleX,
};

export default function StatusBadge({ status }: { status: Status }) {
  const Icon = ICONS[status];
  return (
    <span className={`${styles.status} ${styles[status]}`}>
      <Icon size={14} aria-hidden="true" />
      {capitalize(status)}
    </span>
  );
}
