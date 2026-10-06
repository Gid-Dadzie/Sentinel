import type { LucideIcon } from 'lucide-react';
import styles from './StatTiles.module.css';

export interface StatTile {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  /** "action" highlights the one number that needs someone to do something. */
  tone?: 'default' | 'action';
}

/** Headline numbers as a definition list, labelled as one region. */
export default function StatTiles({
  tiles,
  label = 'Summary',
}: {
  tiles: StatTile[];
  label?: string;
}) {
  return (
    <section aria-label={label}>
      <dl className={styles.tiles}>
        {tiles.map(({ label: tileLabel, value, note, icon: Icon, tone = 'default' }) => (
          <div
            key={tileLabel}
            className={`${styles.tile} ${tone === 'action' ? styles.action : ''}`}
          >
            <dt className={styles.tileLabel}>
              {Icon && (
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={15} />
                </span>
              )}
              {tileLabel}
            </dt>
            <dd className={styles.tileValue}>{value}</dd>
            {note && <dd className={styles.tileNote}>{note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
