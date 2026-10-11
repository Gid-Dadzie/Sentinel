import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decisionLabels, transactionsPath } from '../api/review';
import type { TransactionPage } from '../api/types';
import { useApiData } from '../api/useApiData';
import { PAGE_SIZE, filtersFromParams } from '../utils/dashboard';
import { LoadProblem } from './LoadState';
import shared from './shared.module.css';
import { TransactionTableView } from './TransactionTable';
import styles from './TransactionTable.module.css';

/** The URL switch for "flagged and not resolved yet", used by the review queue's link. */
export const QUEUE_PARAM = 'queue';

/** Waits for typing to pause before searching, so each keystroke is not a request. */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

interface ApiTransactionTableProps {
  title: string;
  /** Every country stored, for the country filter. */
  countries: readonly string[];
  /** How many transactions are stored in all. */
  total: number;
}

/** The transaction table over stored data: filtering, sorting and paging happen in the API. */
export default function ApiTransactionTable({ title, countries, total }: ApiTransactionTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const queueOnly = searchParams.get(QUEUE_PARAM) === '1';
  const path = useDebounced(
    transactionsPath(filters, PAGE_SIZE, queueOnly ? { needsReview: '1' } : {}),
    200,
  );
  const { data, error, reload } = useApiData<TransactionPage>(path, { keepPrevious: true });
  const labels = useMemo(() => decisionLabels(data?.items ?? []), [data]);

  const setQueueOnly = (on: boolean) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (on) params.set(QUEUE_PARAM, '1');
        else params.delete(QUEUE_PARAM);
        params.delete('page');
        return params;
      },
      { replace: true },
    );

  const notice = error ? (
    <LoadProblem error={error} onRetry={reload} />
  ) : data ? undefined : (
    <p role="status" className={`${shared.empty} ${shared.muted}`}>
      Loading transactions…
    </p>
  );

  return (
    <TransactionTableView
      title={title}
      items={error ? [] : (data?.items ?? [])}
      matched={error ? 0 : (data?.total ?? null)}
      total={total}
      page={data?.page ?? filters.page}
      pageCount={data?.pageCount ?? 1}
      countries={countries}
      reviewLabels={labels}
      notice={notice}
      extraFilters={
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={queueOnly}
            onChange={(e) => setQueueOnly(e.target.checked)}
          />
          Needs review
        </label>
      }
      extraFiltering={queueOnly}
      extraParams={[QUEUE_PARAM]}
    />
  );
}
