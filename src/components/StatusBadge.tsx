import type { Status } from '../types';
import { capitalize } from '../utils/format';
import styles from './Badge.module.css';

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`${styles.badge} ${styles.status}`}>{capitalize(status)}</span>;
}
