import { CheckCircle2, CopyX, Flag, Upload, XCircle } from 'lucide-react';
import { useId } from 'react';
import type { ImportReport, RejectedRow } from '../../api/types';
import { formatNumber } from '../../utils/format';
import shared from '../shared.module.css';
import StatTiles from '../StatTiles';
import styles from './Import.module.css';

function RowTable({ title, rows, empty }: { title: string; rows: RejectedRow[]; empty: string }) {
  const id = useId();
  return (
    <section className={shared.card} aria-labelledby={id}>
      <h2 id={id} className={shared.cardTitle}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className={shared.muted}>{empty}</p>
      ) : (
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th scope="col" className={shared.numeric}>
                  Row
                </th>
                <th scope="col">Transaction ID</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <th scope="row" className={shared.numeric}>
                    {r.row}
                  </th>
                  <td className="mono">{r.id ?? '—'}</td>
                  <td>
                    <ul className={styles.reasonList}>
                      {r.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** What happened to every row: imported, rejected with reasons, or skipped as a duplicate. */
export default function ReportStep({
  report,
  onAnother,
}: {
  report: ImportReport;
  onAnother: () => void;
}) {
  return (
    <>
      <StatTiles
        label="Import result"
        tiles={[
          {
            label: 'Imported',
            value: formatNumber(report.imported),
            note: `of ${formatNumber(report.totalRows)} rows in ${report.fileName}`,
            icon: CheckCircle2,
          },
          {
            label: 'Flagged',
            value: formatNumber(report.flagged),
            note: 'Scored medium or above',
            icon: Flag,
            tone: report.flagged > 0 ? 'action' : 'default',
          },
          {
            label: 'Rejected',
            value: formatNumber(report.rejected.length),
            note: 'Not imported; see reasons below',
            icon: XCircle,
          },
          {
            label: 'Duplicates skipped',
            value: formatNumber(report.duplicates.length),
            note: 'ID already imported or repeated',
            icon: CopyX,
          },
        ]}
      />
      <RowTable title="Rejected rows" rows={report.rejected} empty="Every row passed validation." />
      <RowTable title="Duplicates skipped" rows={report.duplicates} empty="No duplicate IDs." />
      <div className={styles.actions}>
        <button type="button" className={shared.buttonPrimary} onClick={onAnother}>
          <Upload size={16} aria-hidden="true" />
          Import another file
        </button>
      </div>
    </>
  );
}
