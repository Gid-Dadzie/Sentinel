import { FileUp, Upload } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';
import { ApiError } from '../api/client';
import { previewImport, runImport } from '../api/imports';
import type { ColumnMapping, ImportPreview, ImportReport } from '../api/types';
import styles from '../components/import/Import.module.css';
import MappingStep from '../components/import/MappingStep';
import ReportStep from '../components/import/ReportStep';
import PageHeader from '../components/PageHeader';
import shared from '../components/shared.module.css';

type Step =
  | { kind: 'choose' }
  | { kind: 'map'; file: File; preview: ImportPreview }
  | { kind: 'done'; report: ImportReport };

const ACCEPT =
  '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function Import() {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const inputId = useId();

  async function run<T>(task: () => Promise<T>, next: (result: T) => Step) {
    setBusy(true);
    setError(null);
    try {
      setStep(next(await task()));
    } catch (err) {
      const details =
        err instanceof ApiError && Array.isArray(err.details)
          ? err.details.filter((d): d is string => typeof d === 'string')
          : [];
      setError({ message: err instanceof Error ? err.message : 'Something went wrong', details });
    } finally {
      setBusy(false);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // choosing the same file again should work
    if (!file) return;
    void run(
      () => previewImport(file),
      (preview) => ({ kind: 'map', file, preview }),
    );
  }

  function onImport(file: File, mapping: ColumnMapping) {
    void run(
      () => runImport(file, mapping),
      (report) => ({ kind: 'done', report }),
    );
  }

  return (
    <div className={shared.page}>
      <PageHeader
        title="Import transactions"
        meta="CSV or Excel (.xlsx), up to 10 MB. Every row is validated and scored with the current rules."
      />

      {error && (
        <div className={styles.error} role="alert">
          <p>{error.message}</p>
          {error.details.length > 0 && (
            <ul>
              {error.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step.kind === 'choose' && (
        <section className={`${shared.card} ${styles.drop}`} aria-labelledby={`${inputId}-title`}>
          <FileUp size={32} aria-hidden="true" />
          <h2 id={`${inputId}-title`} className={shared.cardTitle}>
            Choose a file
          </h2>
          <p className={shared.cardDescription}>
            The first row must be column headings. You will match columns to fields next; nothing is
            saved until you confirm.
          </p>
          <label className={shared.buttonPrimary} htmlFor={inputId} aria-disabled={busy}>
            <Upload size={16} aria-hidden="true" />
            {busy ? 'Reading file…' : 'Choose file'}
          </label>
          <input
            id={inputId}
            className="visually-hidden"
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={onFile}
          />
        </section>
      )}

      {step.kind === 'map' && (
        <MappingStep
          preview={step.preview}
          busy={busy}
          onCancel={() => {
            setError(null);
            setStep({ kind: 'choose' });
          }}
          onImport={(mapping: ColumnMapping) => onImport(step.file, mapping)}
        />
      )}

      {step.kind === 'done' && (
        <ReportStep report={step.report} onAnother={() => setStep({ kind: 'choose' })} />
      )}
    </div>
  );
}
