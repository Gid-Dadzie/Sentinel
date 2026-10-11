import { ArrowLeft, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { mappingProblems } from '../../api/imports';
import type { ColumnMapping, ImportFieldKey, ImportPreview } from '../../api/types';
import { formatNumber } from '../../utils/format';
import shared from '../shared.module.css';
import styles from './Import.module.css';

interface MappingStepProps {
  preview: ImportPreview;
  busy: boolean;
  onCancel: () => void;
  onImport: (mapping: ColumnMapping) => void;
}

const cellText = (cell: ImportPreview['sample'][number][number] | undefined) =>
  cell === null || cell === undefined ? '' : String(cell);

/** Match each field to one of the file's columns, with a sample value to check against. */
export default function MappingStep({ preview, busy, onCancel, onImport }: MappingStepProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(preview.suggestedMapping);
  const problems = mappingProblems(preview, mapping);
  const mapId = useId();
  const sampleId = useId();
  const problemsId = useId();
  const firstRow = preview.sample[0] ?? [];

  /** An empty choice ("Not in file") leaves the field out of the mapping. */
  const setColumn = (key: ImportFieldKey, column: string) =>
    setMapping((current) => {
      const { [key]: _previous, ...rest } = current;
      return column ? { ...rest, [key]: column } : rest;
    });

  return (
    <>
      <section className={shared.card} aria-labelledby={mapId}>
        <div className={shared.cardHead}>
          <h2 id={mapId} className={shared.cardTitle}>
            Match columns to fields
          </h2>
          <p className={styles.fileMeta}>
            {preview.fileName} · {formatNumber(preview.rowCount)} rows
          </p>
        </div>
        <p className={shared.cardDescription}>
          We guessed from the column headings. Check each one against the example from the first
          row. Fields marked required must have a column.
        </p>

        <div className={shared.tableScroll}>
          <table className={`${shared.table} ${styles.mapTable}`}>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Column in your file</th>
                <th scope="col">Example from row 2</th>
              </tr>
            </thead>
            <tbody>
              {preview.fields.map((field) => {
                const column = mapping[field.key] ?? '';
                const example = column ? cellText(firstRow[preview.headers.indexOf(column)]) : '';
                return (
                  <tr key={field.key}>
                    <th scope="row">
                      {field.label}
                      {field.required && <span className={styles.required}>Required</span>}
                    </th>
                    <td>
                      <select
                        className={styles.select}
                        aria-label={`Column for ${field.label}`}
                        value={column}
                        onChange={(e) => setColumn(field.key, e.target.value)}
                      >
                        <option value="">
                          {field.required ? 'Choose a column' : 'Not in file'}
                        </option>
                        {preview.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${shared.muted} ${styles.example}`}>{example || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {problems.length > 0 && (
          <ul id={problemsId} className={styles.problems} aria-live="polite">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <button type="button" className={shared.buttonGhost} onClick={onCancel} disabled={busy}>
            <ArrowLeft size={16} aria-hidden="true" />
            Choose another file
          </button>
          <button
            type="button"
            className={shared.buttonPrimary}
            disabled={busy || problems.length > 0}
            aria-describedby={problems.length > 0 ? problemsId : undefined}
            onClick={() => onImport(mapping)}
          >
            <Check size={16} aria-hidden="true" />
            {busy ? 'Importing…' : `Import ${formatNumber(preview.rowCount)} rows`}
          </button>
        </div>
      </section>

      <section className={shared.card} aria-labelledby={sampleId}>
        <h2 id={sampleId} className={shared.cardTitle}>
          First rows of the file
        </h2>
        <div className={shared.tableScroll}>
          <table className={shared.table}>
            <thead>
              <tr>
                {preview.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row, i) => (
                // Sample rows have no ID of their own until mapped; position is their identity.
                <tr key={i}>
                  {preview.headers.map((header, j) => (
                    <td key={header} className={shared.nowrap}>
                      {cellText(row[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
