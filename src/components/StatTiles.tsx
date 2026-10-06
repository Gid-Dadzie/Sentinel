import styles from './StatTiles.module.css';

export interface StatTile {
  label: string;
  value: string;
  note?: string;
}

/** Headline numbers as a definition list, with a hidden heading for screen readers. */
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
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>{tile.value}</dd>
            {tile.note && <dd className={styles.tileNote}>{tile.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
